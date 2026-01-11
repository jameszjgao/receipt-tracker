# EAS Secrets 配置指南

## 问题

构建的应用安装在手机上后，登录和注册功能无法使用，提示"连不上网"。

## 根本原因

**Supabase 环境变量在 EAS Build 时没有正确注入到应用中**。

EAS Build 不会读取本地的 `.env` 文件，必须在 Expo Dashboard 的 Secrets 中设置环境变量。

## 解决方案

### 步骤 1：登录 Expo Dashboard

访问：https://expo.dev

### 步骤 2：进入项目设置

1. 选择你的项目（snap-receipt）
2. 点击左侧菜单 "Settings"
3. 点击 "Secrets"

### 步骤 3：添加环境变量

点击 "Create Secret" 按钮，添加以下三个环境变量：

#### 1. EXPO_PUBLIC_SUPABASE_URL
- **Name**: `EXPO_PUBLIC_SUPABASE_URL`
- **Value**: 你的 Supabase 项目 URL
  - 格式：`https://xxx.supabase.co`
  - 可以在 Supabase Dashboard > Settings > API 中找到

#### 2. EXPO_PUBLIC_SUPABASE_ANON_KEY
- **Name**: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: 你的 Supabase Anon Key
  - 可以在 Supabase Dashboard > Settings > API 中找到
  - 这是 `anon` / `public` key（不是 `service_role` key）

#### 3. EXPO_PUBLIC_GEMINI_API_KEY（可选）
- **Name**: `EXPO_PUBLIC_GEMINI_API_KEY`
- **Value**: 你的 Gemini API Key
  - 如果未设置，AI 识别功能将无法使用

### 步骤 4：重新构建应用

在终端中运行：

```bash
eas build --platform android --profile production
```

### 步骤 5：验证构建

构建完成后，安装应用并测试登录功能。

## 重要提示

1. **环境变量名称必须正确**：
   - 必须使用 `EXPO_PUBLIC_` 前缀
   - 变量名区分大小写

2. **不要将敏感信息提交到代码仓库**：
   - `.env` 文件已在 `.gitignore` 中
   - 不要在代码中硬编码 API Key

3. **本地开发环境**：
   - 本地开发时可以使用 `.env` 文件
   - 但构建时必须使用 EAS Secrets

## 验证配置

### 方法 1：查看构建日志

在 EAS Build 的构建日志中，检查环境变量是否正确注入（不会显示实际值，但会显示是否设置）。

### 方法 2：在应用中检查

重新构建的应用中，如果配置正确，登录/注册功能应该可以正常工作。

如果配置错误，会显示明确的错误信息：
- "网络配置错误：Supabase 未正确配置"
- 提示需要在 EAS Secrets 中设置环境变量

## 常见错误

### 错误 1：变量名错误

**症状**：应用仍然无法连接

**解决**：
- 检查变量名是否正确（区分大小写）
- 确保使用 `EXPO_PUBLIC_` 前缀

### 错误 2：值错误

**症状**：应用尝试连接但失败

**解决**：
- 验证 Supabase URL 和 Key 是否正确
- 确保 URL 格式正确（`https://xxx.supabase.co`）
- 确保使用的是 `anon` key，不是 `service_role` key

### 错误 3：未重新构建

**症状**：修改 Secrets 后应用仍然无法连接

**解决**：
- 必须重新构建应用，Secrets 只在构建时注入
- 已安装的应用不会自动更新配置

## 获取 Supabase 配置信息

1. 登录 Supabase Dashboard：https://supabase.com/dashboard
2. 选择你的项目
3. 点击左侧 "Settings" → "API"
4. 找到以下信息：
   - **Project URL**: 这是 `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key: 这是 `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 获取 Gemini API Key

1. 访问 Google AI Studio：https://makersuite.google.com/app/apikey
2. 登录 Google 账号
3. 创建 API Key
4. 复制 API Key 作为 `EXPO_PUBLIC_GEMINI_API_KEY` 的值

---

*最后更新：2024年*
