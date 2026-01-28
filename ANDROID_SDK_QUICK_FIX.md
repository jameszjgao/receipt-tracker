# 快速修复 Android SDK 问题

## 当前错误

```
Failed to resolve the Android SDK path
Error: spawn adb ENOENT
```

**原因**：Android SDK 未安装或未配置环境变量。

## 解决方案

### 方案 1：安装 Android Studio（推荐，完整功能）

#### 步骤 1：下载并安装 Android Studio

1. **访问**：https://developer.android.com/studio
2. **下载 macOS 版本**
3. **安装**：打开 `.dmg` 文件，拖拽到 Applications
4. **首次启动**：选择 "Standard" 安装，等待 SDK 自动下载

#### 步骤 2：配置环境变量

编辑 `~/.zshrc`：

```bash
nano ~/.zshrc
```

添加以下内容：

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

#### 步骤 3：验证安装

```bash
# 检查 ANDROID_HOME
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

### 方案 2：使用 Expo Go（快速测试，无需 Android SDK）

如果只是想快速测试 UI，可以使用 Expo Go：

```bash
# 启动 Expo Go 模式
npm run start:go

# 然后用 Expo Go 应用扫描二维码
```

**注意**：原生扫描功能在 Expo Go 中不可用。

### 方案 3：使用 EAS Build（云端构建，无需本地 SDK）

如果不想安装 Android Studio：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 云端构建（不需要本地 Android SDK）
eas build --platform android --profile development
```

## 临时解决方案（仅当前终端会话）

如果不想修改 `~/.zshrc`，可以在当前终端临时设置：

```bash
# 临时设置（仅当前终端有效）
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# 然后运行
npx expo run:android
```

**注意**：关闭终端后需要重新设置。

## 检查 Android SDK 是否已安装

```bash
# 检查默认位置
ls ~/Library/Android/sdk

# 如果目录存在，说明 SDK 已安装，只需要配置环境变量
# 如果目录不存在，需要安装 Android Studio
```

## 推荐操作

### 如果想测试完整功能（包括原生扫描）

1. **安装 Android Studio**（见方案 1）
2. **配置环境变量**
3. **运行**：`npx expo run:android`

### 如果只想快速测试 UI

```bash
npm run start:go
# 然后用 Expo Go 扫描二维码
```

### 如果不想配置本地环境

```bash
# 使用 EAS Build（云端构建）
eas build --platform android --profile development
```

## 详细文档

参考 `QUICK_FIX_ANDROID_SDK.md` 获取完整的安装指南。

## 总结

**最快方案**（如果已安装 Android Studio）：
```bash
# 配置环境变量
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# 运行
npx expo run:android
```

**如果未安装 Android Studio**：
- 安装 Android Studio（方案 1）
- 或使用 Expo Go（方案 2）
- 或使用 EAS Build（方案 3）
