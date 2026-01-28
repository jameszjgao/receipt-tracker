# 二维码扫描问题解决方案

## 问题原因

项目使用了 `expo-dev-client`，默认的 `npx expo start` 会启动开发客户端模式，二维码只能被**开发构建版本的应用**扫描，**不能用 Expo Go** 扫描。

## 解决方案

### 方案 1：使用 Expo Go（快速测试，推荐用于非原生功能）

如果你想用 Expo Go 快速测试 UI 和基本功能：

```bash
npm run start:go
```

然后用 **Expo Go** 应用扫描二维码。

**注意**：原生扫描功能（`react-native-document-scanner-plugin`）在 Expo Go 中不可用，但可以从相册选择图片。

### 方案 2：使用开发构建（完整功能测试）

如果你想测试所有功能（包括原生扫描）：

#### 步骤 1：构建并安装开发版本

**Android：**
```bash
# 确保已预构建
npx expo prebuild --platform android

# 构建并安装到设备/模拟器
npx expo run:android
```

**iOS（仅 macOS）：**
```bash
# 确保已预构建
npx expo prebuild --platform ios
cd ios && pod install && cd ..

# 构建并安装到设备/模拟器
npx expo run:ios
```

#### 步骤 2：启动开发服务器

在另一个终端窗口：
```bash
npx expo start --dev-client
```

应用会自动连接到开发服务器。如果需要手动连接，用**开发构建版本的应用**扫描二维码。

### 方案 3：使用 Tunnel 模式（解决网络问题）

如果设备和电脑不在同一网络，或网络连接有问题：

```bash
npx expo start --dev-client --tunnel
```

这会使用 Expo 的 tunnel 服务，二维码可以在任何网络环境下扫描。

### 方案 4：使用 LAN 模式（同一网络）

如果设备和电脑在同一网络：

```bash
npm run start:lan
```

## 快速判断

- **想快速测试 UI** → 使用 `npm run start:go` + Expo Go
- **想测试完整功能** → 先运行 `npx expo run:android` 或 `npx expo run:ios`，然后 `npx expo start --dev-client`
- **网络有问题** → 使用 `--tunnel` 模式

## 常见错误

### 错误：二维码扫不开
- ✅ 检查是否使用了正确的应用（Expo Go vs 开发构建）
- ✅ 尝试使用 `--tunnel` 模式
- ✅ 确保设备和电脑在同一网络（LAN 模式）

### 错误：应用无法连接
- ✅ 检查防火墙设置
- ✅ 尝试使用 `--tunnel` 模式
- ✅ 确保开发服务器正在运行

## 推荐工作流

1. **日常开发（快速迭代）**：
   ```bash
   npm run start:go  # 用 Expo Go 快速测试
   ```

2. **完整功能测试**：
   ```bash
   # 第一次需要构建
   npx expo run:android  # 或 ios
   
   # 之后只需要启动服务器
   npx expo start --dev-client
   ```

3. **网络环境复杂时**：
   ```bash
   npx expo start --dev-client --tunnel
   ```
