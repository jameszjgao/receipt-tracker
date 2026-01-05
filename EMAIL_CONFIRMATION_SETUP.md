# Supabase 邮件确认配置指南

本指南说明如何配置 Supabase 使用企业邮箱发送确认邮件，并将确认链接包装在邮件中，用户确认后返回到应用登录界面。

## 配置步骤

### 1. 配置 SMTP 设置（使用企业邮箱）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **进入 Authentication 设置**
   - 点击左侧菜单的 **"Authentication"**
   - 点击 **"Settings"** 标签

3. **配置 SMTP**
   - 找到 **"SMTP Settings"** 部分
   - 点击 **"Enable Custom SMTP"** 或 **"Configure SMTP"**
   - 填写以下信息：
     ```
     SMTP Host: smtp.app.aim.link (或您的邮件服务器地址)
     SMTP Port: 587 (或 465 for SSL)
     SMTP User: no-reply@app.aim.link
     SMTP Password: [您的邮箱密码]
     Sender Email: no-reply@app.aim.link
     Sender Name: Snap Receipt
     ```
   - 点击 **"Save"** 保存设置

### 2. 配置邮件模板

1. **进入 Email Templates**
   - 在 Authentication > Settings 页面
   - 找到 **"Email Templates"** 部分

2. **编辑确认邮件模板**
   - 选择 **"Confirm signup"** 模板
   - 更新邮件内容，将确认链接包装在邮件中：

   **主题 (Subject):**
   ```
   Confirm your Snap Receipt account
   ```

   **邮件内容 (Body):**
   ```html
   <h2>Welcome to Snap Receipt!</h2>
   <p>Thank you for signing up. Please confirm your email address by clicking the link below:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email Address</a></p>
   <p>Or copy and paste this link into your browser:</p>
   <p>{{ .ConfirmationURL }}</p>
   <p>If you didn't create an account, you can safely ignore this email.</p>
   <p>Best regards,<br>Snap Receipt Team</p>
   ```

   **注意：** `{{ .ConfirmationURL }}` 是 Supabase 的模板变量，会自动替换为实际的确认链接。

3. **保存模板**
   - 点击 **"Save"** 保存邮件模板

### 3. 配置重定向 URL

1. **进入 URL Configuration**
   - 在 Authentication > Settings 页面
   - 找到 **"URL Configuration"** 或 **"Redirect URLs"** 部分

2. **添加重定向 URL**
   - **Site URL**: `snapreceipt://` (应用的自定义 scheme)
   - **Redirect URLs**: 添加以下 URL：
     ```
     snapreceipt://auth/confirm
     exp://localhost:8081/--/auth/confirm
     https://snapreceipt.app/auth/confirm
     ```

3. **保存设置**
   - 点击 **"Save"** 保存配置

### 4. 启用邮箱确认

1. **启用邮箱确认功能**
   - 在 Authentication > Settings 页面
   - 找到 **"Email Auth"** 部分
   - 确保 **"Enable email confirmations"** 已启用（勾选）

2. **配置确认设置**
   - **Confirm email**: 启用
   - **Secure email change**: 可选（建议启用）

### 5. 验证配置

1. **测试注册流程**
   - 在应用中注册一个新用户
   - 检查邮箱（包括垃圾邮件文件夹）
   - 确认邮件应来自 `no-reply@app.aim.link`

2. **测试确认链接**
   - 点击邮件中的确认链接
   - 应该自动打开应用并跳转到登录页面
   - 确认后，用户应该能够正常登录

## 邮件模板变量

Supabase 邮件模板支持以下变量：

- `{{ .ConfirmationURL }}` - 邮箱确认链接
- `{{ .Email }}` - 用户邮箱地址
- `{{ .Token }}` - 确认 token（通常不需要直接使用）
- `{{ .TokenHash }}` - Token hash（通常不需要直接使用）

## Deep Linking 配置

应用已配置以下 Deep Linking：

- **Custom Scheme**: `snapreceipt://`
- **Universal Links (iOS)**: `https://snapreceipt.app/*`
- **App Links (Android)**: `https://snapreceipt.app/*`

确认链接格式：
- 开发环境: `exp://localhost:8081/--/auth/confirm?token_hash=xxx&type=email`
- 生产环境: `snapreceipt://auth/confirm?token_hash=xxx&type=email`

## 故障排除

### 问题 1: 邮件未发送

**检查项：**
- SMTP 配置是否正确
- 邮箱密码是否正确
- SMTP 服务器是否允许外部连接
- 检查 Supabase 日志中的错误信息

### 问题 2: 确认链接无法打开应用

**检查项：**
- Deep Linking 配置是否正确
- `app.json` 和 `app.config.js` 中的 scheme 配置
- iOS: 检查 `associatedDomains` 配置
- Android: 检查 `intentFilters` 配置

### 问题 3: 确认后无法登录

**检查项：**
- 确认链接是否正确处理
- 检查 `app/auth/confirm.tsx` 是否正确处理 token
- 检查 Supabase 日志中的错误信息

## 注意事项

1. **SMTP 服务器要求**
   - 确保 SMTP 服务器支持 TLS/SSL
   - 某些邮件服务商可能需要应用专用密码

2. **邮件发送限制**
   - 注意 SMTP 服务器的发送频率限制
   - Supabase 也有每日邮件发送限制（取决于计划）

3. **安全性**
   - 不要在代码中硬编码 SMTP 密码
   - 使用环境变量或 Supabase 的配置界面

4. **测试环境**
   - 开发环境可以使用 `exp://` scheme
   - 生产环境使用 `snapreceipt://` scheme

## 相关文件

- `lib/auth.ts` - 注册函数，包含 `emailRedirectTo` 配置
- `app/auth/confirm.tsx` - 邮箱确认处理页面
- `app.json` / `app.config.js` - Deep Linking 配置

