# Expo Go 连接问题修复指南

## 问题：扫码显示"未找到可用数据"

即使在同一 WiFi 下，Expo Go 扫码仍然无法连接。

## ⚠️ Apple 设备特别说明

对于 Apple 设备（iPhone/iPad），如果扫码无法连接，请按以下顺序尝试：

1. **首先尝试 Tunnel 模式**（最可靠）
2. **检查网络和防火墙设置**
3. **手动输入 URL**
4. **清除缓存并重启**

## 解决方案

### 方案 1：使用 Tunnel 模式（推荐）

Tunnel 模式通过 ngrok 创建隧道，可以绕过本地网络问题：

```bash
cd /Users/macbook/receipt-tracker
npx expo start --tunnel
```

或者：

```bash
npx expo start --host tunnel
```

### 方案 2：使用 LAN 模式并检查网络

1. **确保使用 LAN 模式**：
   ```bash
   npx expo start --lan
   ```

2. **检查 IP 地址**：
   - 确保电脑和手机在同一 WiFi 网络
   - 检查电脑的本地 IP 地址（在终端运行 `ifconfig` 或 `ipconfig`）
   - 确保 Expo 显示的 IP 地址正确

3. **检查防火墙**：
   - macOS：系统设置 > 网络 > 防火墙
   - 确保允许 Node.js 和 Expo 通过防火墙

### 方案 3：清除缓存并重启

```bash
# 清除缓存
npx expo start --clear

# 或者完全重启
# 1. 停止当前服务器（Ctrl+C）
# 2. 清除缓存
rm -rf .expo node_modules/.cache
# 3. 重新启动
npx expo start --tunnel
```

### 方案 4：手动输入 URL

如果二维码无法扫描，可以：

1. 在 Expo Go 中点击"Enter URL manually"
2. 输入终端显示的 URL（通常是 `exp://xxx.xxx.xxx.xxx:8081`）
3. 或者使用 tunnel URL（`exp://xxx.tunnel.exp.direct:80`）

## 常见问题排查

### 1. 检查端口是否被占用

```bash
# macOS/Linux
lsof -i :8081

# 如果端口被占用，可以指定其他端口
npx expo start --port 8082
```

### 2. 检查网络连接

```bash
# 检查电脑的 IP 地址
ifconfig | grep "inet " | grep -v 127.0.0.1

# 确保手机和电脑在同一网络
# 在手机上打开浏览器，访问 http://[电脑IP]:8081
```

### 3. 使用 localhost（仅限模拟器）

如果使用模拟器，可以使用 localhost 模式：

```bash
npx expo start --localhost
```

## 推荐配置

更新 `package.json` 的 start 脚本，默认使用 tunnel 模式：

```json
{
  "scripts": {
    "start": "expo start --tunnel",
    "start:lan": "expo start --lan",
    "start:localhost": "expo start --localhost"
  }
}
```

## 验证连接

启动后，终端会显示：
- QR Code（二维码）
- Connection options（连接选项）
- 确保选择正确的连接方式

## Apple 设备特殊处理

### 如果扫码仍然无法连接：

1. **完全关闭 Expo Go**：
   - 双击 Home 键（或从底部上滑）
   - 上滑关闭 Expo Go
   - 重新打开应用

2. **手动输入 URL**：
   - 在 Expo Go 中点击 "Enter URL manually"
   - 复制终端显示的完整 URL（包括 `exp://` 前缀）
   - 粘贴并连接

3. **检查手机网络**：
   - 确保 WiFi 已连接
   - 关闭 VPN（如果开启）
   - 关闭代理（如果开启）
   - 尝试切换到其他 WiFi 网络

4. **使用 Tunnel 模式**（推荐）：
   ```bash
   npx expo start --tunnel
   ```
   Tunnel 模式会显示一个更短的 URL，更容易手动输入

5. **检查 macOS 防火墙**：
   - 系统设置 > 网络 > 防火墙
   - 确保允许 Node.js 和 Terminal 通过
   - 或临时关闭防火墙测试

如果仍然无法连接，尝试：
1. 完全关闭 Expo Go 应用并重新打开
2. 重启开发服务器
3. 检查手机网络设置（确保没有使用 VPN 或代理）
4. 重启手机
