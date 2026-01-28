# 快速修复：No iOS devices available

## 问题

```
CommandError: No iOS devices available in Simulator.app
CoreSimulatorService connection became invalid
```

## 快速解决方案

### 方法 1：通过 Xcode 启动模拟器（最简单）

1. **打开 Xcode**（已为你启动）
2. **在 Xcode 中**：
   - 菜单：**Window → Devices and Simulators**
   - 或按快捷键：**`Cmd+Shift+2`**
3. **选择或创建一个模拟器**：
   - 点击左侧的 **"Simulators"** 标签
   - 选择一个设备（如 iPhone 15 Pro）
   - 点击 **"Boot"** 按钮启动
4. **等待模拟器启动**（会显示 iPhone 界面）
5. **运行应用**：
   ```bash
   npx expo run:ios
   ```

### 方法 2：直接打开模拟器应用

```bash
# 打开模拟器（通过 Xcode 路径）
open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app
```

等待模拟器启动后：

```bash
npx expo run:ios
```

### 方法 3：使用真机设备

如果模拟器一直有问题：

```bash
# 1. 连接 iPhone 到 Mac（USB）
# 2. 在 iPhone 上信任此电脑
# 3. 运行
npx expo run:ios --device
```

## 为什么会出现这个问题？

CoreSimulator 服务可能因为以下原因无法启动：
- 服务崩溃
- 权限问题
- Xcode 未完全启动

**通过 Xcode 启动模拟器会自动启动所有必要的服务。**

## 验证修复

模拟器启动后，运行：

```bash
# 检查模拟器是否运行
xcrun simctl list devices | grep Booted

# 如果看到设备，说明模拟器已启动
# 然后运行应用
npx expo run:ios
```

## 推荐操作

**立即执行**：

1. ✅ Xcode 已启动
2. 在 Xcode 中：**Window → Devices and Simulators**（`Cmd+Shift+2`）
3. 选择一个模拟器并点击 **"Boot"**
4. 等待模拟器启动
5. 运行：`npx expo run:ios`

## 如果还是不行

检查是否有 iOS 运行时：

1. **Xcode → Settings → Platforms**（或 **Components**）
2. 确保已下载 iOS 运行时
3. 如果没有，点击 **"Get"** 下载
