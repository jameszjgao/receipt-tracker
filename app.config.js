export default {
  expo: {
    name: 'Snap Receipt',
    slug: 'snap-receipt',
    version: '1.1.2',
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
      versionCode: 5,
      usesCleartextTraffic: true,
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
        'ACCESS_NETWORK_STATE',
        'INTERNET',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff',
      },
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
      eas: {
        projectId: "b9f86f38-62c6-4bf1-849b-aadccf272d7d"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    },
  },
};

