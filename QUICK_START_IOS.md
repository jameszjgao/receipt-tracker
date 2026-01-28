# iOS 快速开始指南

## ✅ 环境状态

根据检查，你的 iOS 构建环境已经**基本配置完成**：

- ✅ **Xcode 26.2** - 已安装
- ✅ **CocoaPods 1.16.2** - 已安装
- ✅ **Ruby 2.6.10** - 已安装
- ✅ **Node.js v24.12.0** - 已安装
- ✅ **npm 11.6.2** - 已安装
- ✅ **iOS 项目** - 已配置
- ✅ **Pods 依赖** - 已安装

## 🚀 立即运行 iOS 应用

### 方式 1：使用 iOS 模拟器（推荐）

```bash
# 运行应用（会自动选择模拟器）
npx expo run:ios

# 或指定特定模拟器
npx expo run:ios --simulator="iPhone 15 Pro"
```

### 方式 2：使用真机设备

1. **连接 iPhone 到 Mac**（使用 USB 线）
2. **在 iPhone 上信任此电脑**（如果提示）
3. **运行**：
   ```bash
   npx expo run:ios --device
   ```

### 方式 3：先启动开发服务器

在终端 1：
```bash
npx expo start --dev-client
```

在终端 2：
```bash
npx expo run:ios
```

## 📱 选择模拟器

如果不知道有哪些模拟器可用：

```bash
# 列出所有可用的模拟器
xcrun simctl list devices available

# 手动启动模拟器
open -a Simulator
```

## ⚠️ 可能需要的额外步骤

### 1. 接受 Xcode 许可协议

如果之前没有接受过：

```bash
sudo xcodebuild -license accept
```

### 2. 配置开发者账号（真机测试）

如果要在真机上测试：

1. 打开 `ios/Vouchap.xcworkspace`（注意是 `.xcworkspace`）
2. 在 Xcode 中：
   - 选择项目 → **Signing & Capabilities**
   - 选择你的 **Team**（如果没有，需要注册 Apple Developer 账号，免费）
   - 确保 **Bundle Identifier** 是 `com.vouchap.app`

### 3. 如果 Pods 需要更新

```bash
cd ios
pod install
cd ..
```

## 🔧 常见问题

### 问题 1：模拟器无法启动

```bash
# 手动启动模拟器
open -a Simulator

# 然后运行
npx expo run:ios
```

### 问题 2：构建失败 - 签名错误

```bash
# 在 Xcode 中配置签名
open ios/Vouchap.xcworkspace
# 然后：项目 → Signing & Capabilities → 选择 Team
```

### 问题 3：Pods 依赖问题

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### 问题 4：需要清理构建

```bash
# 清理 iOS 构建
cd ios
rm -rf build
cd ..

# 重新运行
npx expo run:ios
```

## 📝 开发工作流

### 日常开发

1. **启动开发服务器**（终端 1）：
   ```bash
   npx expo start --dev-client
   ```

2. **运行应用**（终端 2）：
   ```bash
   npx expo run:ios
   ```

3. **修改代码后**，应用会自动热重载

### 添加新的原生依赖

如果添加了新的原生依赖：

```bash
# 1. 安装 npm 包
npm install <package-name>

# 2. 重新预构建
npx expo prebuild --platform ios --clean

# 3. 重新安装 Pods
cd ios
pod install
cd ..

# 4. 重新运行
npx expo run:ios
```

## ✅ 验证安装

运行以下命令验证一切正常：

```bash
# 检查所有工具
xcodebuild -version
pod --version
node --version
npm --version
npx expo --version

# 运行应用
npx expo run:ios
```

## 🎯 下一步

环境已配置完成，现在可以：

1. ✅ 运行 `npx expo run:ios` 构建并运行应用
2. ✅ 测试登录和 space 识别功能
3. ✅ 测试创建新 space
4. ✅ 查看应用日志确认问题已解决

## 📚 相关文档

- `IOS_SETUP_GUIDE.md` - 完整的 iOS 安装指南
- `LOCAL_TESTING_GUIDE.md` - 本地测试指南
- `QR_CODE_FIX.md` - 二维码扫描问题解决方案
