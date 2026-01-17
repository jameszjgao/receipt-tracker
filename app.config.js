export default {
  expo: {
    name: "VouCap",
    slug: "voucap",
    version: "1.3.0",
    owner: "aimlink",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "voucap", // 关键：解决邮件跳转的核心配置
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#ffffff",
      resizeMode: "contain"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.voucap.app",
      associatedDomains: ["applinks:voucap.app"]
    },
    android: {
      package: "com.voucap.app",
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
              host: "voucap.app",
              pathPrefix: "/"
            },
            {
              scheme: "voucap" // 允许通过 voucap:// 唤起
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
          "photosPermission": "VouCap needs access to your photo library.",
          "cameraPermission": "VouCap needs access to your camera."
        }
      ],
      ["expo-camera", { "cameraPermission": "VouCap needs access to your camera." }]
    ],
    // 这里通过扩展运算符引入 app.json 中的 projectId，保持同步
    extra: {
      eas: {
        projectId: "ab9f28b4-7d21-45e4-8c82-5d8cabfb2583"
      }
    }
  }
};