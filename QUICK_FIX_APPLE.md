# Apple 设备快速修复指南

## 问题：iPhone/iPad 扫码显示"未找到可用数据"

## 🚀 快速解决方案（按顺序尝试）

### 1. 使用 Tunnel 模式（最可靠）

```bash
cd /Users/macbook/receipt-tracker
npx expo start --tunnel --clear
```

**等待看到**：
- ✅ QR Code
- ✅ Tunnel URL（类似 `exp://xxx.tunnel.exp.direct:80`）

### 2. 手动输入 URL（如果二维码无法扫描）

1. 打开 Expo Go 应用
2. 点击底部的 **"Enter URL manually"**
3. 复制终端显示的完整 URL（包括 `exp://` 前缀）
4. 粘贴并点击 "Connect"

### 3. 完全重启 Expo Go

1. **完全关闭应用**：
   - iPhone X 及以后：从底部上滑，找到 Expo Go，上滑关闭
   - iPhone 8 及以前：双击 Home 键，上滑关闭 Expo Go
2. **重新打开 Expo Go**
3. **再次尝试扫描或手动输入 URL**

### 4. 检查网络设置

#### 在 iPhone 上：

1. 设置 > WiFi
2. 确保连接到与电脑相同的 WiFi
3. 点击 WiFi 名称旁边的 ⓘ
4. 确保 **"私有地址"** 已关闭（或尝试关闭再打开）
5. 确保没有使用 VPN 或代理

#### 在 Mac 上：

1. 系统设置 > 网络 > 防火墙
2. 点击"选项"
3. 确保允许 Node.js 和 Terminal 通过
4. 或临时关闭防火墙测试

### 5. 清除所有缓存

```bash
cd /Users/macbook/receipt-tracker

# 停止当前服务器（如果正在运行）
# 按 Ctrl+C

# 清除所有缓存
rm -rf .expo
rm -rf node_modules/.cache

# 重新启动（使用 tunnel 模式）
npx expo start --tunnel --clear
```

### 6. 检查 Expo Go 版本

1. 打开 App Store
2. 搜索 "Expo Go"
3. 确保使用最新版本
4. 如果不是最新，更新应用

### 7. 使用 LAN 模式（如果 Tunnel 太慢）

```bash
npx expo start --lan --clear
```

然后：
1. 确保手机和电脑在同一 WiFi
2. 在手机上打开浏览器，访问 `http://[电脑IP]:8081`
3. 如果无法访问，说明网络有问题

### 8. 检查终端输出

启动后，终端应该显示：

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press s │ switch to development build
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press o │ open project code in your editor
```

**如果没有看到这些信息**，说明服务器没有正确启动。

## 🔍 诊断步骤

### 检查 1：服务器是否运行

```bash
# 应该看到类似输出
curl http://localhost:8081
```

### 检查 2：网络连接

在 iPhone 浏览器中访问：
```
http://[你的电脑IP]:8081
```

如果无法访问，说明网络有问题。

### 检查 3：端口占用

```bash
lsof -i :8081
```

如果端口被占用，使用其他端口：
```bash
npx expo start --port 8082 --tunnel
```

## ✅ 成功标志

连接成功后，你应该看到：
- Expo Go 应用开始加载
- 显示 "Building JavaScript bundle..."
- 应用界面出现

## 📱 如果仍然无法连接

请提供以下信息：
1. 终端显示的完整 URL
2. Expo Go 显示的具体错误信息
3. 使用的连接模式（tunnel/lan）
4. 手机和电脑的网络配置
