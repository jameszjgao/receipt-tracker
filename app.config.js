export default {
  expo: {
    name: "Vouchap",
    slug: "vouchap",
    version: "1.4.0",
    owner: "aimlink",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "vouchap", // 关键：解决邮件跳转的核心配置
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#ffffff",
      resizeMode: "contain"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.vouchap.app",
      associatedDomains: ["applinks:vouchap.app"]
    },
    android: {
      package: "com.vouchap.app",
      versionCode: 5,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "ACCESS_NETWORK_STATE",
        "INTERNET"
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "vouchap.app",
              pathPrefix: "/"
            },
            {
              scheme: "vouchap" // 允许通过 vouchap:// 唤起
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    plugins: [
      [
        "expo-image-picker",
        {
          "photosPermission": "Vouchap needs access to your photo library.",
          "cameraPermission": "Vouchap needs access to your camera."
        }
      ],
      ["expo-camera", { "cameraPermission": "Vouchap needs access to your camera." }]
    ],
    // 这里通过扩展运算符引入 app.json 中的 projectId，保持同步
    extra: {
      eas: {
        projectId: "f98c5cea-fd51-41e3-9c9c-1512c6b1a8e7"
      }
    }
  }
};