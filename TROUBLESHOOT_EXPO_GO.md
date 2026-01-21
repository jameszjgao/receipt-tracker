# Expo Go 连接问题详细排查

## 问题：Apple 手机扫码显示"未找到可用数据"

## 逐步排查步骤

### 步骤 1：确认开发服务器正在运行

```bash
cd /Users/macbook/receipt-tracker
npm start
```

确保看到：
- ✅ QR Code 显示
- ✅ "Metro waiting on..." 消息
- ✅ 没有错误信息

### 步骤 2：尝试不同的连接模式

#### 方法 A：Tunnel 模式（最可靠）

```bash
npx expo start --tunnel
```

**优点**：
- 不依赖本地网络
- 可以跨网络连接
- 最稳定

**缺点**：
- 可能较慢
- 需要网络连接

#### 方法 B：LAN 模式（需要同一 WiFi）

```bash
npx expo start --lan
```

**检查事项**：
1. 确保手机和电脑在同一 WiFi
2. 检查防火墙设置
3. 确保 IP 地址正确

#### 方法 C：Localhost 模式（仅限模拟器）

```bash
npx expo start --localhost
```

### 步骤 3：检查网络连接

#### 检查电脑 IP 地址

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# 应该看到类似：inet 192.168.x.x 或 10.x.x.x
```

#### 测试网络连接

在手机浏览器中访问：
```
http://[电脑IP]:8081
```

如果无法访问，说明网络有问题。

### 步骤 4：手动输入 URL

如果二维码无法扫描：

1. 打开 Expo Go 应用
2. 点击 "Enter URL manually"
3. 输入终端显示的 URL：
   - Tunnel: `exp://xxx.tunnel.exp.direct:80`
   - LAN: `exp://192.168.x.x:8081`

### 步骤 5：清除缓存

```bash
# 清除 Expo 缓存
npx expo start --clear

# 或者完全清除
rm -rf .expo
rm -rf node_modules/.cache
npm start
```

### 步骤 6：检查防火墙

#### macOS 防火墙设置

1. 打开"系统设置" > "网络" > "防火墙"
2. 点击"选项"
3. 确保允许 Node.js 和 Terminal 通过防火墙
4. 或者临时关闭防火墙测试

### 步骤 7：检查端口占用

```bash
# 检查 8081 端口是否被占用
lsof -i :8081

# 如果被占用，使用其他端口
npx expo start --port 8082
```

### 步骤 8：重启所有服务

```bash
# 1. 停止当前服务器（Ctrl+C）
# 2. 完全重启
npx expo start --clear --tunnel
```

### 步骤 9：检查 Expo Go 应用

1. **更新 Expo Go**：确保使用最新版本
2. **完全关闭应用**：双击 Home 键，上滑关闭 Expo Go，然后重新打开
3. **重启手机**：有时需要重启设备

### 步骤 10：使用开发构建（如果以上都失败）

如果 Expo Go 始终无法连接，可以使用开发构建：

```bash
# 安装 expo-dev-client
npx expo install expo-dev-client

# 预构建
npx expo prebuild

# 运行 iOS
npx expo run:ios
```

## 常见错误和解决方案

### 错误 1：`Network request failed`

**原因**：网络连接问题

**解决**：
- 使用 `--tunnel` 模式
- 检查防火墙
- 确保手机和电脑在同一网络

### 错误 2：`Unable to resolve module`

**原因**：依赖问题

**解决**：
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### 错误 3：二维码无法扫描

**原因**：二维码生成问题

**解决**：
- 手动输入 URL
- 使用 tunnel 模式（URL 更短）
- 检查终端显示是否正确

## 推荐配置

已更新 `package.json`，默认使用 tunnel 模式：

```json
{
  "scripts": {
    "start": "expo start --tunnel"
  }
}
```

## 验证步骤

1. ✅ 运行 `npm start`
2. ✅ 看到 QR Code 和连接信息
3. ✅ 在 Expo Go 中扫描或手动输入 URL
4. ✅ 应用应该开始加载

如果仍然无法连接，请提供：
- 终端显示的完整错误信息
- 使用的连接模式（tunnel/lan/localhost）
- 手机和电脑的网络配置
