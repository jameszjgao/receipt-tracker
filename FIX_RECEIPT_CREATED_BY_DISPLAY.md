# 修复小票记录者不显示的问题

## 问题

对应成员扫码的历史小票的记录者不显示了。

## 原因分析

在 `lib/database.ts` 的 `getAllReceipts` 函数中：

```typescript
created_by_user:users!created_by (
  id,
  email,
  name,
  current_space_id
)
```

如果 `created_by` 指向的用户：
1. **不在当前 space 的成员列表中**（已被移除）
2. **RLS 策略阻止查询**该用户
3. **用户记录不存在**

就会导致 `created_by_user` 为 `null`，记录者信息不显示。

## 解决方案

### 步骤 1：执行 SQL 脚本修复 RLS 策略

在 Supabase SQL Editor 中运行 `fix-users-rls-for-receipts-created-by.sql`：

这个脚本会：
1. 创建新的 RLS 策略 `users_select_same_space`
2. 允许查询：
   - 自己的记录
   - 同 space 的用户（通过 `user_spaces` 表）
   - **在 receipts 表中作为 `created_by` 的用户**（历史记录）

### 步骤 2：验证修复

运行以下查询检查：

```sql
-- 检查 users 表的 SELECT 策略
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;
```

应该看到 `users_select_same_space` 策略。

### 步骤 3：测试查询

```sql
-- 测试：查询小票的 created_by 用户信息
SELECT 
  r.id,
  r.supplier_name,
  r.created_by,
  u.email as created_by_email,
  u.name as created_by_name
FROM receipts r
LEFT JOIN users u ON u.id = r.created_by
WHERE r.space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
)
ORDER BY r.created_at DESC
LIMIT 10;
```

如果 `created_by_email` 和 `created_by_name` 有值，说明修复成功。

## 如果问题仍然存在

### 检查 created_by 字段

```sql
-- 检查小票的 created_by 字段
SELECT 
  COUNT(*) as total_receipts,
  COUNT(created_by) as receipts_with_created_by,
  COUNT(*) - COUNT(created_by) as receipts_without_created_by
FROM receipts
WHERE space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
);
```

如果 `receipts_without_created_by` 很多，说明历史小票的 `created_by` 字段为 null。

### 更新历史小票的 created_by（如果需要）

如果历史小票的 `created_by` 为 null，可以尝试更新：

```sql
-- 注意：这个更新可能不准确，因为无法确定历史小票的真正创建者
-- 只更新 created_by 为 null 的小票
UPDATE receipts r
SET created_by = (
  SELECT us.user_id
  FROM user_spaces us
  WHERE us.space_id = r.space_id
  ORDER BY us.created_at ASC
  LIMIT 1
)
WHERE r.created_by IS NULL
AND r.space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
);
```

**注意**：这个更新可能不准确，因为无法确定历史小票的真正创建者。建议只在测试环境执行。

## 总结

- ✅ **已创建 SQL 脚本**：`fix-users-rls-for-receipts-created-by.sql`
- ⏳ **需要执行**：在 Supabase SQL Editor 中运行脚本
- ✅ **修复后**：历史小票的记录者信息应该能正常显示

## 下一步

1. **执行 SQL 脚本**：在 Supabase SQL Editor 中运行 `fix-users-rls-for-receipts-created-by.sql`
2. **重新测试**：检查小票记录者是否正常显示
3. **如果还有问题**：提供具体的错误信息或查询结果
