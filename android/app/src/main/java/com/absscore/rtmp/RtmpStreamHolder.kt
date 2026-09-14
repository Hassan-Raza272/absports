package com.absscore.rtmp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.os.PowerManager
import android.util.Base64
import android.util.Log
import android.view.TextureView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.encoder.input.sources.OrientationForced
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.utils.gl.AspectRatioMode
import com.pedro.encoder.utils.gl.TranslateTo
import com.pedro.library.rtmp.RtmpStream
import com.pedro.library.view.GlStreamInterface
import java.lang.ref.WeakReference

/**
 * Shared RootEncoder instance used by the camera preview view and the JS module.
 * Preview can be attached/detached independently of the RTMP session so the
 * scorer can leave the broadcast screen without dropping the Facebook stream.
 */
object RtmpStreamHolder : ConnectChecker {

  private const val TAG = "RtmpStreamHolder"
  // Landscape 16:9 so Facebook shows a letterboxed video strip (like Reels/posts),
  // not a full-screen portrait live that fills the phone.
  private const val PREPARE_WIDTH = 1280
  private const val PREPARE_HEIGHT = 720
  private const val STREAM_ROTATION = 0
  private const val OUTPUT_WIDTH = 1280
  private const val OUTPUT_HEIGHT = 720
  // Higher bitrate keeps scorebar text readable after Facebook/YouTube recompress.
  private const val VIDEO_BITRATE = 4_500_000
  private const val VIDEO_FPS = 30
  private const val AUDIO_SAMPLE_RATE = 44_100
  private const val AUDIO_BITRATE = 128_000

  private var stream: RtmpStream? = null
  private var prepared = false
  private var previewView: TextureView? = null
  private var overlayFilter: ImageObjectFilterRender? = null
  private var pendingOverlay: Bitmap? = null
  private var lastOverlay: Bitmap? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var reactContextRef: WeakReference<ReactApplicationContext>? = null
  @Volatile
  var streaming = false
    private set

  fun attachReactContext(context: ReactApplicationContext) {
    reactContextRef = WeakReference(context)
  }

  @Synchronized
  fun ensurePrepared(context: Context) {
    val existing = stream
    if (existing == null) {
      val activity = (context as? com.facebook.react.uimanager.ThemedReactContext)?.currentActivity
      val ctx = activity ?: context.applicationContext
      stream = RtmpStream(ctx, this).also { created ->
        val gl = created.getGlInterface()
        gl.autoHandleOrientation = false
        if (gl is GlStreamInterface) {
          gl.forceOrientation(OrientationForced.LANDSCAPE)
          gl.setAspectRatioMode(AspectRatioMode.Fill)
        }
        runCatching { created.getStreamClient().setReTries(10) }
      }
    }
    val rtmp = stream ?: return
    if (!prepared) {
      val ok = rtmp.prepareVideo(
        PREPARE_WIDTH,
        PREPARE_HEIGHT,
        VIDEO_BITRATE,
        VIDEO_FPS,
        2,
        STREAM_ROTATION,
      ) && rtmp.prepareAudio(AUDIO_SAMPLE_RATE, true, AUDIO_BITRATE)
      if (!ok) {
        throw IllegalStateException("Camera/microphone encoder could not be prepared on this device")
      }
      prepared = true
    }
    flushPendingOverlay()
    tryStartPreview()
  }

  @Synchronized
  fun attachPreview(view: TextureView) {
    previewView = view
    tryStartPreview()
  }

  @Synchronized
  fun detachPreview(view: TextureView) {
    if (previewView !== view) return
    val rtmp = stream
    if (rtmp != null && rtmp.isOnPreview) {
      runCatching { rtmp.stopPreview(true) }
    }
    previewView = null
  }

  @Synchronized
  fun startStream(url: String) {
    val rtmp = stream ?: throw IllegalStateException("Call startPreview before startStream")
    if (!prepared) throw IllegalStateException("Encoder is not prepared")
    if (rtmp.isStreaming) return
    tryStartPreview()
    rtmp.startStream(url)
    streaming = true
    acquireWakeLock()
    // Preview/GL start can drop a previously set image filter — pin it again.
    reapplyLastOverlay()
    emit("started", "Connecting to Facebook Live…")
  }

