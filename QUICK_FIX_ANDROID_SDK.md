# 快速修复 Android SDK 路径问题

## 问题
```
Failed to resolve the Android SDK path. Default install location not found: /Users/macbook/Library/Android/sdk
Error: spawn adb ENOENT
```

## 快速解决方案

### 步骤 1：检查 Android SDK 是否已安装

```bash
ls ~/Library/Android/sdk
```

**如果目录不存在**，需要先安装 Android Studio（见步骤2）
**如果目录存在**，直接跳到步骤3配置环境变量

### 步骤 2：安装 Android Studio（如果未安装）

1. **下载 Android Studio**：
   - 访问：https://developer.android.com/studio
   - 下载 macOS 版本

2. **安装并首次启动**：
   - 打开下载的 `.dmg` 文件
   - 将 Android Studio 拖拽到 Applications
   - 启动 Android Studio，选择 "Standard" 安装
   - 等待 SDK 自动下载（10-20分钟）

3. **验证安装**：
   ```bash
   ls ~/Library/Android/sdk
   ```

### 步骤 3：配置环境变量

编辑 `~/.zshrc` 文件：

```bash
nano ~/.zshrc
```

在文件末尾添加：

```bash
# Android SDK 配置
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

保存文件（`Ctrl+O`，然后 `Enter`，然后 `Ctrl+X`）

重新加载配置：

```bash
source ~/.zshrc
```

### 步骤 4：验证配置

```bash
# 检查 ANDROID_HOME
echo $ANDROID_HOME
# 应该输出：/Users/macbook/Library/Android/sdk

# 检查 adb 是否可用
adb version
# 应该显示 adb 版本信息

# 检查 platform-tools 是否存在
ls $ANDROID_HOME/platform-tools
# 应该看到 adb 等工具
```

### 步骤 5：安装必要的 SDK 平台（如果需要）

在 Android Studio 中：

1. 打开 **Tools** → **SDK Manager**
2. 在 **SDK Platforms** 标签页：
   - 勾选 **Android 13.0 (Tiramisu)** 或更高版本
   - 点击 **Apply** 安装
3. 在 **SDK Tools** 标签页，确保已安装：
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator

### 步骤 6：重新运行命令

配置完成后，重新运行：

```bash
npx expo run:android
```

## 临时解决方案（仅当前终端会话）

如果不想修改 `~/.zshrc`，可以在当前终端会话中临时设置：

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# 然后运行
npx expo run:android
```

**注意**：这种方式只在当前终端会话有效，关闭终端后需要重新设置。

## 如果仍然有问题

### 检查 Android SDK 实际位置

Android Studio 可能将 SDK 安装在其他位置，检查：

```bash
# 检查常见位置
ls ~/Library/Android/sdk
ls ~/Android/Sdk
ls ~/.android/sdk

# 或者在 Android Studio 中查看：
# File → Settings → Appearance & Behavior → System Settings → Android SDK
# 查看 "Android SDK Location"
```

如果 SDK 在其他位置，更新 `ANDROID_HOME`：

```bash
# 例如，如果 SDK 在 ~/Android/Sdk
export ANDROID_HOME=$HOME/Android/Sdk
```

### 检查权限

确保有执行权限：

```bash
chmod +x $ANDROID_HOME/platform-tools/adb
```

## 替代方案：使用 EAS Build（云端构建）

如果不想配置本地 Android SDK，可以使用 EAS Build：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 构建 Android APK
eas build --platform android --profile development
```

这样就不需要本地 Android SDK 了。

## 验证修复

修复后，运行：

```bash
npx expo run:android
```

应该能够：
1. 找到 Android SDK
2. 连接到设备或启动模拟器
3. 构建并安装应用
