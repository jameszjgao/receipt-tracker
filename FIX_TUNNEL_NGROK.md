# 修复 Tunnel 模式需要 ngrok 的问题

## 问题

```
The package @expo/ngrok@^4.1.0 is required to use tunnels
```

**原因**：Tunnel 模式需要 `@expo/ngrok` 包来创建网络隧道。

## 解决方案

### 方案 1：安装 ngrok（支持 Tunnel 模式）

```bash
npm install @expo/ngrok@^4.1.0
```

然后重新启动：

```bash
npx expo start --go --tunnel --clear
```

### 方案 2：使用 LAN 模式（不需要 ngrok）

如果不想安装 ngrok，可以使用 LAN 模式：

```bash
# 停止当前服务器（Ctrl+C）

# 使用 LAN 模式
npx expo start --go --lan --clear
```

**要求**：
- 手机和电脑必须在同一 WiFi 网络
- 防火墙允许连接

### 方案 3：使用默认模式

```bash
# 停止当前服务器（Ctrl+C）

# 使用默认模式（会自动选择）
npx expo start --go --clear
```

## Watchman 警告

如果看到 Watchman 警告：

```
MustScanSubDirs UserDropped
```

这不是严重问题，但可以修复：

### 安装 Watchman（可选）

```bash
# 使用 Homebrew 安装
brew install watchman

# 然后清除警告
watchman watch-del '/Users/macbook/Vouchap'
watchman watch '/Users/macbook/Vouchap'
```

**注意**：Watchman 是可选的，不影响应用运行。

## 推荐操作

### 如果想使用 Tunnel 模式（推荐，最稳定）

```bash
# 1. 安装 ngrok
npm install @expo/ngrok@^4.1.0

# 2. 重新启动
npx expo start --go --tunnel --clear
```

### 如果不想安装 ngrok

```bash
# 使用 LAN 模式
npx expo start --go --lan --clear
```

**确保**：
- 手机和电脑在同一 WiFi
- 防火墙允许连接

## 验证

启动后，应该看到：
- ✅ QR Code
- ✅ 连接 URL（tunnel 或 LAN）
- ✅ 没有错误信息

然后在 Expo Go 中：
1. 扫描二维码，或
2. 手动输入 URL

## 总结

- **Tunnel 模式**：需要安装 `@expo/ngrok`，但最稳定
- **LAN 模式**：不需要额外包，但需要同一网络
- **Watchman**：可选，不影响功能
