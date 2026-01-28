# 修复成员显示和小票记录者问题

## 问题描述

1. **未移除的成员显示成了 "removed"**
2. **对应成员扫码的历史小票的记录者不显示了**

## 问题分析

### 问题 1：成员误判为 "removed"

**位置**：`app/space-members.tsx` 的 `loadAndClassifyInvitations` 函数

**原因**：
- 第123-129行的逻辑有问题：
  ```typescript
  } else if (inv.status === 'accepted') {
    if (!isMember) {
      // 已接受但不在成员列表中，说明被移除了（保持向后兼容）
      removed.push(inv);
    }
  ```
- 如果 `isMember` 为 `false`（可能是因为 RPC 函数失败、RLS 问题、或用户邮箱不匹配），会将 `accepted` 状态的邀请误判为 `removed`
- **应该只根据 `inv.status === 'removed'` 来判断**，而不是根据 `isMember`

**已修复**：修改了逻辑，只根据邀请状态分类，不再根据 `isMember` 推断状态。

### 问题 2：小票记录者不显示

**位置**：`lib/database.ts` 的 `getAllReceipts` 函数

**原因**：
- 查询了 `created_by_user:users!created_by`，但如果 `created_by` 指向的用户：
  1. 不在当前 space 的成员列表中（已被移除）
  2. RLS 策略阻止查询该用户
  3. 用户记录不存在
- 就会导致 `created_by_user` 为 `null`，记录者信息不显示

**需要修复**：确保 users 表的 RLS 策略允许查询同 space 的用户（即使他们已经被移除）

## 修复步骤

### 步骤 1：修复代码逻辑（已完成）

已修改 `app/space-members.tsx`，只根据邀请状态分类，不再误判。

### 步骤 2：修复数据库 RLS 策略

运行 `fix-member-removed-display.sql`：

```sql
-- 在 Supabase SQL Editor 中执行
```

这个脚本会：
1. 创建新的 RLS 策略，允许查询同 space 的用户
2. 即使用户已经被移除，只要历史记录中有关联，就能查询到用户信息

### 步骤 3：验证修复

#### 检查成员显示

1. 打开应用 → Space Members 页面
2. 检查是否还有未移除的成员显示为 "removed"
3. 应该只显示真正被移除的成员（邀请状态为 'removed'）

#### 检查小票记录者

1. 打开应用 → Receipts 页面
2. 查看历史小票
3. 检查记录者信息是否显示
4. 即使成员已被移除，历史小票的记录者应该仍然显示

## 如果问题仍然存在

### 检查邀请状态

运行以下 SQL 查询：

```sql
-- 检查邀请状态
SELECT 
  si.id,
  si.invitee_email,
  si.status,
  si.space_id,
  s.name as space_name
FROM space_invitations si
LEFT JOIN spaces s ON s.id = si.space_id
ORDER BY si.created_at DESC
LIMIT 20;
```

**如果看到**：
- `status = 'accepted'` 但用户还在成员列表中 → 这是正常的，不应该显示为 removed
- `status = 'removed'` → 这是真正被移除的，应该显示为 removed

### 检查用户查询权限

运行以下 SQL 查询：

```sql
-- 检查 users 表的 RLS 策略
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;
```

**应该看到**：
- `users_select_same_space` 策略（允许查询同 space 的用户）

### 检查小票的 created_by

运行以下 SQL 查询：

```sql
-- 检查小票的 created_by 和用户信息
SELECT 
  r.id,
  r.supplier_name,
  r.created_by,
  u.email as created_by_email,
  u.name as created_by_name,
  r.created_at
FROM receipts r
LEFT JOIN users u ON u.id = r.created_by
ORDER BY r.created_at DESC
LIMIT 20;
```

**如果看到**：
- `created_by` 不为 null，但 `created_by_email` 为 null → 说明 RLS 策略阻止了查询
- 需要运行 `fix-member-removed-display.sql` 修复

## 总结

- ✅ **代码逻辑已修复**：不再误判 accepted 状态为 removed
- ⏳ **需要执行 SQL**：运行 `fix-member-removed-display.sql` 修复 RLS 策略
- ✅ **修复后**：成员显示正确，小票记录者正常显示

## 下一步

1. **执行 SQL 脚本**：在 Supabase SQL Editor 中运行 `fix-member-removed-display.sql`
2. **重新测试**：检查成员显示和小票记录者是否正常
3. **如果还有问题**：提供具体的错误信息或查询结果
