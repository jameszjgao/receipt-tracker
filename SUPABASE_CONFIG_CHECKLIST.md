# Supabase 配置检查清单

本文档列出了所有需要在 Supabase 上配置的项目，确保前后端一致。

## 📋 数据库表名检查

### ✅ 必须存在的表（使用新命名）

| 表名 | 用途 | 代码位置 |
|------|------|----------|
| `spaces` | 空间表（原 households） | `lib/auth.ts`, `lib/database.ts` |
| `user_spaces` | 用户-空间关联表（原 user_households） | `lib/auth.ts`, `lib/space-members.ts` |
| `suppliers` | 供应商表（原 stores） | `lib/suppliers.ts`, `lib/database.ts` |
| `supplier_merge_history` | 供应商合并历史（原 store_merge_history） | `lib/suppliers.ts` |
| `space_invitations` | 空间邀请表（原 household_invitations） | `lib/space-invitations.ts` |
| `users` | 用户表 | `lib/auth.ts`, `app/management.tsx` |
| `receipts` | 小票表 | `lib/database.ts` |
| `receipt_items` | 小票商品项表 | `lib/database.ts` |
| `categories` | 分类表 | `lib/categories.ts` |
| `purposes` | 用途表 | `lib/purposes.ts` |
| `payment_accounts` | 支付账户表 | `lib/payment-accounts.ts` |
| `payment_account_merge_history` | 支付账户合并历史 | `lib/payment-accounts.ts` |
| `ai_chat_logs` | AI 聊天日志表 | `lib/chat-logs.ts` |

### ❌ 不应存在的旧表名

- `households` (应已重命名为 `spaces`)
- `stores` (应已重命名为 `suppliers`)
- `user_households` (应已重命名为 `user_spaces`)
- `store_merge_history` (应已重命名为 `supplier_merge_history`)
- `household_invitations` (应已重命名为 `space_invitations`)

## 📋 列名检查

### ✅ users 表列名

| 列名 | 类型 | 代码位置 |
|------|------|----------|
| `id` | UUID | 所有文件 |
| `email` | TEXT | 所有文件 |
| `name` | TEXT (nullable) | `lib/auth.ts`, `app/management.tsx` |
| `current_space_id` | UUID (nullable) | `lib/auth.ts` |
| `created_at` | TIMESTAMP | 所有文件 |

**注意**: 不应存在 `household_id` 或 `current_household_id` 列

### ✅ spaces 表列名

| 列名 | 类型 | 代码位置 |
|------|------|----------|
| `id` | UUID | 所有文件 |
| `name` | TEXT | 所有文件 |
| `address` | TEXT (nullable) | `lib/auth.ts`, `app/space-manage.tsx` |
| `created_at` | TIMESTAMP | 所有文件 |
| `updated_at` | TIMESTAMP | 所有文件 |

### ✅ receipts 表列名

| 列名 | 类型 | 代码位置 |
|------|------|----------|
| `id` | UUID | `lib/database.ts` |
| `space_id` | UUID | `lib/database.ts` |
| `supplier_id` | UUID (nullable) | `lib/database.ts` |
| `supplier_name` | TEXT | `lib/database.ts` |
| `total_amount` | DECIMAL | `lib/database.ts` |
| `date` | DATE | `lib/database.ts` |
| `payment_account_id` | UUID (nullable) | `lib/database.ts` |
| `status` | TEXT | `lib/database.ts` |
| `image_url` | TEXT (nullable) | `lib/database.ts` |
| `currency` | TEXT (nullable) | `lib/database.ts` |
| `tax` | DECIMAL (nullable) | `lib/database.ts` |
| `confidence` | DECIMAL (nullable) | `lib/database.ts` |
| `created_at` | TIMESTAMP | `lib/database.ts` |
| `updated_at` | TIMESTAMP | `lib/database.ts` |

**注意**: 不应存在 `household_id`, `store_id`, `store_name` 列

### ✅ 其他表的列名

所有表都应使用 `space_id` 而不是 `household_id`：
- `categories.space_id`
- `purposes.space_id`
- `payment_accounts.space_id`
- `receipts.space_id`
- `suppliers.space_id`
- `user_spaces.space_id`
- `space_invitations.space_id`
- `ai_chat_logs.space_id`
- `payment_account_merge_history.space_id`
- `supplier_merge_history.space_id`

## 📋 RPC 函数检查

### ✅ 必须存在的函数（使用新命名）

