package com.absscore.rtmp

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class RtmpStreamModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    RtmpStreamHolder.attachReactContext(reactContext)
  }

  override fun getName(): String = "RtmpStreamModule"

  @ReactMethod
  fun addListener(eventName: String?) {
    // NativeEventEmitter requires these no-ops.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // NativeEventEmitter requires these no-ops.
  }

  @ReactMethod
  fun startPreview(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val context = reactContext.currentActivity ?: reactContext
        RtmpStreamHolder.ensurePrepared(context)
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("PREVIEW_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun startStream(rtmpUrl: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val context = reactContext.currentActivity ?: reactContext
        RtmpStreamHolder.ensurePrepared(context)
        RtmpStreamHolder.startStream(rtmpUrl)
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("START_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun stopStream(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        RtmpStreamHolder.stopStream()
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("STOP_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun updateOverlay(base64Png: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        RtmpStreamHolder.updateOverlay(base64Png)
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("OVERLAY_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun switchCamera(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        RtmpStreamHolder.switchCamera()
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("SWITCH_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun setMicrophoneMuted(muted: Boolean, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val value = RtmpStreamHolder.setMicrophoneMuted(muted)
        promise.resolve(value)
      } catch (err: Exception) {
        promise.reject("MUTE_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun isMicrophoneMuted(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        promise.resolve(RtmpStreamHolder.isMicrophoneMuted())
      } catch (err: Exception) {
        promise.reject("MUTE_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun setZoom(zoom: Double, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val value = RtmpStreamHolder.setZoom(zoom.toFloat())
        promise.resolve(value.toDouble())
      } catch (err: Exception) {
        promise.reject("ZOOM_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun adjustZoom(delta: Double, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val value = RtmpStreamHolder.adjustZoom(delta.toFloat())
        promise.resolve(value.toDouble())
      } catch (err: Exception) {
        promise.reject("ZOOM_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun getZoomInfo(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val (zoom, range) = RtmpStreamHolder.getZoomInfo()
        val map = com.facebook.react.bridge.Arguments.createMap().apply {
          putDouble("zoom", zoom.toDouble())
          putDouble("min", range.first.toDouble())
          putDouble("max", range.second.toDouble())
        }
        promise.resolve(map)
      } catch (err: Exception) {
        promise.reject("ZOOM_FAILED", err.message, err)
      }
    }
  }

  @ReactMethod
  fun isStreaming(promise: Promise) {
    promise.resolve(RtmpStreamHolder.streaming)
  }

  @ReactMethod
  fun release(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        RtmpStreamHolder.release()
        promise.resolve(true)
      } catch (err: Exception) {
        promise.reject("RELEASE_FAILED", err.message, err)
      }
    }
  }
}
