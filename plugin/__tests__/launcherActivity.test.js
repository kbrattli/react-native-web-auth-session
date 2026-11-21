const { expect, it } = require('@jest/globals');
const { addLauncherActivity, moveTaskToBackOnBack } = require('../launcherActivity');

const attrs = (name, more) => ({ $: { 'android:name': name, ...more } });

// What Expo's prebuild hands the plugin, shortened.
const expoManifest = () => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        activity: [
          {
            $: {
              'android:name': '.MainActivity',
              'android:launchMode': 'singleTask',
              'android:theme': '@style/Theme.App.SplashScreen',
              'android:screenOrientation': 'portrait',
              'android:exported': 'true',
            },
            'intent-filter': [
              {
                action: [attrs('android.intent.action.MAIN')],
                category: [attrs('android.intent.category.LAUNCHER')],
              },
              {
                action: [attrs('android.intent.action.VIEW')],
                category: [
                  attrs('android.intent.category.DEFAULT'),
                  attrs('android.intent.category.BROWSABLE'),
                ],
                data: [{ $: { 'android:scheme': 'myapp' } }],
              },
            ],
          },
        ],
      },
    ],
  },
});

it('moves the launcher intent filter to LauncherActivity', () => {
  const manifest = addLauncherActivity(expoManifest(), 'com.example.app');
  const [main, launcher] = manifest.manifest.application[0].activity;

  expect(main['intent-filter']).toEqual([expoManifest().manifest.application[0].activity[0]['intent-filter'][1]]);
  expect(launcher).toEqual({
    $: {
      'android:name': 'com.webauthsession.LauncherActivity',
      'android:exported': 'true',
      'android:theme': '@style/Theme.App.SplashScreen',
      'android:screenOrientation': 'portrait',
    },
    'intent-filter': [
      {
        action: [attrs('android.intent.action.MAIN')],
        category: [attrs('android.intent.category.LAUNCHER')],
      },
    ],
    'meta-data': [
      attrs('com.webauthsession.MAIN_ACTIVITY', { 'android:value': 'com.example.app.MainActivity' }),
    ],
  });
});

it('changes nothing the second time', () => {
  const once = addLauncherActivity(expoManifest(), 'com.example.app');
  const twice = addLauncherActivity(addLauncherActivity(expoManifest(), 'com.example.app'), 'com.example.app');
  expect(twice).toEqual(once);
});

it('finds MainActivity by its full name', () => {
  const manifest = expoManifest();
  manifest.manifest.application[0].activity[0].$['android:name'] = 'com.example.app.MainActivity';
  addLauncherActivity(manifest, 'com.example.app');
  expect(manifest.manifest.application[0].activity).toHaveLength(2);
});

it('fails without MainActivity or a launcher intent filter', () => {
  const noMain = expoManifest();
  noMain.manifest.application[0].activity[0].$['android:name'] = '.Other';
  expect(() => addLauncherActivity(noMain, 'com.example.app')).toThrow('MainActivity is not');

  const noFilter = expoManifest();
  noFilter.manifest.application[0].activity[0]['intent-filter'].shift();
  expect(() => addLauncherActivity(noFilter, 'com.example.app')).toThrow('no launcher intent filter');
});

// Expo's template, SDK 58.
const expoMainActivity = `package com.example.app

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
`;

const patched = `package com.example.app

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"

  override fun invokeDefaultOnBackPressed() {
    // react-native-web-auth-session: LauncherActivity starts this activity, so Android 12+
    // would finish it on Back instead of moving the app to the background.
    if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()
  }
}
`;

it("replaces Expo's Back override", () => {
  expect(moveTaskToBackOnBack(expoMainActivity)).toBe(patched);
  expect(moveTaskToBackOnBack(patched)).toBe(patched);
});

it('adds the override when there is none', () => {
  const source = `class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;
  expect(moveTaskToBackOnBack(source)).toBe(`class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"

  override fun invokeDefaultOnBackPressed() {
    // react-native-web-auth-session: LauncherActivity starts this activity, so Android 12+
    // would finish it on Back instead of moving the app to the background.
    if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()
  }
}
`);
});

it('keeps a doc comment that belongs to the function above', () => {
  const source = `class MainActivity : ReactActivity() {
  /** The component. */
  override fun getMainComponentName(): String = "main"
  override fun invokeDefaultOnBackPressed() {
    super.invokeDefaultOnBackPressed()
  }
}
`;
  expect(moveTaskToBackOnBack(source)).toContain('/** The component. */\n  override fun getMainComponentName()');
});