| 函数名 | 参数 | 用途 | 代码位置 |
|--------|------|------|----------|
| `get_user_space_id` | `p_user_id UUID` | 获取用户当前空间ID | `lib/auth.ts` |
| `get_user_space_ids` | `p_user_id UUID` | 获取用户所有空间ID | `lib/auth.ts` |
| `get_user_space_ids_for_rls` | 无 | 获取当前用户所有空间ID（用于RLS） | `lib/auth.ts` |
| `update_user_current_space` | `p_user_id UUID, p_space_id UUID` | 更新用户当前空间 | `lib/auth.ts` |
| `create_space_with_user` | `p_space_name TEXT, p_space_address TEXT, p_user_id UUID` | 创建空间并关联用户 | `lib/auth.ts` |
| `create_user_with_space` | `p_user_id UUID, p_email TEXT, p_name TEXT, p_space_name TEXT` | 创建用户并创建空间 | `lib/auth.ts` |
| `get_space_member_users` | `p_space_id UUID` | 获取空间成员列表 | `lib/space-members.ts` |
| `get_space_members_with_last_signin` | `p_space_id UUID` | 获取空间成员及最后登录时间 | `lib/space-members.ts` |
| `remove_space_member` | `p_user_id UUID, p_space_id UUID` | 移除空间成员 | `lib/space-members.ts` |
| `is_space_admin` | `p_space_id UUID` | 检查用户是否为空间管理员 | `lib/space-members.ts` |
| `is_user_space_admin` | `p_user_id UUID, p_space_id UUID` | 检查用户是否为空间管理员 | `lib/space-members.ts` |
| `is_admin_of_space` | `p_space_id UUID` | 检查当前用户是否为空间管理员 | RLS 策略 |
| `create_space_invitation` | `p_space_id UUID, p_space_name TEXT, p_invitee_email TEXT, p_inviter_id UUID` | 创建空间邀请 | `lib/space-invitations.ts` |
| `get_invitation_by_space_email` | `p_space_id UUID, p_email TEXT` | 根据空间和邮箱获取邀请 | `lib/space-invitations.ts` |
| `create_default_categories` | `p_space_id UUID` | 创建默认分类 | `lib/auth-helper.ts` |
| `create_default_payment_accounts` | `p_space_id UUID` | 创建默认支付账户 | `lib/auth-helper.ts` |
| `create_default_purposes` | `p_space_id UUID` | 创建默认用途 | `lib/auth-helper.ts` |
| `update_user_name` | `p_user_id UUID, p_name TEXT` | 更新用户名 | `app/management.tsx` |
| `get_user_by_id` | `p_user_id UUID` | 获取用户信息 | `lib/auth.ts` |
| `update_invitations_status_batch` | (参数待确认) | 批量更新邀请状态 | `app/space-members.tsx` |

### ⚠️ 向后兼容的别名函数（可选，但建议保留）

这些函数应该调用对应的新函数：

| 旧函数名 | 应调用 | 代码位置 |
|----------|--------|----------|
| `get_user_household_id` | `get_user_space_id` | 可能仍在使用 |
| `get_user_household_ids` | `get_user_space_ids` | 可能仍在使用 |
| `update_user_current_household` | `update_user_current_space` | 可能仍在使用 |
| `create_household_with_user` | `create_space_with_user` | 可能仍在使用 |
| `get_household_member_users` | `get_space_member_users` | 可能仍在使用 |
| `remove_household_member` | `remove_space_member` | 可能仍在使用 |
| `is_household_admin` | `is_space_admin` | 可能仍在使用 |

## 📋 RLS 策略检查

### ✅ 必须存在的策略（使用新命名）

所有表的 RLS 策略都应使用新的函数名和表名：

- `spaces_*_policy` (不是 `households_*_policy`)
- `user_spaces_*_policy` (不是 `user_households_*_policy`)
- `space_invitations_*_policy` (不是 `household_invitations_*_policy`)
- `suppliers_*_policy` (不是 `stores_*_policy`)
- `supplier_merge_history_*_policy` (不是 `store_merge_history_*_policy`)

### ❌ 不应存在的旧策略名

- `households_*_policy`
- `user_households_*_policy`
- `household_invitations_*_policy`
- `stores_*_policy`
- `store_merge_history_*_policy`

## 📋 Storage 配置检查

### ✅ Storage Bucket

| Bucket 名称 | 用途 | 代码位置 |
|------------|------|----------|
| `receipts` | 存储小票图片 | `lib/supabase.ts` |

