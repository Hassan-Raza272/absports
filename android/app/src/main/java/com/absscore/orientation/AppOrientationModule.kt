package com.absscore.orientation

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class AppOrientationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppOrientation"

  @ReactMethod
  fun lockLandscape() {
    setOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)
  }

  @ReactMethod
  fun lockPortrait() {
    setOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT)
  }

  private fun setOrientation(orientation: Int) {
    UiThreadUtil.runOnUiThread {
      reactContext.currentActivity?.requestedOrientation = orientation
    }
  }
}
