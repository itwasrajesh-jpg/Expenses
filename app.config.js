export default {
  expo: {
    name: "Celestial's Expense Tracker",
    slug: "expense",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./splash.png",
      resizeMode: "contain",
      backgroundColor: "#0E0C14"
    },
    assetBundlePatterns: ["**/*"],
    android: {
      adaptiveIcon: {
        foregroundImage: "./adaptive-icon.png",
        backgroundColor: "#0E0C14"
      },
      package: "com.celestial.expensetracker",
      versionCode: 28,
      permissions: [
        "android.permission.VIBRATE",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        "android.permission.READ_MEDIA_IMAGES"
      ]
    },
    plugins: [
      "expo-local-authentication",
      "./withKotlinVersion",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.0.21",
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            minSdkVersion: 24,
            buildToolsVersion: "36.0.0"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "4577b2c7-b2f3-4705-9450-4a9dc56b2910"
      }
    }
  }
};
