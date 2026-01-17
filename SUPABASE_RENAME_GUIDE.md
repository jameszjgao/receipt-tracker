# Supabase 应用名称更换指南

本指南说明如何将 Supabase 项目中的配置从 "Snap Receipt" 更新为 "VouCap"。

## 📋 需要更新的配置项

### 1. Authentication 设置中的邮件模板

#### 1.1 邮箱确认邮件模板

**位置**：Supabase Dashboard > Authentication > Email Templates > Confirm signup

**需要更新的内容**：
- **Subject（主题）**：将 "Snap Receipt" 替换为 "VouCap"
- **Email Body（邮件正文）**：将所有 "Snap Receipt" 替换为 "VouCap"

**示例**：
```
Subject: 确认您的 VouCap 账户

确认您的账户，请点击以下链接：
{{ .ConfirmationURL }}
```

#### 1.2 密码重置邮件模板

**位置**：Supabase Dashboard > Authentication > Email Templates > Reset password

**需要更新的内容**：
- **Subject（主题）**：将 "Snap Receipt" 替换为 "VouCap"
- **Email Body（邮件正文）**：将所有 "Snap Receipt" 替换为 "VouCap"

**示例**：
```
Subject: 重置您的 VouCap 密码

重置您的密码，请点击以下链接：
{{ .ConfirmationURL }}
```

#### 1.3 邀请邮件模板（如果使用）

**位置**：Supabase Dashboard > Authentication > Email Templates > Invite user

**需要更新的内容**：
- **Subject（主题）**：将 "Snap Receipt" 替换为 "VouCap"
- **Email Body（邮件正文）**：将所有 "Snap Receipt" 替换为 "VouCap"

#### 1.4 更换邮箱确认邮件模板

**位置**：Supabase Dashboard > Authentication > Email Templates > Change email address

**需要更新的内容**：
- **Subject（主题）**：将 "Snap Receipt" 替换为 "VouCap"
- **Email Body（邮件正文）**：将所有 "Snap Receipt" 替换为 "VouCap"

### 2. 重定向 URL 配置

**位置**：Supabase Dashboard > Authentication > URL Configuration

**需要更新的配置**：
- **Site URL**：确保设置为正确的生产域名（如 `https://voucap.app`）
- **Redirect URLs**：检查并更新所有重定向 URL，确保使用新的 scheme `voucap://`

**重定向 URL 示例**：
```
生产环境：
- voucap://auth/confirm
- voucap://invite/[id]

开发环境（如果需要）：
- exp://localhost:8081/--/auth/confirm
- exp://localhost:8081/--/invite/[id]
```

### 3. 邮件发送者名称和地址

**位置**：Supabase Dashboard > Authentication > Settings

**可选的更新项**：
- **Email From Name**：将 "Snap Receipt" 更新为 "VouCap"
- **Email From Address**：如果使用自定义邮箱，可能需要更新（如 `noreply@voucap.app`）

### 4. 网站元数据（如果使用）

**位置**：Supabase Dashboard > Settings > General

如果项目描述或元数据中包含应用名称，可以更新为 "VouCap"。

## 🔄 邮件模板变量说明

Supabase 邮件模板支持以下变量（根据模板类型而定）：

- `{{ .ConfirmationURL }}` - 确认链接 URL
- `{{ .Email }}` - 用户邮箱地址
- `{{ .Token }}` - 确认令牌
- `{{ .TokenHash }}` - 令牌哈希
- `{{ .SiteURL }}` - 网站 URL
- `{{ .RedirectTo }}` - 重定向 URL

## 📝 更新步骤

### 步骤 1：更新邮箱确认邮件模板

1. 登录 Supabase Dashboard
2. 进入 **Authentication** > **Email Templates**
3. 选择 **Confirm signup** 模板
4. 点击 **Edit** 按钮
5. 更新 Subject 和 Email Body 中的所有 "Snap Receipt" 为 "VouCap"
6. 点击 **Save** 保存

### 步骤 2：更新密码重置邮件模板

1. 在 **Email Templates** 页面选择 **Reset password** 模板
2. 点击 **Edit** 按钮
3. 更新 Subject 和 Email Body 中的所有 "Snap Receipt" 为 "VouCap"
4. 点击 **Save** 保存

### 步骤 3：更新其他邮件模板（如适用）

重复上述步骤，更新：
- **Invite user** 模板
- **Change email address** 模板

### 步骤 4：验证重定向 URL

1. 进入 **Authentication** > **URL Configuration**
2. 检查 **Redirect URLs** 列表
3. 确保包含以下 URL（根据实际需求）：
   ```
   voucap://auth/confirm
   voucap://invite/*
   ```
4. 如果缺少，点击 **Add URL** 添加
5. 点击 **Save** 保存

### 步骤 5：测试邮件发送

1. 使用测试账户注册新用户
2. 检查收到的确认邮件，验证：
   - 邮件主题和正文中的名称是否正确
   - 邮件中的链接是否能正常跳转到应用
3. 测试密码重置流程，验证重置邮件中的名称是否正确

## ⚠️ 注意事项

### 1. Deep Link Scheme 变更

如果更改了应用 scheme（从 `snapreceipt://` 改为 `voucap://`），需要：

- **iOS**：
  - 更新 Associated Domains（`applinks:voucap.app`）
  - 重新构建和发布应用
  - 更新 Universal Links 配置

- **Android**：
  - 更新 Intent Filters 中的 scheme
  - 重新构建和发布应用
  - 更新 App Links 配置

### 2. Bundle Identifier / Package Name 变更

如果更改了 Bundle Identifier（iOS）或 Package Name（Android），这将被视为新应用：

- 需要重新提交到 App Store 和 Google Play Store
- 现有的应用安装将被视为不同的应用
- 用户需要卸载旧应用并安装新应用

**建议**：如果不希望用户重新安装应用，可以保留原有的 Bundle Identifier 和 Package Name，只更新显示名称。

### 3. 邮件模板自定义

如果使用自定义邮件模板，确保：
- 更新所有模板中的品牌名称
- 测试所有邮件类型的发送
- 检查邮件在不同邮件客户端中的显示效果

### 4. 数据库中的引用

检查数据库中是否有硬编码的应用名称：
- 用户元数据
- 系统配置
- 日志或审计记录

## ✅ 验证清单

完成以下检查以确保配置正确：

- [ ] 所有邮件模板中的名称已更新为 "VouCap"
- [ ] 邮件主题和正文中的品牌名称正确
- [ ] 重定向 URL 配置正确（使用 `voucap://`）
- [ ] 测试邮箱确认邮件发送成功
- [ ] 测试密码重置邮件发送成功
- [ ] 邮件中的链接能正常跳转到应用
- [ ] 如果更新了 scheme，已更新 iOS 和 Android 配置
- [ ] 应用中的 deep link 处理正常工作

## 📞 需要帮助？

如果遇到问题，请检查：
1. Supabase Dashboard 中的配置是否正确保存
2. 应用的 `app.config.js` 中的 scheme 配置是否匹配
3. 邮件模板语法是否正确（特别是变量语法）
4. 重定向 URL 是否在允许列表中

## 🔗 相关文档

- [Supabase 邮件模板文档](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase 重定向 URL 配置](https://supabase.com/docs/guides/auth/auth-deep-linking)
- [Expo Deep Linking 配置](https://docs.expo.dev/guides/linking/)
