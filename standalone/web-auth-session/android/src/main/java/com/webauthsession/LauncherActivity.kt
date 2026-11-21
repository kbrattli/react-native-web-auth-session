package com.webauthsession

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle

/**
 * Takes the launcher intent so that tapping the app icon doesn't reach the singleTask main
 * activity, which would close the browser above it. Starts the main activity only on a cold start
 * or a launch that carries data (a notification tap); otherwise the task comes forward as it was.
 *
 * The app declares it with the launcher intent filter and names its main activity in a
 * `com.webauthsession.MAIN_ACTIVITY` meta-data entry, by fully qualified class name.
 */
class LauncherActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (isTaskRoot || intent.extras != null || intent.data != null) {
      startActivity(Intent(intent).setClassName(this, mainActivity()))
    }
    finish()
  }

  @Suppress("DEPRECATION") // The flags overload is API 33+.
  private fun mainActivity(): String =
    checkNotNull(
      packageManager.getActivityInfo(componentName, PackageManager.GET_META_DATA)
        .metaData?.getString(MAIN_ACTIVITY)
    ) { "Add a $MAIN_ACTIVITY meta-data entry with the main activity's class name" }

  private companion object {
    const val MAIN_ACTIVITY = "com.webauthsession.MAIN_ACTIVITY"
  }
}
