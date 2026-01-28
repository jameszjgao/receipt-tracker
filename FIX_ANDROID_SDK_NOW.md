# 立即修复 Android SDK 问题

## 当前问题

1. ❌ `ANDROID_HOME` 指向错误位置（指向项目目录）
2. ❌ Android SDK 未安装（`~/Library/Android/sdk` 不存在）

## 快速解决方案

### 方案 1：使用 Expo Go（最快，无需 Android SDK）

如果想快速测试 UI 和基本功能：

```bash
# 启动 Expo Go 模式
npm run start:go

# 然后用 Expo Go 应用扫描二维码
```

**注意**：原生扫描功能在 Expo Go 中不可用，但可以测试其他功能。

### 方案 2：安装 Android Studio（完整功能）

如果需要测试完整功能（包括原生扫描）：

#### 步骤 1：下载并安装 Android Studio

1. **访问**：https://developer.android.com/studio
2. **下载 macOS 版本**（约 1GB）
3. **安装**：
   - 打开 `.dmg` 文件
   - 拖拽 Android Studio 到 Applications
   - 启动 Android Studio
   - 选择 "Standard" 安装
   - 等待 SDK 自动下载（10-20分钟）

#### 步骤 2：修复环境变量

编辑 `~/.zshrc`：

```bash
nano ~/.zshrc
```

**删除或注释掉错误的 ANDROID_HOME 配置**，然后添加：

```bash
# Android SDK 配置
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

保存并重新加载：

```bash
source ~/.zshrc
```

#### 步骤 3：验证

```bash
# 检查 ANDROID_HOME（应该指向 SDK 目录）
echo $ANDROID_HOME
# 应该输出：/Users/macbook/Library/Android/sdk

# 检查 adb
adb version
# 应该显示版本信息
```

#### 步骤 4：运行应用

```bash
npx expo run:android
```

### 方案 3：使用 EAS Build（云端构建，无需本地 SDK）

如果不想安装 Android Studio：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 云端构建（不需要本地 Android SDK）
eas build --platform android --profile development

# 构建完成后，下载 APK 并安装到设备
# 然后运行开发服务器
npx expo start --dev-client
```

## 临时修复（仅当前终端）

如果想立即测试，可以在当前终端临时设置：

```bash
# 先取消错误的配置
unset ANDROID_HOME

# 如果 Android SDK 已安装，设置正确的路径
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 检查
echo $ANDROID_HOME
adb version

# 如果 adb 可用，运行
npx expo run:android
```

**注意**：如果 Android SDK 未安装，这个不会工作，需要先安装 Android Studio。

## 推荐操作

### 如果想快速测试（推荐）

```bash
# 使用 Expo Go（最快）
npm run start:go
```

### 如果想测试完整功能

1. **安装 Android Studio**（见方案 2）
2. **修复环境变量**
3. **运行**：`npx expo run:android`

### 如果不想配置本地环境

```bash
# 使用 EAS Build（云端构建）
eas build --platform android --profile development
```

## 检查 Android SDK 是否已安装

```bash
# 检查默认位置
ls ~/Library/Android/sdk

# 如果目录存在，说明已安装，只需要修复环境变量
# 如果目录不存在，需要安装 Android Studio
```

## 总结

**最快方案**（无需安装）：
```bash
npm run start:go  # 使用 Expo Go
```

**完整功能方案**：
1. 安装 Android Studio
2. 修复环境变量
3. 运行 `npx expo run:android`

**云端构建方案**（无需本地 SDK）：
```bash
eas build --platform android --profile development
```
