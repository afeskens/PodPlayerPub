// Expo config plugin that injects the react-native-track-player MusicService
// declaration into the final AndroidManifest.xml.
//
// Why this exists:
// react-native-track-player's own AndroidManifest.xml (located at
// node_modules/react-native-track-player/android/src/main/AndroidManifest.xml)
// is supposed to be picked up by gradle's manifest merger during EAS build.
// In practice, with Expo SDK 53 prebuild, the merge does not always include
// the MusicService entry — the result is that audio plays (because the
// native module is autolinked and callable from JS) but the foreground
// notification never appears, because Android refuses to start an
// undeclared service in foreground mode with a notification.
//
// Declaring the service explicitly here is safe even if the merger does
// pick it up — Android's manifest merger deduplicates by `android:name`.

const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'com.doublesymmetry.trackplayer.service.MusicService';

function ensureServiceDeclared(application) {
  application.service = application.service || [];
  const already = application.service.find(
    (s) => s && s.$ && s.$['android:name'] === SERVICE_NAME
  );
  if (already) return; // nothing to do — already there

  application.service.push({
    $: {
      'android:name': SERVICE_NAME,
      'android:enabled': 'true',
      'android:exported': 'true',
      'android:foregroundServiceType': 'mediaPlayback',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.intent.action.MEDIA_BUTTON' } },
        ],
      },
      {
        action: [
          { $: { 'android:name': 'androidx.media3.session.MediaSessionService' } },
        ],
      },
    ],
  });
}

module.exports = function withRNTPAndroidManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) {
      console.warn('[withRNTPAndroidManifest] <application> tag not found');
      return cfg;
    }
    ensureServiceDeclared(application);
    return cfg;
  });
};
