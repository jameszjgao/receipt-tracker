# Android 开发环境安装指南

## 问题

运行 `npm run android` 时出现错误：
```
Failed to resolve the Android SDK path. ANDROID_HOME is set to a non-existing path
Error: spawn adb ENOENT
```

这是因为 Android SDK 尚未安装。

## 解决方案

### 方法 1：安装 Android Studio（推荐）

#### 步骤 1：下载并安装 Android Studio

1. **访问下载页面**：
   - https://developer.android.com/studio
   - 或直接下载：https://developer.android.com/studio/index.html

2. **下载 macOS 版本**：
   - 选择 "Download Android Studio"
   - 文件大小约 1GB

3. **安装**：
   - 打开下载的 `.dmg` 文件
   - 将 Android Studio 拖拽到 Applications 文件夹
   - 打开 Android Studio

#### 步骤 2：首次启动配置

1. **启动 Android Studio**：
   - 首次启动会显示设置向导
   - 选择 "Standard" 安装类型（推荐）

2. **安装 SDK 组件**：
   - Android Studio 会自动下载并安装：
     - Android SDK
     - Android SDK Platform-Tools
     - Android Emulator
   - 这可能需要 10-20 分钟

3. **完成设置向导**

#### 步骤 3：验证 SDK 安装

打开终端，运行：

```bash
ls ~/Library/Android/sdk
```

如果看到目录存在，说明 SDK 已安装。

#### 步骤 4：配置环境变量

编辑 `~/.zshrc` 文件：

```bash
nano ~/.zshrc
```

添加以下内容（如果还没有）：

```bash
# Android SDK 配置
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

保存并重新加载配置：

```bash
source ~/.zshrc
```

#### 步骤 5：验证安装

```bash
# 检查 adb 是否可用
adb version

# 检查 Android SDK 路径
echo $ANDROID_HOME
```

如果命令成功执行，说明配置正确。

#### 步骤 6：安装 Android SDK 平台

在 Android Studio 中：

1. 打开 **Tools** → **SDK Manager**
2. 在 **SDK Platforms** 标签页中：
   - 勾选 **Android 13.0 (Tiramisu)** 或最新版本
   - 勾选 **Show Package Details**
   - 确保安装了 **Android SDK Platform 33** 或更高版本
3. 在 **SDK Tools** 标签页中，确保安装了：
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator
   - ✅ Intel x86 Emulator Accelerator (HAXM installer)（如果使用 Intel Mac）
4. 点击 **Apply** 安装

### 方法 2：仅安装命令行工具（不推荐，但更轻量）

如果你不想安装完整的 Android Studio，可以只安装命令行工具：

```bash
# 创建 SDK 目录
mkdir -p ~/Library/Android/sdk

# 下载命令行工具
cd ~/Library/Android/sdk
curl -O https://dl.google.com/android/repository/commandlinetools-mac-9477386_latest.zip
unzip commandlinetools-mac-9477386_latest.zip
rm commandlinetools-mac-9477386_latest.zip

# 配置环境变量（已在 .zshrc 中配置）
source ~/.zshrc

# 安装 SDK 平台
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
```

**注意**：这种方法需要手动管理 SDK，不推荐新手使用。

## 测试 Android 构建

安装完成后，运行：

```bash
# 检查环境
echo $ANDROID_HOME
adb version

# 运行 Android 构建
npm run android
```

## 使用 Android 模拟器

### 创建虚拟设备

1. 打开 Android Studio
2. 点击 **Tools** → **Device Manager**
3. 点击 **Create Device**
4. 选择设备型号（如 Pixel 5）
5. 选择系统镜像（推荐 API 33 或更高）
6. 完成创建

### 启动模拟器

```bash
# 列出可用模拟器
emulator -list-avds

# 启动模拟器（替换 <avd_name> 为实际名称）
emulator -avd <avd_name>
```

或者直接在 Android Studio 中点击运行按钮。

## 使用物理设备

### 启用开发者选项

1. 打开手机的 **设置**
2. 找到 **关于手机**
3. 连续点击 **版本号** 7 次
4. 返回设置，找到 **开发者选项**
5. 启用 **USB 调试**

### 连接设备

1. 使用 USB 线连接手机到电脑
2. 在手机上允许 USB 调试
3. 验证连接：

```bash
adb devices
```

应该能看到你的设备。

## 常见问题

### 1. 仍然找不到 adb

**解决方案**：
```bash
# 检查路径是否正确
echo $ANDROID_HOME
ls $ANDROID_HOME/platform-tools/adb

# 如果路径不对，重新设置
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 2. 权限问题

如果 `adb` 命令提示权限不足：

```bash
chmod +x $ANDROID_HOME/platform-tools/adb
```

### 3. 模拟器启动失败

**Intel Mac**：
- 需要安装 HAXM（Android Studio 会自动安装）
- 如果失败，手动安装：https://github.com/intel/haxm/releases

**Apple Silicon (M1/M2) Mac**：
- 使用 ARM 版本的模拟器镜像
- 在创建 AVD 时选择 **ARM64** 系统镜像

### 4. 构建失败：找不到 SDK

**解决方案**：
```bash
# 确保环境变量已设置
source ~/.zshrc

# 验证路径
echo $ANDROID_HOME
ls $ANDROID_HOME
```

## 替代方案：使用 EAS Build（无需本地 Android 环境）

如果你不想在本地安装 Android 开发环境，可以使用 EAS Build：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 构建开发版本
eas build --platform android --profile development

# 构建完成后，下载 APK 安装到设备
# 然后运行开发服务器
npx expo start --dev-client
```

这样就不需要本地 Android SDK 了。

## 推荐配置

- **Android Studio 版本**：最新稳定版
- **Android SDK Platform**：API 33 或更高
- **Build Tools**：33.0.0 或更高
- **最低支持**：API 21 (Android 5.0)

## 下一步

安装完成后，继续本地测试：

```bash
# 预构建原生代码
npx expo prebuild --platform android

# 运行 Android 构建
npm run android

# 启动开发服务器（另一个终端）
npm start
```
