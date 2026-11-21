const { AndroidConfig, withAndroidManifest, withMainActivity } = require('expo/config-plugins');
const { addLauncherActivity, moveTaskToBackOnBack } = require('./plugin/launcherActivity');

/**
 * Expo config plugin. Does nothing unless an option turns something on.
 *
 * @param {object} config
 * @param {{ launcherActivity?: boolean }} [options]
 *   launcherActivity: on Android, let the library's LauncherActivity take the launcher intent, so
 *   tapping the app icon doesn't close the browser.
 */
function withWebAuthSession(config, options = {}) {
  if (!options.launcherActivity) return config;

  config = withAndroidManifest(config, (config) => {
    const packageName = AndroidConfig.Package.getPackage(config);
    if (!packageName) throw new Error('react-native-web-auth-session: set android.package');
    addLauncherActivity(config.modResults, packageName);
    return config;
  });

  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('react-native-web-auth-session: launcherActivity needs a Kotlin MainActivity');
    }
    config.modResults.contents = moveTaskToBackOnBack(config.modResults.contents);
    return config;
  });
}

module.exports = withWebAuthSession;
