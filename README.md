# react-native-web-auth-session

Open a URL in the system's auth browser and get the callback URL back.

- **iOS:** `ASWebAuthenticationSession`.
- **Android:** a [Custom Tab](https://developer.chrome.com/docs/android/custom-tabs), in Chrome if it is installed and enabled, otherwise in the default browser, otherwise in any browser with Custom Tabs.

The tab is opened with a Custom Tabs session, which tells the browser which app opened it. Chrome lets a redirect to that app through without a fresh tap from the user, for example from a page that waits for approval in another app. Without a session, Chrome only opens an app without asking when the user's last tap was less than 15 seconds ago. After that, it shows a "Continue to …" prompt, which in Chrome 156 disappears by itself after about 12 seconds.

One function, no UI. Requires the New Architecture (React Native 0.76 or later, Expo SDK 52 or later).

## Install

Pick the setup that matches your app: [Expo](#expo) or [React Native CLI](#react-native-cli).

### Expo

Works in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not in Expo Go.

1. Install the package:

   ```sh
   npx expo install react-native-web-auth-session
   ```

2. Set a `scheme` in app.json. Pass the same scheme to `openAuthSession` as the `callbackScheme`.

   ```json
   {
     "expo": {
       "scheme": "myapp"
     }
   }
   ```

   That is all the native setup iOS and Android need. Expo adds the Android intent filter for the scheme. To use a separate callback scheme, list both: `"scheme": ["myapp", "myapp-auth"]`.

3. If you use Expo Router: on Android it also gets the callback URL and shows its not-found screen for it. Ignore the URL in `+native-intent.tsx`, next to your root `_layout.tsx`:

   ```ts
   export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
     return path.startsWith('myapp://callback') ? null : path;
   }
   ```

4. Rebuild the app:

   ```sh
   npx expo run:android
   npx expo run:ios
   ```

If users leave the browser during sign-in, also see [Keep the browser open when the user taps the app icon](#keep-the-browser-open-when-the-user-taps-the-app-icon).

### React Native CLI

1. Install the package and its pod:

   ```sh
   npm install react-native-web-auth-session
   cd ios && pod install
   ```

   iOS needs nothing else.

2. On Android, add an intent filter for the callback scheme to `MainActivity` in `android/app/src/main/AndroidManifest.xml`. `MainActivity` must have `launchMode="singleTask"`, which is the template default.

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

   The redirect opens `MainActivity`, which closes the tab, and the module picks up the URL. The package declares the `<queries>` entry it needs to find browsers.

3. React Native's `Linking` also receives the callback URL on Android. Ignore it in your deep link handler, for example with React Navigation's `linking.filter`.

4. Rebuild the app:

   ```sh
   npx react-native run-android
   npx react-native run-ios
   ```

If users leave the browser during sign-in, also see [Keep the browser open when the user taps the app icon](#keep-the-browser-open-when-the-user-taps-the-app-icon).

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
| `NO_BROWSER` | Android: no browser with Custom Tabs is installed and enabled. |
| `ALREADY_OPEN` | Another session, with a different `url` or `callbackScheme`, is open. |
| `OPEN_FAILED` | The browser could not be opened, for example because the app has no foreground activity. |

### Options

| Option | Platform | Default | |
| --- | --- | --- | --- |
| `preferEphemeralSession` | iOS | `false` | Use a private session that shares no cookies with Safari. This also skips the system alert that asks the user to allow the app to sign in with the site. |

## Keep the browser open when the user taps the app icon

Android only, and optional.

The browser runs in your app's task, above `MainActivity`. With `singleTask`, tapping the app icon delivers an intent to `MainActivity`, which closes everything above it, including the browser. The session then resolves with `cancel`. That matters when the user has to leave the browser during the flow, for example to approve in another app, and comes back through the app icon.

The fix is to let the package's `LauncherActivity` take the launcher intent. It starts `MainActivity` only on a cold start or when the launch carries data (a notification tap). Otherwise it finishes, and the task comes forward as it was. This changes how every launch of the app starts, not only sign-in, so set it up only when users have to leave the browser.

### With Expo

Turn on the config plugin in app.json, then rebuild the app:

```json
{
  "expo": {
    "plugins": [["react-native-web-auth-session", { "launcherActivity": true }]]
  }
}
```

At prebuild, the plugin moves the launcher intent filter from `MainActivity` to `LauncherActivity`, gives `LauncherActivity` the theme and orientation of `MainActivity`, and replaces the `invokeDefaultOnBackPressed` override in `MainActivity.kt`. Without `launcherActivity`, it does nothing.

### With React Native CLI

1. In `AndroidManifest.xml`, move the MAIN/LAUNCHER intent filter from `MainActivity` to `LauncherActivity`. Name `MainActivity` in its meta-data, by fully qualified class name. Give it the same theme as `MainActivity`: its window is the one that shows while the app starts, which on Android 12+ is the splash screen.

   ```xml
   <activity android:name="com.webauthsession.LauncherActivity" android:exported="true" android:theme="@style/AppTheme">
     <meta-data android:name="com.webauthsession.MAIN_ACTIVITY" android:value="com.myapp.MainActivity" />
     <intent-filter>
       <action android:name="android.intent.action.MAIN" />
       <category android:name="android.intent.category.LAUNCHER" />
     </intent-filter>
   </activity>
   ```

2. On Android 12+, Back on the first screen only moves the app to the background when the home screen started the root activity. Keep that behaviour by adding this to `MainActivity.kt`:

   ```kotlin
   override fun invokeDefaultOnBackPressed() {
     if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()
   }
   ```

## Things to know

- **Chrome is used when it is installed, also when it is not the default browser.** The redirect rule above is Chrome's. Other browsers may ask the user before they open the app, or not open it.
- **The redirect needs the browser in the foreground on Android.** Chrome doesn't hand a redirect to an app while Chrome itself is in the background.
- **If the app's activity is destroyed while the browser is open** (process death, "Don't keep activities"), the session resolves with `cancel` or never reaches JavaScript, and the callback URL is lost.
- **Chrome's first-run screen** shows inside the tab when the user has never opened Chrome. Backing out of it resolves with `cancel`.
- **Two installed apps with the same scheme** (debug and release builds): Chrome sends the redirect to the app that opened the tab. Another browser may ask the user or drop the redirect. Use a different scheme per build.

## Example app

```sh
yarn
node example/server.js   # test pages on http://localhost:8080
yarn example ios
yarn example android     # first: adb reverse tcp:8080 tcp:8080
```

## License

MIT
