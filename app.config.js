const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const isAndroid = process.env.EAS_BUILD_PLATFORM === 'android';

// RevenueCat's Android SDK pulls in Google Play Billing, which transitively depends on
// play-services-code-scanner. That library's own manifest declares
// GmsBarcodeScanningDelegateActivity with a hardcoded PORTRAIT lock — Mya never uses
// barcode scanning at all, but Google's large-screen policy scan flags it anyway since
// it ships inside the final APK regardless. Override the inherited attribute via the
// standard Android manifest-merger tools:replace mechanism (there's no way to configure
// this from our own code otherwise — it's declared inside the library's AAR).
function withBarcodeScannerOrientationFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const application = manifest.application?.[0];
    if (!application) return config;

    const activityName = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
    application.activity = application.activity ?? [];
    const alreadyPresent = application.activity.some((a) => a.$['android:name'] === activityName);
    if (!alreadyPresent) {
      application.activity.push({
        $: {
          'android:name': activityName,
          'android:screenOrientation': 'unspecified',
          'tools:replace': 'android:screenOrientation',
        },
      });
    }

    return config;
  });
}

function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      if (!contents.includes('fmt_consteval_patch')) {
        // fmt 11.x enables consteval on Apple Clang 14+ but the consteval constructor for
        // basic_format_string is rejected by Apple Clang with "not a constant expression".
        // Two patches together fix this:
        //   1. base.h: change FMT_CONSTEVAL from consteval → constexpr so the constructor
        //      can be called from non-constant-expression contexts.
        //   2. compile.h: disable the compiled_string path so FMT_COMPILE expands to
        //      FMT_STRING (detail::compile_string base) rather than compiled_string.
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
  # fmt_consteval_patch: Apple Clang bug, consteval basic_format_string ctor is rejected
  fmt_base = "#{installer.sandbox.root}/fmt/include/fmt/base.h"
  if File.exist?(fmt_base)
    src = File.read(fmt_base)
    patched = src.gsub('#  define FMT_CONSTEVAL consteval', '#  define FMT_CONSTEVAL constexpr')
    if src != patched
      File.chmod(0644, fmt_base)
      File.write(fmt_base, patched)
    end
  end
  fmt_compile = "#{installer.sandbox.root}/fmt/include/fmt/compile.h"
  if File.exist?(fmt_compile)
    src = File.read(fmt_compile)
    patched = src.sub(
      '#if defined(__cpp_if_constexpr) && defined(__cpp_return_type_deduction)',
      '#if 0 // disabled: consteval FMT_COMPILE breaks Apple Clang'
    )
    if src != patched
      File.chmod(0644, fmt_compile)
      File.write(fmt_compile, patched)
    end
  end`
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
}

module.exports = {
  expo: {
    newArchEnabled: true,
    name: 'Mya',
    slug: 'mya',
    version: '1.1.0',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F97316',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.myaapp.app',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSHealthShareUsageDescription:
          'Mya reads your health data to help identify patterns that may relate to your ME/CFS symptoms, including post-exertional malaise.',
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['fetch', 'processing'],
        BGTaskSchedulerPermittedIdentifiers: ['MYA_HEALTH_SYNC'],
        // Explicit override, since the top-level `orientation` key was removed to
        // satisfy Android's large-screen policy — this preserves iOS's exact prior
        // portrait-only behavior (explicit infoPlist values take precedence over
        // the plugin's own generation).
        UISupportedInterfaceOrientations: [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationPortraitUpsideDown',
        ],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F97316',
      },
      package: 'com.myaapp.app',
      // Explicit rather than eas.json's autoIncrement, which doesn't reliably
      // write back into a dynamic (JS) app config. Bump by hand each Android build.
      versionCode: 1,
      // TODO: add once the Firebase project exists (see infra checklist)
      // ...(isAndroid && { googleServicesFile: './google-services.json' }),
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.WAKE_LOCK',
        // Health Connect requires a matching <uses-permission> for every record
        // type requested via requestPermission(), or it silently grants none
        // (no error, no dialog) — see PERMISSIONS in src/services/healthConnect.ts.
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_SLEEP',
        'android.permission.health.READ_HEART_RATE',
        'android.permission.health.READ_HEART_RATE_VARIABILITY',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_OXYGEN_SATURATION',
        'android.permission.health.READ_RESPIRATORY_RATE',
        'android.permission.health.READ_MINDFULNESS',
      ],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-localization',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#F97316',
        },
      ],
      // iOS-only plugins
      ...(!isAndroid ? [['expo-apple-authentication']] : []),
      ...(!isAndroid ? ['react-native-health'] : []),
      // Android-only: registers HealthConnectPermissionDelegate in MainActivity and
      // adds the required health permissions to AndroidManifest. Without it,
      // requestPermission() resolves with nothing granted instead of prompting.
      ...(isAndroid ? ['react-native-health-connect'] : []),
      'expo-background-fetch',
      'expo-task-manager',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'mya',
          organization: 'spondy',
        },
      ],
      '@react-native-community/datetimepicker',
      // iOS-only until the Android Firebase project exists (needs google-services.json,
      // see the TODO above) — unused in app code either way, no JS ever imports it.
      ...(!isAndroid ? ['@react-native-firebase/app'] : []),
      'expo-updates',
      [
        'expo-build-properties',
        {
          ios: {
            extraPods: [
              { name: 'GoogleUtilities', modular_headers: true },
            ],
          },
          android: {
            minSdkVersion: 26, // Health Connect requires API 26+
          },
        },
      ],
      withFmtFix,
      withBarcodeScannerOrientationFix,
    ],
    updates: {
      url: 'https://u.expo.dev/3e1d73b6-852e-402d-930a-c1a3f5da1c38',
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
    },
    // Bumped alongside the SDK 54 / New Architecture upgrade: OTA JS bundles built
    // against the new native modules (react-native-health-connect, reanimated 4,
    // etc.) must not be served to any device still running the pre-upgrade binary.
    runtimeVersion: '2.0.0',
    scheme: 'mya',
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: '3e1d73b6-852e-402d-930a-c1a3f5da1c38',
      },
    },
    owner: 'jbrockbanks-organization',
  },
};
