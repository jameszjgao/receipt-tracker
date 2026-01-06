# 邀请邮件发送配置指南

## 问题
目前邀请功能已实现，但邮件发送功能需要配置才能正常工作。

## 解决方案

### 方案 1：使用 Supabase Edge Function（推荐）

1. **创建 Edge Function**
   - 在 Supabase Dashboard 中，进入 "Edge Functions"
   - 创建新函数 `send-invitation-email`
   - 使用以下代码模板：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { email, inviteUrl, householdName, inviterName, isExistingUser } = await req.json()

    // 配置邮件服务（例如 SendGrid, Resend, AWS SES 等）
    // 这里以 Resend 为例
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    const emailBody = isExistingUser
      ? `Hi,\n\n${inviterName} has invited you to join ${householdName} on Snap Receipt.\n\nClick the link below to accept the invitation:\n${inviteUrl}\n\nThis invitation will expire in 7 days.`
      : `Hi,\n\n${inviterName} has invited you to join ${householdName} on Snap Receipt.\n\nClick the link below to create your account and join:\n${inviteUrl}\n\nThis invitation will expire in 7 days.`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Snap Receipt <no-reply@yourdomain.com>',
        to: email,
        subject: `You've been invited to join ${householdName}`,
        text: emailBody,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to send email')
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

2. **配置环境变量**
   - 在 Supabase Dashboard > Edge Functions > Settings
   - 添加邮件服务的 API Key（如 RESEND_API_KEY）

3. **部署函数**
   - 使用 Supabase CLI 部署：`supabase functions deploy send-invitation-email`

### 方案 2：使用 Supabase 邮件功能

如果 Supabase 已配置 SMTP，可以修改 `sendInvitationEmail` 函数直接使用 Supabase 的邮件 API。

### 方案 3：临时测试方案

在开发环境中，邀请链接会在控制台输出，可以手动复制并发送给被邀请者。

## 当前状态

- ✅ 邀请记录已创建到数据库
- ✅ 邀请链接已生成
- ⚠️ 邮件发送需要配置 Edge Function 或邮件服务
- ✅ 登录时会检查待处理的邀请并显示提示

## 测试建议

1. **开发环境**：查看控制台输出的邀请链接，手动测试
2. **生产环境**：配置 Edge Function 后，邀请邮件会自动发送

