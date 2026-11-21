// The changes the config plugin makes, as plain functions on the parsed AndroidManifest.xml and
// the MainActivity.kt source, so they can be tested without Expo.

const LAUNCHER_ACTIVITY = 'com.webauthsession.LauncherActivity';
const MAIN_ACTIVITY_KEY = 'com.webauthsession.MAIN_ACTIVITY';
const MAIN_ACTION = 'android.intent.action.MAIN';

const name = (node) => node.$?.['android:name'];

const fullClassName = (className, packageName) => {
  if (className.startsWith('.')) return packageName + className;
  return className.includes('.') ? className : `${packageName}.${className}`;
};

/**
 * Moves the launcher intent filter from MainActivity to the library's LauncherActivity and names
 * MainActivity in its meta-data. Running it again changes nothing.
 *
 * @param manifest AndroidManifest.xml as parsed by xml2js, as config plugins get it.
 * @param packageName The app's Android package, which relative activity names start from.
 */
function addLauncherActivity(manifest, packageName) {
  const application = manifest.manifest.application?.[0];
  const activities = application?.activity ?? [];
  const main = activities.find((activity) => {
    const activityName = name(activity);
    return (
      activityName && fullClassName(activityName, packageName) === `${packageName}.MainActivity`
    );
  });
  if (!main) throw new Error('react-native-web-auth-session: MainActivity is not in AndroidManifest.xml');

  let launcher = activities.find((activity) => name(activity) === LAUNCHER_ACTIVITY);
  const filters = main['intent-filter'] ?? [];
  const moved = filters.filter((filter) => filter.action?.some((a) => name(a) === MAIN_ACTION));
  if (!launcher) {
    if (moved.length === 0) {
      throw new Error('react-native-web-auth-session: MainActivity has no launcher intent filter to move');
    }
    launcher = { $: { 'android:name': LAUNCHER_ACTIVITY } };
    application.activity = [...activities, launcher];
  }

  main['intent-filter'] = filters.filter((filter) => !moved.includes(filter));
  if (main['intent-filter'].length === 0) delete main['intent-filter'];
  launcher['intent-filter'] = [...(launcher['intent-filter'] ?? []), ...moved];

  // The launch shows LauncherActivity's starting window (the splash screen on Android 12+), so it
  // has to look like MainActivity's.
  launcher.$['android:exported'] = 'true';
  for (const attribute of ['android:theme', 'android:screenOrientation']) {
    if (main.$[attribute]) launcher.$[attribute] = main.$[attribute];
    else delete launcher.$[attribute];
  }

  const metaData = (launcher['meta-data'] ?? []).filter((entry) => name(entry) !== MAIN_ACTIVITY_KEY);
  launcher['meta-data'] = [
    ...metaData,
    {
      $: {
        'android:name': MAIN_ACTIVITY_KEY,
        'android:value': fullClassName(name(main), packageName),
      },
    },
  ];
  return manifest;
}

const SIGNATURE = 'override fun invokeDefaultOnBackPressed()';

/**
 * Makes Back on MainActivity move the app to the background on every Android version. On Android
 * 12+ Android only does that by itself for a root activity that the home screen started, and now
 * LauncherActivity starts MainActivity. Replaces Expo's own override. Running it again changes
 * nothing.
 *
 * @param source MainActivity.kt.
 */
function moveTaskToBackOnBack(source) {
  const start = source.indexOf(SIGNATURE);
  if (start === -1) {
    // No override yet: add one before the class's closing brace.
    const end = source.lastIndexOf('}');
    if (end === -1) throw new Error('react-native-web-auth-session: could not read MainActivity.kt');
    return `${source.slice(0, end).trimEnd()}\n\n${override('  ')}\n}\n`;
  }

  const lineStart = source.lastIndexOf('\n', start) + 1;
  const indent = source.slice(lineStart, start);
  const open = source.indexOf('{', start);
  let end = open;
  for (let depth = 0; open !== -1 && end < source.length; end++) {
    if (source[end] === '{') depth++;
    else if (source[end] === '}' && --depth === 0) break;
  }
  if (open === -1 || end === source.length) {
    throw new Error('react-native-web-auth-session: could not read invokeDefaultOnBackPressed in MainActivity.kt');
  }

  // Drop the doc comment right above Expo's override. It describes the code being replaced.
  let from = lineStart;
  const before = source.slice(0, lineStart).trimEnd();
  const docStart = before.lastIndexOf('/**');
  if (before.endsWith('*/') && docStart !== -1 && before.indexOf('*/', docStart) === before.length - 2) {
    from = before.lastIndexOf('\n', docStart) + 1;
  }
  return source.slice(0, from) + override(indent) + source.slice(end + 1);
}

// The comment is inside the function, so running the plugin again replaces it too.
const override = (indent) =>
  [
    `${indent}${SIGNATURE} {`,
    `${indent}  // react-native-web-auth-session: LauncherActivity starts this activity, so Android 12+`,
    `${indent}  // would finish it on Back instead of moving the app to the background.`,
    `${indent}  if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()`,
    `${indent}}`,
  ].join('\n');

module.exports = { addLauncherActivity, moveTaskToBackOnBack };
