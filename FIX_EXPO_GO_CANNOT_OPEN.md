# 修复 Expo Go 无法打开问题

## 问题

Expo Go 应用无法打开或扫描后无法连接。

## 当前状态

- ✅ 开发服务器正在运行（端口 8081）
- ✅ 有多个 Expo 进程在运行
- ❌ Expo Go 无法打开或连接

## 解决方案

### 方案 1：使用 Tunnel 模式（最可靠）

Tunnel 模式可以绕过网络问题：

```bash
# 1. 停止当前的开发服务器（Ctrl+C）

# 2. 使用 Tunnel 模式重新启动
npx expo start --go --tunnel --clear
```

**等待看到**：
- ✅ QR Code
- ✅ Tunnel URL（类似 `exp://xxx.tunnel.exp.direct:80`）

**然后**：
1. 打开 Expo Go 应用
2. 点击 **"Enter URL manually"**
3. 复制终端显示的 Tunnel URL
4. 粘贴并连接

### 方案 2：手动输入 URL（如果二维码无法扫描）

如果二维码无法扫描：

1. **打开 Expo Go 应用**
2. **点击底部的 "Enter URL manually"**（手动输入 URL）
3. **查看终端显示的 URL**（应该类似 `exp://192.168.x.x:8081` 或 `exp://xxx.tunnel.exp.direct:80`）
4. **复制完整 URL**（包括 `exp://` 前缀）
5. **粘贴到 Expo Go 中并点击 "Connect"**

### 方案 3：完全重启 Expo Go

1. **完全关闭 Expo Go**：
   - iPhone X 及以后：从底部上滑，找到 Expo Go，上滑关闭
   - iPhone 8 及以前：双击 Home 键，上滑关闭 Expo Go
2. **重新打开 Expo Go**
3. **再次尝试扫描或手动输入 URL**

### 方案 4：检查网络连接

#### 确保手机和电脑在同一 WiFi

1. **在 iPhone 上**：
   - 设置 → WiFi
   - 确保连接到与电脑相同的 WiFi
   - 关闭 VPN（如果开启）
   - 关闭代理（如果开启）

2. **在 Mac 上**：
   - 系统设置 → 网络 → 防火墙
   - 确保允许 Node.js 和 Terminal 通过
   - 或临时关闭防火墙测试

#### 测试网络连接

在手机浏览器中访问：

```
http://[电脑IP]:8081
```

如果无法访问，说明网络有问题，使用 Tunnel 模式。

### 方案 5：清除缓存并重启

```bash
# 1. 停止当前服务器（Ctrl+C）

# 2. 清除缓存
rm -rf .expo
rm -rf node_modules/.cache

# 3. 使用 Tunnel 模式重新启动
npx expo start --go --tunnel --clear
```

### 方案 6：检查 Expo Go 版本

1. **打开 App Store**
2. **搜索 "Expo Go"**
3. **确保使用最新版本**
4. **如果不是最新，更新应用**

### 方案 7：使用开发构建（如果 Expo Go 一直有问题）

如果 Expo Go 一直无法连接，可以使用开发构建：

```bash
# iOS（如果已配置）
npx expo run:ios

# Android（如果已配置）
npx expo run:android
```

然后运行：

```bash
npx expo start --dev-client
```

## 立即操作步骤

### 步骤 1：停止当前服务器

在运行 `npm run start:go` 的终端按 `Ctrl+C`

### 步骤 2：使用 Tunnel 模式重新启动

```bash
cd /Users/macbook/Vouchap
npx expo start --go --tunnel --clear
```

### 步骤 3：等待看到 Tunnel URL

终端会显示：
```
› Metro waiting on exp://xxx.tunnel.exp.direct:80
› Scan the QR code above with Expo Go
```

### 步骤 4：在 Expo Go 中手动输入 URL

1. 打开 Expo Go 应用
2. 点击 **"Enter URL manually"**
3. 复制终端显示的 URL（`exp://xxx.tunnel.exp.direct:80`）
4. 粘贴并点击 "Connect"

## 常见问题

### Q: Expo Go 应用打不开

**A:** 
1. 重启手机
2. 重新安装 Expo Go（从 App Store）
3. 检查手机存储空间

### Q: 扫描二维码后显示"未找到可用数据"

**A:** 
1. 使用 Tunnel 模式
2. 手动输入 URL
3. 确保网络连接正常

### Q: 手动输入 URL 后无法连接

**A:** 
1. 检查 URL 是否正确（包括 `exp://` 前缀）
2. 确保开发服务器正在运行
3. 尝试使用 Tunnel 模式
4. 检查防火墙设置

### Q: 连接后显示错误

**A:** 
1. 清除 Expo Go 缓存（在应用中）
2. 清除开发服务器缓存：`npx expo start --clear`
3. 重新安装依赖：`rm -rf node_modules && npm install`

## 验证修复

修复后，应该能够：
1. ✅ 打开 Expo Go 应用
2. ✅ 扫描二维码或手动输入 URL
3. ✅ 看到应用加载界面
4. ✅ 应用正常运行

## 如果还是不行

提供以下信息以便进一步诊断：
- Expo Go 的具体错误信息
- 终端显示的完整输出
- 使用的连接模式（tunnel/lan）
- 手机和电脑的网络配置
