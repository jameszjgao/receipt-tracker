# 修复 CoreSimulator 服务问题

## 问题

```
CoreSimulatorService connection became invalid
Connection refused
Unable to locate device set
```

**原因**：CoreSimulator 服务崩溃或未启动。

## 解决方案

### 方案 1：重启 CoreSimulator 服务（推荐）

```bash
# 1. 关闭所有模拟器和服务
killall -9 com.apple.CoreSimulator.CoreSimulatorService
killall -9 Simulator
killall -9 com.apple.CoreSimulator.simctl

# 2. 等待几秒
sleep 3

# 3. 通过 Xcode 启动模拟器（这会自动启动服务）
open -a Xcode

# 4. 在 Xcode 中：Window → Devices and Simulators
# 5. 点击 "+" 创建或选择一个模拟器
# 6. 启动模拟器
```

### 方案 2：使用 Xcode 启动模拟器

1. **打开 Xcode**
2. **Xcode → Window → Devices and Simulators**（或按 `Cmd+Shift+2`）
3. **选择或创建一个模拟器**
4. **点击 "Boot" 启动**
5. **等待模拟器启动完成**
6. **运行应用**：
   ```bash
   npx expo run:ios
   ```

### 方案 3：重启 Mac（如果以上都不行）

如果服务完全无法启动，可能需要重启 Mac：

```bash
# 重启 Mac
sudo reboot
```

重启后：
1. 打开 Xcode
2. 启动模拟器
3. 运行应用

### 方案 4：重置模拟器服务

```bash
# 1. 关闭所有相关进程
killall -9 com.apple.CoreSimulator.CoreSimulatorService
killall -9 Simulator

# 2. 删除模拟器数据（谨慎：会删除所有模拟器数据）
# rm -rf ~/Library/Developer/CoreSimulator/Devices

# 3. 重启服务（通过启动 Xcode）
open -a Xcode
```

### 方案 5：使用真机设备（临时方案）

如果模拟器一直有问题，可以使用真机：

```bash
# 1. 连接 iPhone 到 Mac（USB）
# 2. 在 iPhone 上信任此电脑
# 3. 运行
npx expo run:ios --device
```

## 快速修复步骤

### 步骤 1：重启服务

```bash
# 关闭所有相关进程
killall -9 com.apple.CoreSimulator.CoreSimulatorService
killall -9 Simulator
killall -9 com.apple.CoreSimulator.simctl

# 等待
sleep 3
```

### 步骤 2：通过 Xcode 启动

```bash
# 打开 Xcode
open -a Xcode
```

然后在 Xcode 中：
1. **Window → Devices and Simulators**（`Cmd+Shift+2`）
2. 选择一个模拟器
3. 点击 **"Boot"** 启动
4. 等待模拟器完全启动

### 步骤 3：运行应用

```bash
npx expo run:ios
```

## 验证修复

运行以下命令检查服务是否正常：

```bash
# 检查服务是否运行
ps aux | grep CoreSimulator

# 尝试列出设备（如果服务正常，应该能列出）
xcrun simctl list devices 2>&1 | head -20
```

如果还是报错，继续使用 Xcode 启动模拟器。

## 预防措施

### 定期清理模拟器

```bash
# 删除未使用的模拟器
xcrun simctl delete unavailable

# 清理模拟器数据（谨慎使用）
xcrun simctl erase all
```

### 保持 Xcode 更新

确保使用最新版本的 Xcode，避免兼容性问题。

## 如果问题持续

如果以上方法都不行，可能需要：

1. **重新安装 Xcode**（从 App Store）
2. **检查系统权限**：系统设置 → 隐私与安全性 → 开发者工具
3. **联系 Apple 支持**

## 总结

最简单的解决方法：

1. **关闭所有相关进程**
2. **打开 Xcode**
3. **通过 Xcode 启动模拟器**（Window → Devices and Simulators）
4. **运行应用**

Xcode 会自动启动 CoreSimulator 服务。