**配置要求**:
- Bucket 必须存在
- 建议设置为 Public（或配置适当的访问策略）

## 📋 环境变量检查

### ✅ 前端环境变量

在 `app.json` 或 EAS Secrets 中配置：

| 变量名 | 说明 | 代码位置 |
|--------|------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | `lib/supabase.ts` |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Gemini API Key（可选） | `lib/gemini.ts` |

## 🔍 验证步骤

### 1. 检查表名

在 Supabase SQL Editor 中执行：

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'spaces', 'user_spaces', 'suppliers', 'supplier_merge_history',
    'space_invitations', 'users', 'receipts', 'receipt_items',
    'categories', 'purposes', 'payment_accounts', 
    'payment_account_merge_history', 'ai_chat_logs'
  )
ORDER BY table_name;
```

**预期结果**: 应该返回所有 13 个表，不应该有 `households`, `stores` 等旧表名。

### 2. 检查列名

在 Supabase SQL Editor 中执行：

```sql
-- 检查是否还有旧的列名
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('household_id', 'current_household_id', 'store_id', 'store_name')
ORDER BY table_name, column_name;
```

**预期结果**: 应该返回空结果（没有旧列名）。

### 3. 检查 RPC 函数

在 Supabase SQL Editor 中执行：

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'get_user_space_id', 'get_user_space_ids', 'update_user_current_space',
    'create_space_with_user', 'get_space_member_users', 'remove_space_member',
    'is_space_admin', 'create_space_invitation', 'get_invitation_by_space_email',
    'create_default_categories', 'create_default_payment_accounts', 'create_default_purposes',
    'update_user_name'
  )
ORDER BY routine_name;
```

**预期结果**: 应该返回所有新函数名。

### 4. 检查 RLS 策略

在 Supabase SQL Editor 中执行：

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%household%' OR 
    policyname LIKE '%store%' OR
    policyname LIKE '%space%' OR
    policyname LIKE '%supplier%'
  )
ORDER BY tablename, policyname;
```

**预期结果**: 
- 应该只有 `space_*`, `supplier_*` 相关的策略
- 不应该有 `household_*`, `store_*` 相关的策略（除非是向后兼容的别名）

### 5. 检查 Storage Bucket

在 Supabase Dashboard > Storage 中：
- 确认 `receipts` bucket 存在
- 确认访问策略已正确配置

## ⚠️ 常见问题

### 问题 1: 表名未更新

**症状**: 代码报错 "relation does not exist"

**解决**: 执行表重命名脚本：
```sql
ALTER TABLE households RENAME TO spaces;
ALTER TABLE stores RENAME TO suppliers;
-- ... 等等
```

### 问题 2: 列名未更新

**症状**: 代码报错 "column does not exist"

**解决**: 执行列重命名脚本：
```sql
ALTER TABLE users RENAME COLUMN household_id TO space_id;
-- ... 等等
```

### 问题 3: RPC 函数不存在

**症状**: 代码报错 "function does not exist"

**解决**: 执行函数创建脚本（`update-database-functions.sql`）

### 问题 4: RLS 策略错误

**症状**: 查询被拒绝或权限错误

**解决**: 执行 RLS 策略更新脚本（`update-rls-policies-fixed.sql`）

## 📝 迁移脚本执行顺序

如果是从旧版本迁移，按以下顺序执行：

1. `rename-household-to-space-and-store-to-supplier-fixed.sql` - 重命名表和列
2. `fix-remaining-constraints.sql` - 修复约束
3. `fix-remaining-columns.sql` - 修复剩余列
4. `rename-household-invitations-table.sql` - 重命名邀请表
5. `update-database-functions.sql` - 更新函数
6. `update-rls-policies-fixed.sql` - 更新 RLS 策略
7. `create-missing-function-aliases-simple.sql` - 创建向后兼容别名
8. `cleanup-old-policy-aliases.sql` - 清理旧策略别名（可选）

## ✅ 最终检查清单

- [ ] 所有表名已更新为 `space`/`supplier` 命名
- [ ] 所有列名已更新为 `space_id`/`supplier_id`/`supplier_name`
- [ ] 所有 RPC 函数已更新为新的命名
- [ ] 所有 RLS 策略已更新为新的命名
- [ ] Storage bucket `receipts` 已创建
- [ ] 环境变量已正确配置
- [ ] 向后兼容的别名函数已创建（可选但建议）
- [ ] 所有迁移脚本已按顺序执行
