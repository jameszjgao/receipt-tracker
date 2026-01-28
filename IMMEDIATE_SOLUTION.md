# 立即解决方案

## 当前状态

- ✅ CocoaPods 已安装成功
- ❌ 模拟器无法启动
- ❌ CoreSimulator 服务问题

## 最快解决方案：使用真机设备

### 步骤 1：连接 iPhone

1. **使用 USB 线连接 iPhone 到 Mac**
2. **在 iPhone 上**：如果提示，点击 **"信任此电脑"**
3. **输入 iPhone 密码**（如果需要）

### 步骤 2：运行应用

```bash
npx expo run:ios --device
```

**优点**：
- ✅ 不需要模拟器
- ✅ 真实设备测试
- ✅ 通常更快
- ✅ 可以测试真实功能（相机、扫描等）

## 或者：修复模拟器

### 步骤 1：打开 Xcode

通过 Spotlight 搜索 "Xcode" 并打开

### 步骤 2：下载 iOS 运行时

1. **Xcode → Settings**（或 Preferences，`Cmd+,`）
2. **选择 "Platforms" 或 "Components" 标签**
3. **检查是否有 iOS 运行时**（如 iOS 17.0）
4. **如果没有，点击 "Get" 下载**
5. **等待下载完成**

### 步骤 3：启动模拟器

1. **Xcode → Window → Devices and Simulators**（`Cmd+Shift+2`）
2. **选择 "Simulators" 标签**
3. **选择一个设备**（如 iPhone 15 Pro）
4. **点击 "Boot" 启动**
5. **等待模拟器启动**

### 步骤 4：运行应用

```bash
npx expo run:ios
```

## 推荐操作

**立即执行**（最快）：

```bash
# 1. 连接 iPhone 到 Mac
# 2. 在 iPhone 上信任此电脑
# 3. 运行
npx expo run:ios --device
```

**或者**（如果想用模拟器）：

1. 打开 Xcode
2. 下载 iOS 运行时
3. 启动模拟器
4. 运行 `npx expo run:ios`

## 如果真机也无法识别

检查：

1. **iPhone 是否已解锁**
2. **是否点击了 "信任此电脑"**
3. **USB 连接是否正常**
4. **在 Xcode 中配置开发者账号**：
   - 打开 `ios/Vouchap.xcworkspace`
   - 项目 → Signing & Capabilities
   - 选择你的 Team（如果没有，需要注册 Apple Developer 账号，免费）

## 总结

**推荐**：使用真机设备（最快、最简单）

```bash
npx expo run:ios --device
```

如果真机有问题，再修复模拟器。
