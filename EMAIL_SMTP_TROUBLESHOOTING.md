# Supabase 邮件发送故障排除指南

## 错误：Error sending confirmation email

如果遇到此错误，请按照以下步骤排查：

### 1. 检查 SMTP 配置

在 Supabase Dashboard > Authentication > Settings > SMTP Settings 中：

#### 必需配置项：

1. **Enable Custom SMTP**: 必须启用 ✅

2. **SMTP Host**: 
   - 对于 `app.aim.link`，通常使用：
     - `smtp.app.aim.link` 或
     - `mail.app.aim.link` 或
     - 您的邮件服务商提供的 SMTP 服务器地址
   - ⚠️ 如果不确定，请联系您的邮件服务商获取正确的 SMTP 服务器地址

3. **SMTP Port**:
   - 通常使用 `587` (TLS/STARTTLS) 或 `465` (SSL)
   - 建议先尝试 `587`

4. **SMTP User**: `no-reply@app.aim.link`
   - 确保这是有效的邮箱账户

5. **SMTP Password**: 
   - 确保密码正确
   - 某些邮件服务商需要使用"应用专用密码"而不是普通密码
   - 如果启用了两步验证，必须使用应用专用密码

6. **Sender Email**: `no-reply@app.aim.link`
   - 必须与 SMTP User 匹配

7. **Sender Name**: `Snap Receipt` (可选)

#### 测试 SMTP 连接

在 Supabase Dashboard 中，配置完 SMTP 后，通常会有一个"Test Connection"或"Send Test Email"按钮。使用此功能测试配置是否正确。

### 2. 常见问题排查

#### 问题 A: SMTP 服务器地址不正确

**症状**: 连接超时或无法连接到服务器

**解决方案**:
- 确认 SMTP 服务器地址正确
- 尝试使用不同的端口（587 或 465）
- 检查防火墙设置

#### 问题 B: 认证失败

**症状**: "Authentication failed" 或 "Invalid credentials"

**解决方案**:
- 确认用户名和密码正确
- 如果邮箱启用了两步验证，使用应用专用密码
- 某些邮件服务商要求用户名使用完整邮箱地址

#### 问题 C: 端口被阻止

**症状**: 连接超时

**解决方案**:
- 尝试不同的端口：
  - 587 (STARTTLS/TLS) - 推荐
  - 465 (SSL)
  - 25 (不推荐，通常被阻止)

#### 问题 D: 发件人地址未验证

**症状**: "Sender address not verified"

**解决方案**:
- 确保 `no-reply@app.aim.link` 是有效的邮箱账户
- 某些邮件服务商要求先验证发件人地址

### 3. 检查 Supabase 日志

1. 在 Supabase Dashboard 中，进入 **Logs** > **Auth Logs**
2. 查看最近的错误日志
3. 查找与邮件发送相关的错误信息

### 4. 验证邮件服务商设置

#### 对于常见的邮件服务商：

**Gmail / Google Workspace**:
- SMTP Host: `smtp.gmail.com`
- Port: `587`
- 需要启用"允许不够安全的应用访问"或使用应用专用密码

**Outlook / Microsoft 365**:
- SMTP Host: `smtp.office365.com`
- Port: `587`

**自定义邮件服务器**:
- 联系您的邮件服务商获取正确的 SMTP 配置

### 5. 临时解决方案：使用 Supabase 默认邮件服务

如果自定义 SMTP 配置有问题，可以暂时使用 Supabase 的默认邮件服务进行测试：

1. 在 Supabase Dashboard > Authentication > Settings
2. 禁用 "Enable Custom SMTP"
3. 使用 Supabase 默认的邮件服务（有发送限制）
4. 测试注册流程是否正常

### 6. 检查重定向 URL 配置

即使 SMTP 配置正确，如果重定向 URL 未配置，也可能导致错误：

1. 在 Supabase Dashboard > Authentication > URL Configuration
2. 确保添加了以下 URL：
   - `snapreceipt://auth/confirm`
   - `exp://localhost:8081/--/auth/confirm`
   - `https://snapreceipt.app/auth/confirm` (如果使用 Universal Links)

### 7. 测试步骤

1. **配置 SMTP**:
   ```
   SMTP Host: smtp.app.aim.link (或您的实际 SMTP 服务器)
   SMTP Port: 587
   SMTP User: no-reply@app.aim.link
   SMTP Password: [您的邮箱密码或应用专用密码]
   Sender Email: no-reply@app.aim.link
   Sender Name: Snap Receipt
   ```

2. **测试连接**:
   - 点击 "Test Connection" 或 "Send Test Email"
   - 检查是否收到测试邮件

3. **检查邮件模板**:
   - 确保 "Confirm signup" 模板已正确配置
   - 使用 `{{ .ConfirmationURL }}` 变量

4. **测试注册**:
   - 在应用中尝试注册新用户
   - 检查邮箱（包括垃圾邮件文件夹）
   - 查看 Supabase Auth Logs 中的错误信息

### 8. 获取详细错误信息

在应用代码中，可以添加更详细的错误日志：

```typescript
// 在 app/register.tsx 中
if (error) {
  console.error('Registration error details:', {
    message: error.message,
    status: error.status,
    name: error.name,
    // Supabase 特定错误
    ...(error as any).details,
  });
}
```

### 9. 联系邮件服务商

如果以上步骤都无法解决问题，建议：

1. 联系您的邮件服务商（app.aim.link 的管理员）
2. 确认：
   - SMTP 服务器地址和端口
   - 是否需要特殊认证
   - 是否有发送限制
   - 是否需要白名单 Supabase 的 IP 地址

### 10. 替代方案

如果企业邮箱配置困难，可以考虑：

1. **使用第三方邮件服务**:
   - SendGrid
   - Mailgun
   - Amazon SES
   - 这些服务通常提供更好的文档和测试工具

2. **使用 Supabase 默认邮件服务**:
   - 适合开发和测试
   - 有发送限制（通常每天 3-4 封）
   - 发件人显示为 Supabase

## 快速检查清单

- [ ] SMTP Host 地址正确
- [ ] SMTP Port 正确（587 或 465）
- [ ] SMTP User 和 Password 正确
- [ ] Sender Email 与 SMTP User 匹配
- [ ] 已启用 "Enable Custom SMTP"
- [ ] 已测试 SMTP 连接
- [ ] 重定向 URL 已配置
- [ ] 邮件模板已配置
- [ ] 检查了 Supabase Auth Logs
- [ ] 检查了邮箱的垃圾邮件文件夹

## 需要帮助？

如果问题仍然存在，请提供：

1. Supabase Auth Logs 中的完整错误信息
2. SMTP 配置截图（隐藏敏感信息）
3. 邮件服务商信息
4. 测试时的完整错误堆栈

