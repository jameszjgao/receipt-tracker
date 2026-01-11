# Gemini API Key 配置指南

## 问题

本地开发环境可以正常识别，但构建的 APK 提示"检查 Gemini API Key 配置和网络连接"。

## 原因

EAS Build 不会自动读取本地的环境变量（`.env` 文件），必须在 EAS Secrets 中设置环境变量。

## 解决方案

### 方法 1：使用 EAS Secrets（推荐）

#### 步骤 1：登录 EAS CLI

```bash
eas login
```

#### 步骤 2：设置 Gemini API Key

```bash
eas secret:create --scope project --name EXPO_PUBLIC_GEMINI_API_KEY --value YOUR_GEMINI_API_KEY
```

或者使用交互式命令：

```bash
eas secret:create
```

然后按提示输入：
- **Name**: `EXPO_PUBLIC_GEMINI_API_KEY`
- **Value**: 你的 Gemini API Key（从 https://makersuite.google.com/app/apikey 获取）
- **Scope**: `project`（项目级别）

#### 步骤 3：验证 Secrets 已设置

```bash
eas secret:list
```

或者使用新命令：

```bash
eas env:list
```

应该能看到 `EXPO_PUBLIC_GEMINI_API_KEY` 在列表中。

#### 步骤 4：重新构建应用

```bash
eas build --platform android --profile production
```

### 方法 2：使用 EAS Environment Variables（新方法）

EAS 现在推荐使用 `eas.json` 中的环境变量配置：

#### 步骤 1：在 `eas.json` 中配置环境变量

在 `eas.json` 的 `build` 配置中添加 `env` 字段：

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**注意**：这种方法会将 API Key 暴露在代码仓库中，不推荐用于生产环境。

#### 步骤 2：使用 EAS Secrets（推荐）

更好的方法是在 `eas.json` 中引用 Secrets：

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_GEMINI_API_KEY": "${EXPO_PUBLIC_GEMINI_API_KEY}"
      }
    }
  }
}
```

然后在 EAS Dashboard 或使用 CLI 设置 Secret。

### 方法 3：在 EAS Dashboard 中设置

1. 访问 https://expo.dev
2. 登录你的账号
3. 选择项目（snap-receipt）
4. 进入 **Settings** → **Secrets**（或 **Environment Variables**）
5. 点击 **Create Secret** 或 **Add Variable**
6. 输入：
   - **Name**: `EXPO_PUBLIC_GEMINI_API_KEY`
   - **Value**: 你的 Gemini API Key
7. 保存

## 验证配置

### 1. 检查 Secrets 列表

```bash
eas secret:list
```

或

```bash
eas env:list
```

### 2. 检查构建日志

在构建日志中，EAS 会显示环境变量是否已设置（不会显示实际值）。

### 3. 在应用中验证

构建完成后，安装应用并测试识别功能。如果配置正确，应该可以正常识别。

如果仍然失败，检查：
- API Key 是否正确（可以在 https://makersuite.google.com/app/apikey 验证）
- 网络连接是否正常
- 构建日志中是否有相关错误

## 获取 Gemini API Key

1. 访问 https://makersuite.google.com/app/apikey
2. 登录 Google 账号
3. 点击 **Create API Key** 或使用现有的 API Key
4. 复制 API Key（格式类似：`AIza...`）

## 重要提示

1. **环境变量名称**：
   - 必须使用 `EXPO_PUBLIC_` 前缀才能在客户端代码中访问
   - 变量名区分大小写

2. **安全性**：
   - 不要将 API Key 提交到代码仓库
   - 使用 EAS Secrets 而不是硬编码在 `eas.json` 中
   - `.env` 文件已在 `.gitignore` 中

3. **构建时注入**：
   - EAS Secrets 只在构建时注入到应用中
   - 修改 Secrets 后需要重新构建应用
   - 已安装的应用不会自动更新配置

4. **本地开发**：
   - 本地开发可以使用 `.env` 文件
   - 但构建时必须使用 EAS Secrets

## 故障排除

### 问题 1：构建后仍然提示 API Key 未配置

**解决方案**：
1. 确认 Secret 名称正确：`EXPO_PUBLIC_GEMINI_API_KEY`
2. 确认 Secret 已设置为项目级别（`--scope project`）
3. 重新构建应用

### 问题 2：如何查看构建时使用的环境变量？

**解决方案**：
- 查看构建日志，EAS 会显示环境变量是否已设置
- 在应用中添加调试日志（不推荐在生产环境）

### 问题 3：多个构建配置（development, preview, production）

**解决方案**：
为每个构建配置设置相同的 Secret，或使用不同的 Secret 名称：

```bash
# Production
eas secret:create --name EXPO_PUBLIC_GEMINI_API_KEY --value YOUR_KEY --scope project

# Development (如果需要不同的 Key)
eas secret:create --name EXPO_PUBLIC_GEMINI_API_KEY_DEV --value YOUR_DEV_KEY --scope project
```

然后在 `eas.json` 中为不同配置使用不同的变量。

---

*最后更新：2024年*
