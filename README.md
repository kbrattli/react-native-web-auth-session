# react-native-web-auth-session

Open a URL in the system's auth browser and get the callback URL back.

- **iOS:** `ASWebAuthenticationSession`.
- **Android:** an [Auth Tab](https://developer.chrome.com/docs/android/custom-tabs/guide-auth-tab) where the browser has one (Chrome 137+), and a Custom Tab otherwise. You choose which browsers may be used.

An Auth Tab hands the redirect straight back to the app that opened it. That is more reliable than a Custom Tab for flows that redirect without a fresh tap from the user, for example a page that waits for approval in another app. In a Custom Tab, Chrome only opens an app without asking when the user's last tap was less than 15 seconds ago. After that, it shows a "Continue to …" prompt, which in Chrome 156 disappears by itself after about 12 seconds.

One function, no UI. Requires the New Architecture.

## Install

```sh
npm install react-native-web-auth-session
cd ios && pod install
```

## Use

```ts
import { openAuthSession } from 'react-native-web-auth-session';

const result = await openAuthSession('https://auth.example.com/start', 'myapp');

if (result.type === 'success') {
  // result.url is the full callback URL, for example myapp://callback?code=…
  const code = new URL(result.url).searchParams.get('code');
} else {
  // The user closed the browser before the redirect.
}
```

### `openAuthSession(url, callbackScheme, options?)`

Opens `url` and resolves when the browser is sent to a URL with `callbackScheme`, or when it closes.

Resolves with:

- `{ type: 'success', url }`: the browser reached the callback. `url` is the full callback URL.
- `{ type: 'cancel' }`: the browser closed without reaching it.

Only one session can be open at a time. Calling again with the same `url` and `callbackScheme` while that session is open returns the same promise. So a component that mounts twice (React StrictMode) doesn't open a second browser.

Rejects with an `Error` whose `code` is one of:

| `code` | When |
| --- | --- |
| `NO_BROWSER` | Android: none of the allowed browsers is installed and enabled. |
| `ALREADY_OPEN` | Another session, with a different `url` or `callbackScheme`, is open. |
| `OPEN_FAILED` | The browser could not be opened, for example because the app has no foreground activity. |

### Options

| Option | Platform | Default | |
| --- | --- | --- | --- |
| `preferEphemeralSession` | iOS | `false` | Use a private session that shares no cookies with Safari. This also skips the system alert that asks the user to allow the app to sign in with the site. |
| `browserPackages` | Android | every browser with Custom Tabs, the default browser first | Package names of the browsers that may be used, in order. The first installed one with Auth Tab is used, otherwise the first installed one, as a Custom Tab. |

Use only Chrome, and report when it is missing:

```ts
try {
  const result = await openAuthSession(url, 'myapp', {
    browserPackages: ['com.android.chrome'],
  });
} catch (e) {
  if ((e as { code?: string }).code === 'NO_BROWSER') {
    // Chrome isn't installed or is turned off.
  }
}
```

## Android setup

**Auth Tab** needs no setup. The package declares the `<queries>` entry it needs to find browsers.

**Custom Tab fallback** (Chrome before 137, and other browsers): the redirect reaches your app as a normal deep link. Add an intent filter for the scheme to `MainActivity`, which must have `launchMode="singleTask"` (the React Native template default). The redirect then closes the tab and the module picks up the URL.

```xml
<activity android:name=".MainActivity" android:launchMode="singleTask" ...>
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" android:host="callback" />
  </intent-filter>
</activity>
```

In this path, React Native's `Linking` also receives the callback URL. Ignore it in your deep link handler, for example with React Navigation's `linking.filter`.

### Keep the browser open when the user taps the app icon

The browser runs in your app's task, above `MainActivity`. With `singleTask`, tapping the app icon delivers an intent to `MainActivity`, which closes everything above it, including the browser. The session then resolves with `cancel`. That matters when the user has to leave the browser during the flow, for example to approve in another app, and comes back through the app icon.

To avoid it, let a small activity take the launcher intent. It starts `MainActivity` only on a cold start or when the launch carries data (a notification tap). Otherwise it finishes, and the task comes forward as it was.

```kotlin
class LauncherActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (isTaskRoot || intent.extras != null || intent.data != null) {
      startActivity(Intent(intent).setClass(this, MainActivity::class.java))
    }
    finish()
  }
}
```

```xml
<!-- Move the MAIN/LAUNCHER intent filter from MainActivity to here. -->
<activity android:name=".LauncherActivity" android:exported="true" android:theme="@style/AppTheme">
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>
</activity>
```

On Android 12+, Back on the first screen only moves the app to the background when the home screen started the root activity. Keep that behaviour in `MainActivity`:

```kotlin
override fun invokeDefaultOnBackPressed() {
  if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()
}
```

## Things to know

- **The redirect needs the browser in the foreground on Android.** Chrome doesn't hand a redirect to an app, not even an Auth Tab result, while Chrome itself is in the background.
- **If the app's activity is destroyed while the browser is open** (process death, "Don't keep activities"), the session resolves with `cancel` or never reaches JavaScript, and the callback URL is lost.
- **Chrome's first-run screen** shows inside the Auth Tab when the user has never opened Chrome. Backing out of it resolves with `cancel`.
- **Two installed apps with the same scheme** (debug and release builds): in a Custom Tab, Chrome may drop the redirect. Auth Tab is not affected. Use a different scheme per build.

## Example app

```sh
yarn
node example/server.js   # test pages on http://localhost:8080
yarn example ios
yarn example android     # first: adb reverse tcp:8080 tcp:8080
```

## License

MIT
