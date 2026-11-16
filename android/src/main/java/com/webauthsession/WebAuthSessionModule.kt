package com.webauthsession

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.customtabs.CustomTabsService
import androidx.browser.customtabs.CustomTabsServiceConnection
import androidx.browser.customtabs.CustomTabsSession
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil

/**
 * Opens the URL in a Custom Tab with a session. The redirect reaches the app through an intent
 * filter for the scheme on the singleTask activity, which closes the tab.
 */
class WebAuthSessionModule(context: ReactApplicationContext) :
  NativeWebAuthSessionSpec(context), ActivityEventListener, LifecycleEventListener {

  // Only touched on the UI thread.
  private var pending: Promise? = null
  private var scheme = ""
  private var callbackUrl: String? = null
  private var opened = false
  private var closed = false
  private var connection: CustomTabsServiceConnection? = null

  init {
    context.addActivityEventListener(this)
    context.addLifecycleEventListener(this)
  }

  override fun openAuthSession(
    url: String,
    callbackScheme: String,
    preferEphemeralSession: Boolean,
    promise: Promise,
  ) {
    val browser = pickBrowser()
      ?: return promise.reject("NO_BROWSER", "No browser with Custom Tabs")
    UiThreadUtil.runOnUiThread {
      if (pending != null) {
        return@runOnUiThread promise.reject("ALREADY_OPEN", "Another auth session is open")
      }
      pending = promise
      scheme = callbackScheme
      // Chrome lets a tab redirect to the app that opened it without a recent tap, but it only
      // knows which app that is when the tab has a session.
      val connection = object : CustomTabsServiceConnection() {
        // Also called when the browser's process restarts, or after the wait below is over.
        override fun onCustomTabsServiceConnected(name: ComponentName, client: CustomTabsClient) {
          if (!opened) open(url, browser, client.newSession(null))
        }

        override fun onServiceDisconnected(name: ComponentName) = Unit
      }
      this.connection = connection
      if (CustomTabsClient.bindCustomTabsService(reactApplicationContext, browser, connection)) {
        // A service that doesn't connect must not keep the tab from opening.
        UiThreadUtil.runOnUiThread({
          if (this.connection === connection && !opened) open(url, browser, null)
        }, CONNECT_TIMEOUT_MS)
      } else {
        open(url, browser, null)
      }
    }
  }

  // Chrome first: its redirect rules are the ones this flow relies on. Otherwise the default
  // browser, then any browser with Custom Tabs.
  private fun pickBrowser(): String? {
    val context = reactApplicationContext
    val installed = context.packageManager
      .queryIntentServices(Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION), 0)
      .map { it.serviceInfo.packageName }
    val default = CustomTabsClient.getPackageName(context, null)
    return listOfNotNull("com.android.chrome", default).firstOrNull { it in installed }
      ?: installed.firstOrNull()
  }

  private fun open(url: String, browser: String, session: CustomTabsSession?) {
    opened = true
    val intent = CustomTabsIntent.Builder(session).build().intent
      .setPackage(browser)
      .setData(Uri.parse(url))
    val error = runCatching {
      checkNotNull(reactApplicationContext.currentActivity) { "No activity" }
        .startActivityForResult(intent, REQUEST_CODE)
    }.exceptionOrNull() ?: return
    pending?.reject("OPEN_FAILED", error)
    release()
  }

  // The tab is gone: the redirect closed it, or the user did.
  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == REQUEST_CODE) closed = true
  }

  // The redirect opened the app's singleTask activity, which closed the tab.
  override fun onNewIntent(intent: Intent) {
    val uri = intent.data ?: return
    if (pending != null && uri.scheme.equals(scheme, ignoreCase = true)) callbackUrl = uri.toString()
  }

  // Android delivers results and new intents before it resumes the activity.
  override fun onHostResume() {
    if (closed) settle()
  }

  override fun onHostPause() = Unit

  // React Native has unmounted the app, so nobody waits for the result. Don't stay busy.
  override fun onHostDestroy() = settle()

  private fun settle() {
    pending?.resolve(callbackUrl)
    release()
  }

  private fun release() {
    pending = null
    callbackUrl = null
    opened = false
    closed = false
    connection?.let { reactApplicationContext.unbindService(it) }
    connection = null
  }

  private companion object {
    // Below 0x10000, where ActivityResultRegistry's own codes start.
    const val REQUEST_CODE = 0x7a55
    const val CONNECT_TIMEOUT_MS = 2000L
  }
}