  @Synchronized
  fun stopStream() {
    val rtmp = stream ?: return
    if (rtmp.isStreaming) {
      runCatching { rtmp.stopStream() }
    }
    streaming = false
    releaseWakeLock()
    emit("stopped", "Stream stopped")
  }

  @Synchronized
  fun switchCamera() {
    val source = stream?.videoSource as? Camera2Source ?: return
    runCatching { source.switchCamera() }
    trackedZoom = 1f
  }

  @Volatile
  private var micMuted = false

  @Synchronized
  fun setMicrophoneMuted(muted: Boolean): Boolean {
    val rtmp = stream ?: return micMuted
    val applied = runCatching {
      val mic = rtmp.audioSource as? MicrophoneSource
      if (mic != null) {
        if (muted) mic.mute() else mic.unMute()
        true
      } else {
        val method = rtmp.javaClass.methods.firstOrNull {
          it.name == (if (muted) "disableAudio" else "enableAudio") && it.parameterTypes.isEmpty()
        }
        method?.invoke(rtmp)
        method != null
      }
    }.getOrDefault(false)
    if (applied) micMuted = muted
    return micMuted
  }

  @Synchronized
  fun isMicrophoneMuted(): Boolean {
    val rtmp = stream ?: return micMuted
    return runCatching {
      val mic = rtmp.audioSource as? MicrophoneSource
      mic?.isMuted() ?: micMuted
    }.getOrDefault(micMuted)
  }

  fun cameraSource(): Camera2Source? = stream?.videoSource as? Camera2Source

  private var trackedZoom = 1f
  private var trackedMinZoom = 1f
  private var trackedMaxZoom = 8f

  private fun readZoom(source: Camera2Source): Float {
    return runCatching {
      (source.javaClass.getMethod("getZoom").invoke(source) as? Number)?.toFloat()
    }.getOrNull() ?: trackedZoom
  }

  private fun readZoomRange(source: Camera2Source): Pair<Float, Float> {
    return runCatching {
      val range = source.javaClass.getMethod("getZoomRange").invoke(source) as? android.util.Range<*>
      val lower = (range?.lower as? Number)?.toFloat() ?: trackedMinZoom
      val upper = (range?.upper as? Number)?.toFloat() ?: trackedMaxZoom
      lower to upper
    }.getOrDefault(trackedMinZoom to trackedMaxZoom)
  }

  @Synchronized
  fun handleZoomMotion(event: android.view.MotionEvent): Boolean {
    val source = cameraSource() ?: return false
    return runCatching {
      source.setZoom(event)
      trackedZoom = readZoom(source)
      val range = readZoomRange(source)
      trackedMinZoom = range.first
      trackedMaxZoom = range.second
      true
    }.getOrDefault(false)
  }

  @Synchronized
  fun tapToFocus(view: android.view.View, event: android.view.MotionEvent): Boolean {
    val source = cameraSource() ?: return false
    return runCatching { source.tapToFocus(view, event) }.getOrDefault(false)
  }

  @Synchronized
  fun setZoom(level: Float): Float {
    val source = cameraSource() ?: return trackedZoom
    return runCatching {
      val range = readZoomRange(source)
      trackedMinZoom = range.first
      trackedMaxZoom = range.second
      val next = level.coerceIn(trackedMinZoom, trackedMaxZoom)
      source.setZoom(next)
      trackedZoom = readZoom(source)
      trackedZoom
    }.getOrDefault(trackedZoom)
  }

  @Synchronized
  fun adjustZoom(delta: Float): Float {
    val source = cameraSource()
    val current = if (source != null) readZoom(source) else trackedZoom
    return setZoom(current + delta)
  }

  @Synchronized
  fun getZoomInfo(): Pair<Float, Pair<Float, Float>> {
    val source = cameraSource()
    if (source != null) {
      runCatching {
        trackedZoom = readZoom(source)
        val range = readZoomRange(source)
        trackedMinZoom = range.first
        trackedMaxZoom = range.second
      }
    }
    return trackedZoom to (trackedMinZoom to trackedMaxZoom)
  }

