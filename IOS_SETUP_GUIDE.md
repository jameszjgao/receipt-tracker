# iOS 构建环境安装指南

## 前置要求

iOS 应用只能在 **macOS** 上构建。需要以下工具：

1. ✅ **Xcode**（从 App Store 安装，约 12GB）
2. ✅ **CocoaPods**（Ruby gem，用于管理 iOS 依赖）
3. ✅ **Command Line Tools**（Xcode 的一部分）

## 安装步骤

### 步骤 1：安装 Xcode

#### 方法 A：从 App Store 安装（推荐）

1. **打开 App Store**
2. **搜索 "Xcode"**
3. **点击 "获取" 或 "安装"**
   - 文件大小约 12GB，下载需要较长时间（30分钟-2小时，取决于网速）
4. **等待下载和安装完成**

#### 方法 B：从 Apple Developer 网站下载

1. 访问：https://developer.apple.com/xcode/
2. 登录 Apple ID（需要免费注册）
3. 下载最新版本的 Xcode

#### 验证 Xcode 安装

```bash
# 检查 Xcode 路径
xcode-select -p
# 应该输出：/Applications/Xcode.app/Contents/Developer

# 检查 Xcode 版本
xcodebuild -version
# 应该显示版本号，例如：Xcode 15.0
```

### 步骤 2：安装 Command Line Tools

Xcode 安装后，需要安装 Command Line Tools：

```bash
# 安装 Command Line Tools
xcode-select --install
```

如果提示 "command line tools are already installed"，说明已安装。

### 步骤 3：接受 Xcode 许可协议

首次使用 Xcode 需要接受许可协议：

```bash
sudo xcodebuild -license accept
```

或者打开 Xcode，首次启动时会提示接受许可协议。

### 步骤 4：安装 CocoaPods

CocoaPods 是 iOS 依赖管理工具，使用 Ruby 的 gem 安装：

```bash
# 安装 CocoaPods
sudo gem install cocoapods
```

**如果遇到权限问题**，可以使用用户目录安装：

```bash
# 安装到用户目录（推荐）
gem install cocoapods --user-install

# 添加到 PATH（如果使用 --user-install）
echo 'export PATH="$HOME/.gem/ruby/3.0.0/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### 验证 CocoaPods 安装

```bash
pod --version
# 应该显示版本号，例如：1.14.3
```

### 步骤 5：配置项目

#### 5.1 安装 npm 依赖

```bash
cd /Users/macbook/Vouchap
npm install
```

#### 5.2 预构建 iOS 原生代码

```bash
npx expo prebuild --platform ios
```

这会生成 `ios/` 目录和原生代码（如果还没有）。

#### 5.3 安装 CocoaPods 依赖

```bash
cd ios
pod install
cd ..
```

**注意**：如果 `pod install` 失败，可能需要先更新 CocoaPods：

```bash
# 更新 CocoaPods
sudo gem update cocoapods

# 或者如果使用 --user-install
gem update cocoapods --user-install
```

### 步骤 6：运行 iOS 应用

#### 方式 1：使用 iOS 模拟器（推荐用于开发）

```bash
# 运行并自动选择模拟器
npx expo run:ios

# 或指定模拟器
npx expo run:ios --simulator="iPhone 15 Pro"
```

#### 方式 2：使用真机设备

1. **连接 iPhone 到 Mac**（使用 USB 线）
2. **在 iPhone 上信任此电脑**（如果提示）
3. **在 Xcode 中配置开发者账号**：
   - 打开 `ios/Vouchap.xcworkspace`（注意是 `.xcworkspace`，不是 `.xcodeproj`）
   - 在 Xcode 中：**Signing & Capabilities** → 选择你的 **Team**
   - 如果没有 Team，需要注册 Apple Developer 账号（免费）
4. **运行**：
   ```bash
   npx expo run:ios --device
   ```

### 步骤 7：启动开发服务器

在另一个终端窗口：

```bash
npx expo start --dev-client
```

应用会自动连接到开发服务器，支持热重载。

## 常见问题

### 问题 1：`xcode-select: error: developer directory not found`

**解决方案**：
```bash
# 设置 Xcode 路径
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# 验证
xcode-select -p
```

### 问题 2：`pod: command not found`

**解决方案**：
```bash
# 如果使用 --user-install，添加到 PATH
echo 'export PATH="$HOME/.gem/ruby/$(ruby -e "puts RUBY_VERSION[/\d+\.\d+/]")/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 或使用系统安装
sudo gem install cocoapods
```

### 问题 3：`pod install` 失败 - 权限错误

**解决方案**：
```bash
# 使用用户目录安装
gem install cocoapods --user-install

# 或修复权限
sudo chown -R $(whoami) ~/.cocoapods
```

### 问题 4：`pod install` 失败 - 网络错误

**解决方案**：
```bash
# 更新 CocoaPods 仓库
pod repo update

# 或清理并重新安装
cd ios
rm -rf Pods Podfile.lock
pod install
```

### 问题 5：Xcode 版本不兼容

**解决方案**：
- 确保使用最新版本的 Xcode
- 检查项目要求的 Xcode 最低版本（通常在 `ios/Podfile` 中）

### 问题 6：模拟器无法启动

**解决方案**：
```bash
# 列出可用的模拟器
xcrun simctl list devices

# 手动启动模拟器
open -a Simulator

# 然后运行
npx expo run:ios
```

### 问题 7：真机设备无法识别

**解决方案**：
1. 确保 iPhone 已解锁
2. 在 iPhone 上点击 "信任此电脑"
3. 检查 USB 连接
4. 在 Xcode 中配置开发者账号和签名

## 验证安装

运行以下命令验证所有工具已正确安装：

```bash
# 检查 Xcode
xcode-select -p && xcodebuild -version

# 检查 CocoaPods
pod --version

# 检查 Node.js 和 npm
node --version && npm --version

# 检查 Expo CLI
npx expo --version
```

所有命令都应该成功执行并显示版本号。

## 开发工作流

### 日常开发

1. **启动开发服务器**：
   ```bash
   npx expo start --dev-client
   ```

2. **在另一个终端运行应用**：
   ```bash
   npx expo run:ios
   ```

3. **修改代码后**，应用会自动热重载

### 添加新的原生依赖

如果添加了新的原生依赖（如 `react-native-document-scanner-plugin`）：

1. **安装 npm 包**：
   ```bash
   npm install <package-name>
   ```

2. **重新预构建**：
   ```bash
   npx expo prebuild --platform ios --clean
   ```

3. **重新安装 CocoaPods 依赖**：
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **重新运行**：
   ```bash
   npx expo run:ios
   ```

## 清理构建

如果遇到构建问题，可以清理后重新构建：

```bash
# 清理 iOS 构建
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..

# 清理 Expo 缓存
npx expo prebuild --platform ios --clean
```

## 下一步

安装完成后，可以：

1. ✅ 运行 `npx expo run:ios` 构建并运行应用
2. ✅ 测试登录和 space 识别功能
3. ✅ 测试创建新 space
4. ✅ 查看应用日志确认问题已解决

## 需要帮助？

如果遇到问题，请提供：
- 错误信息的完整输出
- `xcodebuild -version` 的输出
- `pod --version` 的输出
- 具体的操作步骤
