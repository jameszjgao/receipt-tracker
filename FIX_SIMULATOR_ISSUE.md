# 修复模拟器问题

## 当前问题

1. ❌ CoreSimulator 服务无法连接
2. ❌ Simulator.app 无法启动（缺少可执行文件）
3. ❌ 没有可用的 iOS 模拟器

## 可能的原因

- Xcode 安装不完整
- iOS 运行时未下载
- 模拟器服务损坏

## 解决方案

### 方案 1：重新安装 iOS 运行时（推荐）

1. **打开 Xcode**（通过 Spotlight 搜索 "Xcode"）
2. **Xcode → Settings**（或 Preferences）
3. **选择 "Platforms" 或 "Components" 标签**
4. **检查是否有 iOS 运行时**
5. **如果没有，点击 "Get" 下载**
6. **等待下载完成**（可能需要一些时间）

### 方案 2：使用真机设备（最快）

如果模拟器一直有问题，使用真机：

```bash
# 1. 连接 iPhone 到 Mac（USB）
# 2. 在 iPhone 上信任此电脑（如果提示）
# 3. 运行
npx expo run:ios --device
```

**优点**：
- ✅ 不需要模拟器
- ✅ 真实设备测试
- ✅ 通常更快

### 方案 3：重新安装 Xcode（如果以上都不行）

如果 Xcode 安装不完整：

1. **从 App Store 重新安装 Xcode**
2. **或从 Apple Developer 网站下载**
3. **确保完整安装**（包括 Command Line Tools）

### 方案 4：使用 EAS Build（云端构建）

如果本地环境一直有问题：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 云端构建（不需要本地模拟器）
eas build --platform ios --profile development
```

## 立即操作建议

### 推荐：使用真机设备

这是最快的解决方案：

```bash
# 1. 连接 iPhone 到 Mac
# 2. 在 iPhone 上点击 "信任此电脑"
# 3. 运行
npx expo run:ios --device
```

### 或者：修复模拟器

1. **打开 Xcode**（通过 Spotlight）
2. **Xcode → Settings → Platforms**
3. **下载 iOS 运行时**
4. **等待下载完成**
5. **重新尝试启动模拟器**

## 检查 Xcode 安装

运行以下命令检查：

```bash
# 检查 Xcode 路径
xcode-select -p

# 检查 Xcode 版本
xcodebuild -version

# 检查 Command Line Tools
xcode-select --install
```

## 验证修复

修复后，尝试：

```bash
# 尝试列出设备
xcrun simctl list devices

# 如果成功，运行应用
npx expo run:ios
```

## 总结

**最快的解决方案**：使用真机设备

```bash
npx expo run:ios --device
```

**长期解决方案**：修复模拟器
1. 打开 Xcode
2. 下载 iOS 运行时
3. 重新启动模拟器
