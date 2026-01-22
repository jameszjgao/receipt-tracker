# 本地测试指南（使用原生模块）

由于项目使用了原生模块（`react-native-document-scanner-plugin`），无法在 Expo Go 中测试，需要使用开发构建。

## 方法 1：本地开发构建（推荐，快速测试）

### 前置要求

1. **Android 开发环境**：
   - 安装 Android Studio
   - 配置 Android SDK
   - 设置 `ANDROID_HOME` 环境变量

2. **iOS 开发环境**（仅 macOS）：
   - 安装 Xcode
   - 安装 CocoaPods：`sudo gem install cocoapods`

### Android 本地构建步骤

#### 1. 安装依赖

```bash
npm install
# 或
yarn install
```

#### 2. 预构建原生代码

```bash
npx expo prebuild --platform android
```

这会生成 `android/` 目录和原生代码。

#### 3. 运行开发构建

```bash
# 方式 1：使用 Expo CLI（推荐）
npx expo run:android

# 方式 2：直接使用 Gradle
cd android
./gradlew installDebug
```

#### 4. 启动开发服务器

在另一个终端窗口：

```bash
npx expo start --dev-client
```

应用会自动连接到开发服务器，支持热重载。

### iOS 本地构建步骤（仅 macOS）

#### 1. 安装依赖

```bash
npm install
```

#### 2. 预构建原生代码

```bash
npx expo prebuild --platform ios
```

#### 3. 安装 CocoaPods 依赖

```bash
cd ios
pod install
cd ..
```

#### 4. 运行开发构建

```bash
npx expo run:ios
```

#### 5. 启动开发服务器

在另一个终端窗口：

```bash
npx expo start --dev-client
```

## 方法 2：EAS 开发构建（推荐用于团队协作）

### 前置要求

1. 安装 EAS CLI：
```bash
npm install -g eas-cli
```

2. 登录 EAS：
```bash
eas login
```

### 构建开发版本

#### Android

```bash
# 构建开发版本 APK
eas build --platform android --profile development

# 构建完成后，下载并安装到设备
# 然后运行开发服务器
npx expo start --dev-client
```

#### iOS

```bash
# 构建开发版本（需要 Apple Developer 账号）
eas build --platform ios --profile development

# 构建完成后，通过 TestFlight 或直接安装
# 然后运行开发服务器
npx expo start --dev-client
```

### 在设备上测试

1. **确保设备和电脑在同一网络**（或使用 USB 连接）

2. **启动开发服务器**：
```bash
npx expo start --dev-client
```

3. **在设备上打开应用**，它会自动连接到开发服务器

4. **扫描二维码**（如果需要）：
   - 开发服务器会显示二维码
   - 在开发客户端中扫描即可连接

## 方法 3：使用 Expo Go（仅测试非原生功能）

如果只想测试非原生功能（如图片选择、UI 等），可以在 Expo Go 中测试：

```bash
npx expo start --go
```

**注意**：原生扫描功能（`DocumentScanner.scanDocument()`）在 Expo Go 中不可用，会显示提示信息，但可以从相册选择图片。

## 常见问题

### 1. Android 构建失败：找不到 SDK

**解决方案**：
```bash
# 设置 Android SDK 路径
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

或在 `~/.zshrc` 或 `~/.bashrc` 中添加上述配置。

### 2. iOS 构建失败：CocoaPods 错误

**解决方案**：
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### 3. 开发服务器连接失败

**解决方案**：
- 确保设备和电脑在同一网络
- 检查防火墙设置
- 尝试使用 `--tunnel` 模式：
```bash
npx expo start --dev-client --tunnel
```

### 4. 原生模块未找到

**解决方案**：
- 确保运行了 `npx expo prebuild`
- 重新构建应用：
```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

## 开发工作流

### 日常开发流程

1. **启动开发服务器**：
```bash
npx expo start --dev-client
```

2. **修改代码**后，应用会自动热重载

3. **添加新的原生依赖**时：
```bash
# 1. 安装 npm 包
npm install <package-name>

# 2. 重新预构建
npx expo prebuild --clean

# 3. 重新运行
npx expo run:android  # 或 ios
```

### 清理构建

如果需要清理构建缓存：

```bash
# Android
cd android
./gradlew clean
cd ..

# iOS
cd ios
rm -rf build
pod deintegrate
pod install
cd ..
```

## 环境变量配置

### 本地开发

在项目根目录创建 `.env` 文件：

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

### EAS 构建

环境变量需要在 EAS Secrets 中配置（见 `EAS_SECRETS_SETUP.md`）。

## 推荐方案

- **快速本地测试**：使用方法 1（本地开发构建）
- **团队协作/CI/CD**：使用方法 2（EAS 构建）
- **仅测试 UI/非原生功能**：使用方法 3（Expo Go）

## 性能提示

- 首次构建可能需要 5-10 分钟
- 后续增量构建通常只需 1-2 分钟
- 使用 `--dev-client` 模式支持快速刷新，无需重新构建
