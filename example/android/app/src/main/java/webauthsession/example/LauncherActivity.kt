package webauthsession.example

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Takes the launcher intent so that tapping the app icon doesn't reach the singleTask
 * MainActivity, which would close the browser above it. Starts MainActivity only on a cold start
 * or a launch that carries data (a notification tap); otherwise the task comes forward as it was.
 */
class LauncherActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (isTaskRoot || intent.extras != null || intent.data != null) {
      startActivity(Intent(intent).setClass(this, MainActivity::class.java))
    }
    finish()
  }
}