  @Synchronized
  fun updateOverlay(base64Png: String) {
    val bitmap = decodePng(base64Png) ?: return
    // Drop obviously soft frames (capture race / incomplete layout).
    if (bitmap.width < OUTPUT_WIDTH || bitmap.height < OUTPUT_HEIGHT) {
      Log.w(TAG, "Ignoring low-res overlay ${bitmap.width}x${bitmap.height}")
      bitmap.recycle()
      return
    }
    val scaled = scaleForStream(bitmap)
    if (scaled !== bitmap) bitmap.recycle()
    if (isMostlyTransparent(scaled)) {
      Log.w(TAG, "Ignoring empty overlay PNG ${scaled.width}x${scaled.height}")
      if (scaled !== lastOverlay) scaled.recycle()
      return
    }
    rememberOverlay(scaled)
    val rtmp = stream
    if (rtmp == null || !prepared) {
      pendingOverlay?.recycle()
      pendingOverlay = scaled
      return
    }
    applyOverlay(rtmp, scaled)
    if (scaled !== lastOverlay && scaled !== pendingOverlay) {
      scaled.recycle()
    }
  }

  @Synchronized
  fun release() {
    stopStream()
    val rtmp = stream
    val view = previewView
    if (rtmp != null && rtmp.isOnPreview) {
      runCatching { rtmp.stopPreview(true) }
    }
    previewView = null
    overlayFilter = null
    pendingOverlay?.recycle()
    pendingOverlay = null
    lastOverlay?.recycle()
    lastOverlay = null
    prepared = false
    runCatching { rtmp?.release() }
    stream = null
  }

  private fun tryStartPreview() {
    val rtmp = stream ?: return
    val view = previewView ?: return
    if (!prepared || rtmp.isOnPreview) return
    if (view.width <= 0 || view.height <= 0) return
    runCatching {
      rtmp.startPreview(view, true)
      overlayFilter = null
      reapplyLastOverlay()
    }.onFailure { err ->
      Log.w(TAG, "startPreview failed", err)
    }
  }

  private fun rememberOverlay(bitmap: Bitmap) {
    if (lastOverlay === bitmap) return
    val keep = bitmap.copy(Bitmap.Config.ARGB_8888, false) ?: return
    lastOverlay?.recycle()
    lastOverlay = keep
  }

  private fun reapplyLastOverlay() {
    val rtmp = stream ?: return
    val bitmap = lastOverlay ?: pendingOverlay ?: return
    if (!prepared) return
    applyOverlay(rtmp, bitmap)
  }

  private fun isMostlyTransparent(bitmap: Bitmap): Boolean {
    val w = bitmap.width
    val h = bitmap.height
    if (w <= 0 || h <= 0) return true
    val stepX = (w / 48).coerceAtLeast(1)
    val stepY = (h / 27).coerceAtLeast(1)
    var y = 0
    while (y < h) {
      var x = 0
      while (x < w) {
        if (android.graphics.Color.alpha(bitmap.getPixel(x, y)) > 12) return false
        x += stepX
      }
      y += stepY
    }
    return true
  }

  private fun flushPendingOverlay() {
    val bitmap = pendingOverlay ?: return
    val rtmp = stream ?: return
    if (!prepared) return
    pendingOverlay = null
    applyOverlay(rtmp, bitmap)
  }

  private fun applyOverlay(rtmp: RtmpStream, bitmap: Bitmap) {
    val copy = bitmap.copy(Bitmap.Config.ARGB_8888, true) ?: bitmap
    val filter = overlayFilter
    if (filter == null) {
      val created = ImageObjectFilterRender()
      created.setImage(copy)
      applyOverlayPlacement(created, copy)
      runCatching { rtmp.getGlInterface().setFilter(created) }
        .onFailure { err -> Log.w(TAG, "setFilter failed", err) }
      overlayFilter = created
    } else {
      filter.setImage(copy)
      applyOverlayPlacement(filter, copy)
    }
  }

