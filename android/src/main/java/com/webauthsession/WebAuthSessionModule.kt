package com.webauthsession

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.UiThreadUtil

/**
 * Opens the URL in an Auth Tab, which hands the redirect back as an activity result. A browser
 * without Auth Tab opens the same intent as a Custom Tab. Its redirect reaches the app through an
 * intent filter for the scheme on the singleTask activity, which closes the tab.
 */
class WebAuthSessionModule(context: ReactApplicationContext) :
  NativeWebAuthSessionSpec(context), ActivityEventListener, LifecycleEventListener {

  // Only touched on the UI thread.
  private var pending: Promise? = null
  private var scheme = ""
  private var callbackUrl: String? = null
  private var closed = false

  init {
    context.addActivityEventListener(this)
    context.addLifecycleEventListener(this)
  }

  override fun openAuthSession(
    url: String,
    callbackScheme: String,
    preferEphemeralSession: Boolean,
    browserPackages: ReadableArray?,
    promise: Promise,
  ) {
    val browser = pickBrowser(browserPackages?.toArrayList()?.map { it.toString() })
      ?: return promise.reject("NO_BROWSER", "No browser to open the auth session in")
    val intent = AuthTabIntent.Builder().build().intent
      .setPackage(browser)
      .setData(Uri.parse(url))
      .putExtra(AuthTabIntent.EXTRA_REDIRECT_SCHEME, callbackScheme)
    UiThreadUtil.runOnUiThread {
      if (pending != null) {
        return@runOnUiThread promise.reject("ALREADY_OPEN", "Another auth session is open")
      }
      val error = runCatching {
        checkNotNull(reactApplicationContext.currentActivity) { "No activity" }
          .startActivityForResult(intent, REQUEST_CODE)
      }.exceptionOrNull()
      if (error != null) return@runOnUiThread promise.reject("OPEN_FAILED", error)
      pending = promise
      scheme = callbackScheme
    }
  }

  // From the given packages, or from every browser with Custom Tabs with the default one first:
  // the first with Auth Tab, otherwise the first.
  private fun pickBrowser(packages: List<String>?): String? {
    val context = reactApplicationContext
    val installed = context.packageManager
      .queryIntentServices(Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION), 0)
      .map { it.serviceInfo.packageName }
    val default = CustomTabsClient.getPackageName(context, null)
    val browsers = packages?.filter { it in installed } ?: installed.sortedByDescending { it == default }
    return browsers.firstOrNull { CustomTabsClient.isAuthTabSupported(context, it) } ?: browsers.firstOrNull()
  }

  // The tab is gone. An Auth Tab returns the redirect here. A Custom Tab returns no data.
  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    closed = true
    accept(data?.data)
  }

  // Custom Tab: the redirect opened the app's singleTask activity, which closed the tab.
  override fun onNewIntent(intent: Intent) {
    if (pending != null) accept(intent.data)
  }

  private fun accept(uri: Uri?) {
    if (uri != null && uri.scheme.equals(scheme, ignoreCase = true)) callbackUrl = uri.toString()
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
    pending = null
    callbackUrl = null
    closed = false
  }

  private companion object {
    // Below 0x10000, where ActivityResultRegistry's own codes start.
    const val REQUEST_CODE = 0x7a55
  }
}
