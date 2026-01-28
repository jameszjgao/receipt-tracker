# 解决 "No iOS devices available in Simulator.app" 错误

## 问题

```
CommandError: No iOS devices available in Simulator.app
```

**原因**：没有可用的 iOS 模拟器，或者模拟器没有启动。

## 解决方案

### 方案 1：手动启动模拟器（推荐）

#### 步骤 1：打开模拟器

```bash
# 打开 iOS 模拟器
open -a Simulator
```

#### 步骤 2：等待模拟器启动

模拟器启动后，会显示一个 iPhone 界面。

#### 步骤 3：重新运行

```bash
npx expo run:ios
```

### 方案 2：列出并选择特定模拟器

#### 步骤 1：查看可用的模拟器

```bash
# 列出所有可用的模拟器
xcrun simctl list devices available
```

#### 步骤 2：启动特定模拟器

```bash
# 启动特定模拟器（替换 DEVICE_ID 为实际 ID）
xcrun simctl boot DEVICE_ID

# 或直接打开模拟器应用
open -a Simulator
```

#### 步骤 3：运行应用

```bash
# 指定模拟器运行
npx expo run:ios --simulator="iPhone 15 Pro"

# 或让 Expo 自动选择
npx expo run:ios
```

### 方案 3：创建新的模拟器（如果没有可用）

#### 步骤 1：查看可用的设备类型

```bash
xcrun simctl list devicetypes
```

#### 步骤 2：创建新模拟器

```bash
# 创建 iPhone 15 Pro 模拟器
xcrun simctl create "iPhone 15 Pro" "iPhone 15 Pro" "iOS17.0"

# 查看可用的运行时版本
xcrun simctl list runtimes
```

#### 步骤 3：启动新创建的模拟器

```bash
# 启动模拟器
open -a Simulator

# 在模拟器中选择：File → Open Simulator → 选择刚创建的设备
```

### 方案 4：使用 Xcode 创建模拟器

1. **打开 Xcode**
2. **Xcode → Settings → Platforms**（或 **Components**）
3. **下载 iOS 运行时**（如果还没有）
4. **Xcode → Window → Devices and Simulators**
5. **点击 "+" 创建新模拟器**
6. **选择设备类型和 iOS 版本**
7. **创建并启动**

## 快速修复步骤

### 最简单的方法：

```bash
# 1. 打开模拟器
open -a Simulator

# 2. 等待模拟器完全启动（看到 iPhone 界面）

# 3. 运行应用
npx expo run:ios
```

### 如果还是不行：

```bash
# 1. 列出所有设备
xcrun simctl list devices

# 2. 启动一个可用的设备
xcrun simctl boot "iPhone 15 Pro"

# 3. 打开模拟器应用
open -a Simulator

# 4. 运行应用
npx expo run:ios --simulator="iPhone 15 Pro"
```

## 检查模拟器状态

### 查看所有设备

```bash
xcrun simctl list devices
```

### 查看可用的设备

```bash
xcrun simctl list devices available
```

### 查看已启动的设备

```bash
xcrun simctl list devices | grep Booted
```

## 常见问题

### Q: 模拟器启动很慢

**A:** 首次启动需要一些时间，这是正常的。等待模拟器完全启动后再运行应用。

### Q: 没有可用的 iOS 运行时

**A:** 需要下载 iOS 运行时：

1. 打开 Xcode
2. Xcode → Settings → Platforms
3. 下载需要的 iOS 版本

### Q: 模拟器启动后立即关闭

**A:** 可能是系统资源不足，尝试：

```bash
# 关闭其他应用
# 重启 Mac
# 或使用更轻量的模拟器（如 iPhone SE）
```

### Q: 指定模拟器运行

**A:** 

```bash
# 列出可用模拟器
xcrun simctl list devices available

# 使用特定模拟器
npx expo run:ios --simulator="iPhone 15 Pro"
```

## 验证修复

运行以下命令验证：

```bash
# 1. 检查模拟器是否运行
xcrun simctl list devices | grep Booted

# 2. 如果看到设备，说明模拟器已启动
# 3. 运行应用
npx expo run:ios
```

## 使用真机设备（替代方案）

如果模拟器有问题，可以使用真机：

```bash
# 1. 连接 iPhone 到 Mac（USB）
# 2. 在 iPhone 上信任此电脑
# 3. 运行
npx expo run:ios --device
```

## 总结

最简单的解决方法：

```bash
# 1. 打开模拟器
open -a Simulator

# 2. 等待启动完成

# 3. 运行应用
npx expo run:ios
```

如果还是不行，检查是否有可用的 iOS 运行时，或使用 Xcode 创建新的模拟器。
