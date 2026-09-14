package com.absscore.rtmp

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class RtmpCameraViewManager : SimpleViewManager<RtmpCameraPreview>() {

  override fun getName(): String = "RtmpCameraView"

  override fun createViewInstance(reactContext: ThemedReactContext): RtmpCameraPreview {
    return RtmpCameraPreview(reactContext)
  }
}
