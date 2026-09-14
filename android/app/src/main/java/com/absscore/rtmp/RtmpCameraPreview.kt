package com.absscore.rtmp

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.TextureView

/**
 * TextureView preview (not SurfaceView) so the RN scoreboard can sit on top
 * of the camera without the SurfaceView hole-punching problem.
 * Supports pinch-to-zoom and tap-to-focus like a normal camera app.
 */
class RtmpCameraPreview @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : TextureView(context, attrs), TextureView.SurfaceTextureListener {

  private var moved = false

  init {
    surfaceTextureListener = this
    isOpaque = true
    isClickable = true
    isFocusable = true
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    // Pinch zoom (Pedro Camera2Source reads the scale gesture from the MotionEvent).
    RtmpStreamHolder.handleZoomMotion(event)

    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        moved = false
        parent?.requestDisallowInterceptTouchEvent(true)
      }
      MotionEvent.ACTION_MOVE -> {
        if (event.pointerCount > 1) moved = true
      }
      MotionEvent.ACTION_UP -> {
        if (!moved && event.pointerCount == 1) {
          RtmpStreamHolder.tapToFocus(this, event)
        }
        parent?.requestDisallowInterceptTouchEvent(false)
      }
      MotionEvent.ACTION_CANCEL -> {
        parent?.requestDisallowInterceptTouchEvent(false)
      }
    }
    return true
  }

  override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
    RtmpStreamHolder.attachPreview(this)
  }

  override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
    RtmpStreamHolder.attachPreview(this)
  }

  override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
    RtmpStreamHolder.detachPreview(this)
    return true
  }

  override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
}
