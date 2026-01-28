# 本地构建指南

本指南说明如何在本地构建应用，而不使用 Expo 的在线构建服务。

## 前置条件

### iOS (macOS)
- ✅ Xcode 已安装（从 App Store 安装）
- ✅ CocoaPods 已安装：`sudo gem install cocoapods`
- ✅ iOS 模拟器或真机

### Android
- ✅ Android Studio 已安装
- ✅ Android SDK 已配置（`ANDROID_HOME` 环境变量）
- ✅ Java Development Kit (JDK) 已安装
- ✅ Android 模拟器或真机（通过 USB 连接）

## 步骤 1: 确保原生代码是最新的

在开始构建之前，确保原生代码与 `app.config.js` 同步：

```bash
# 清理并重新生成原生代码
npm run prebuild:clean

# 或者只更新（不清理）
npm run prebuild
```

## 步骤 2: iOS 本地构建

### 2.1 安装 CocoaPods 依赖

```bash
cd ios
pod install
cd ..
```

### 2.2 构建并运行

**选项 A: 使用 Expo CLI（推荐）**
```bash
# 构建并运行在模拟器
npm run ios

# 或者指定设备
npx expo run:ios --device

# 或者指定模拟器
npx expo run:ios --simulator="iPhone 15 Pro"
```

**选项 B: 使用 Xcode**
1. 打开 `ios/Vouchap.xcworkspace`（注意是 `.xcworkspace`，不是 `.xcodeproj`）
2. 选择目标设备（模拟器或真机）
3. 点击运行按钮（▶️）或按 `Cmd + R`

### 2.3 构建开发版本（Development Build）

开发版本包含 `expo-dev-client`，可以热重载：

```bash
# 构建开发版本
npx expo run:ios --configuration Debug
```

### 2.4 构建发布版本（Release Build）

```bash
# 构建发布版本
npx expo run:ios --configuration Release
```

## 步骤 3: Android 本地构建

### 3.1 检查 Android 环境

```bash
# 检查 Android SDK 路径
echo $ANDROID_HOME

# 检查 adb 是否可用
adb version
```

如果 `ANDROID_HOME` 未设置，请参考 `FIX_ANDROID_SDK_NOW.md` 进行配置。

### 3.2 构建并运行

**选项 A: 使用 Expo CLI（推荐）**
```bash
# 构建并运行在连接的设备/模拟器
npm run android

# 或者使用完整命令
npx expo run:android

# 指定设备
npx expo run:android --device
```

**选项 B: 使用 Android Studio**
1. 打开 `android` 目录
2. 等待 Gradle 同步完成
3. 选择目标设备（模拟器或真机）
4. 点击运行按钮（▶️）或按 `Shift + F10`

### 3.3 构建开发版本 APK

```bash
# 构建开发版本 APK
cd android
./gradlew assembleDebug
cd ..

# APK 位置：android/app/build/outputs/apk/debug/app-debug.apk
```

### 3.4 构建发布版本 APK

```bash
# 构建发布版本 APK（需要签名配置）
cd android
./gradlew assembleRelease
cd ..

# APK 位置：android/app/build/outputs/apk/release/app-release.apk
```

## 步骤 4: 运行开发服务器

构建完成后，启动 Expo 开发服务器：

```bash
# 使用开发客户端模式
npm start

# 或者指定网络模式
npm run start:lan    # 局域网模式
npm run start:localhost  # 仅本地
```

应用会自动连接到开发服务器，支持热重载。

## 常见问题

### iOS 构建失败

1. **CocoaPods 问题**
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   ```

2. **Xcode 缓存问题**
   - 在 Xcode 中：`Product > Clean Build Folder` (Shift + Cmd + K)
   - 删除 `ios/build` 目录

3. **模拟器问题**
   ```bash
   # 重启 CoreSimulatorService
   sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService
   ```

### Android 构建失败

1. **Gradle 同步失败**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

2. **SDK 路径问题**
   - 检查 `ANDROID_HOME` 环境变量
   - 检查 `android/local.properties` 文件

3. **依赖问题**
   ```bash
   cd android
   ./gradlew --refresh-dependencies
   cd ..
   ```

### 应用无法连接到开发服务器

1. **检查网络**
   ```bash
   # 确保设备和电脑在同一网络（局域网模式）
   npm run start:lan
   ```

2. **检查防火墙**
   - 确保防火墙允许 Expo 开发服务器端口（默认 8081）

3. **使用隧道模式**（如果局域网不可用）
   ```bash
   npx expo start --tunnel
   ```

## 构建配置说明

### 开发版本 vs 发布版本

- **开发版本（Debug）**：
  - 包含调试信息
  - 可以连接到 Expo 开发服务器
  - 支持热重载
  - 体积较大，运行较慢

- **发布版本（Release）**：
  - 代码已优化
  - 不包含调试信息
  - 体积较小，运行较快
  - 适合测试和分发

### 构建产物位置

**iOS:**
- 开发版本：`ios/build/Build/Products/Debug-iphonesimulator/Vouchap.app`
- 发布版本：`ios/build/Build/Products/Release-iphonesimulator/Vouchap.app`

**Android:**
- 开发版本 APK：`android/app/build/outputs/apk/debug/app-debug.apk`
- 发布版本 APK：`android/app/build/outputs/apk/release/app-release.apk`

## 下一步

构建完成后，你可以：
1. 在设备上测试应用
2. 使用 `npm start` 启动开发服务器进行热重载
3. 构建发布版本用于分发

## 参考文档

- [Expo 本地构建文档](https://docs.expo.dev/build/introduction/)
- [React Native 构建文档](https://reactnative.dev/docs/signed-apk-android)
- iOS 构建问题：参考 `FIX_IOS_SIMULATOR.md`
- Android 构建问题：参考 `FIX_ANDROID_SDK_NOW.md`
