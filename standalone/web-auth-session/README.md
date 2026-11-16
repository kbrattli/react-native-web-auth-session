# web-auth-session

A local Turbo Module. It opens a URL in the system's auth browser and returns the callback URL: `ASWebAuthenticationSession` on iOS, a Custom Tab on Android. It needs the New Architecture.

## Add it to an app

1. Copy this folder into the app, for example to `modules/web-auth-session`.
2. Add it to the app's `package.json`. Use `link:` with Yarn or pnpm, and `file:` with npm.

   ```json
   "dependencies": {
     "react-native-web-auth-session": "link:./modules/web-auth-session"
   }
   ```

3. Install the dependencies, run `pod install` in `ios`, and rebuild the app. Autolinking and codegen find the module. Nothing is registered by hand.

## Android

The redirect reaches the app as a deep link. Add an intent filter for the callback scheme to `MainActivity`, which must have `launchMode="singleTask"`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="myapp" android:host="callback" />
</intent-filter>
```

React Native's `Linking` also receives the callback URL. Ignore it in the app's deep link handler.

## Use

```ts
import { openAuthSession } from 'react-native-web-auth-session';

const result = await openAuthSession('https://auth.example.com/start', 'myapp');

if (result.type === 'success') {
  // result.url is the full callback URL, for example myapp://callback?code=…
} else {
  // The browser closed before the redirect.
}
```

It rejects with an `Error` whose `code` is `NO_BROWSER`, `ALREADY_OPEN` or `OPEN_FAILED`.