  private fun applyOverlayPlacement(filter: ImageObjectFilterRender, bitmap: Bitmap) {
    val aspect = bitmap.height.toFloat() / bitmap.width.toFloat().coerceAtLeast(1f)
    val streamAspect = OUTPUT_HEIGHT.toFloat() / OUTPUT_WIDTH.toFloat()
    // Full-frame overlays (logo + scoreboard) cover the 16:9 Facebook stream.
    // Legacy bottom-only bars keep their previous placement.
    if (aspect >= streamAspect * 0.85f) {
      filter.setScale(100f, 100f)
      filter.setPosition(TranslateTo.CENTER)
    } else {
      val heightPercent = (aspect * (OUTPUT_WIDTH.toFloat() / OUTPUT_HEIGHT.toFloat()) * 100f).coerceIn(12f, 48f)
      filter.setScale(100f, heightPercent)
      filter.setPosition(TranslateTo.BOTTOM)
    }
  }

  private fun decodePng(raw: String): Bitmap? {
    var data = raw.trim()
    val marker = "base64,"
    val idx = data.indexOf(marker)
    if (idx >= 0) data = data.substring(idx + marker.length)
    return try {
      val bytes = Base64.decode(data, Base64.DEFAULT)
      val opts = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.ARGB_8888
        inMutable = true
      }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    } catch (err: Exception) {
      Log.w(TAG, "Failed to decode overlay PNG", err)
      null
    }
  }

  /**
   * Always normalize overlays to exact encode size with filtered downscale.
   * 2× captures (2560×1440) become sharp 1280×720; never leave undersized
   * bitmaps for the GL filter to upscale (that looks blurry on Live).
   */
  private fun scaleForStream(bitmap: Bitmap): Bitmap {
    if (bitmap.width == OUTPUT_WIDTH && bitmap.height == OUTPUT_HEIGHT) {
      return if (bitmap.config == Bitmap.Config.ARGB_8888) bitmap
      else bitmap.copy(Bitmap.Config.ARGB_8888, false) ?: bitmap
    }
    val out = Bitmap.createBitmap(OUTPUT_WIDTH, OUTPUT_HEIGHT, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      isDither = true
    }
    canvas.drawBitmap(
      bitmap,
      Rect(0, 0, bitmap.width, bitmap.height),
      Rect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT),
      paint,
    )
    return out
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val context = reactContextRef?.get()?.applicationContext ?: return
    val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "absscore:rtmp").apply {
      setReferenceCounted(false)
      acquire(4 * 60 * 60 * 1000L)
    }
  }

  private fun releaseWakeLock() {
    runCatching {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    }
    wakeLock = null
  }

  private fun emit(type: String, message: String? = null) {
    val context = reactContextRef?.get() ?: return
    if (!context.hasActiveReactInstance()) return
    val payload = Arguments.createMap().apply {
      putString("type", type)
      if (message != null) putString("message", message)
    }
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("RtmpStreamStatus", payload)
  }

  override fun onConnectionStarted(url: String) {
    emit("connecting", url)
  }

  override fun onConnectionSuccess() {
    streaming = true
    reapplyLastOverlay()
    emit("success", "Live on Facebook")
  }

  override fun onConnectionFailed(reason: String) {
    val retried = runCatching {
      stream?.getStreamClient()?.reTry(5_000, reason) == true
    }.getOrDefault(false)
    if (retried) {
      emit("retrying", reason)
      return
    }
    streaming = false
    releaseWakeLock()
    emit("failed", reason)
  }

  override fun onNewBitrate(bitrate: Long) {
    // Bitrate updates are frequent; keep them native-only.
  }

  override fun onDisconnect() {
    streaming = false
    releaseWakeLock()
    emit("disconnected", "Disconnected")
  }

  override fun onAuthError() {
    streaming = false
    releaseWakeLock()
    emit("authError", "Facebook rejected the stream key")
  }

  override fun onAuthSuccess() {
    emit("authSuccess")
  }
}
