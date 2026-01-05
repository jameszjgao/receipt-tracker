export default {
  expo: {
    name: 'Snap Receipt',
    slug: 'snap-receipt',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      backgroundColor: '#ffffff',
      resizeMode: 'contain',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.snapreceipt.app',
      associatedDomains: ['applinks:snapreceipt.app'],
    },
    android: {
      package: 'com.snapreceipt.app',
      versionCode: 1,
      permissions: ['CAMERA'],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'snapreceipt.app',
              pathPrefix: '/',
            },
            {
              scheme: 'snapreceipt',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
    },
    plugins: [
      'expo-font',
      [
        'expo-image-picker',
        {
          photosPermission: 'Snap Receipt needs access to your photo library to select receipt images.',
          cameraPermission: 'Snap Receipt needs access to your camera to capture receipts.',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Snap Receipt needs access to your camera to capture receipts.',
        },
      ],
    ],
    scheme: 'snapreceipt',
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
    },
  },
};

