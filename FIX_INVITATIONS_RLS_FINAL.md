# 修复邀请功能的 RLS 策略 - 最终解决方案

## 问题描述
- 用户无法获取待处理的邀请
- 用户无法查看家庭信息
- 错误信息：`permission denied for table users`

## 解决步骤

### 步骤 1：执行诊断脚本（可选但推荐）
在 Supabase SQL Editor 中执行 `diagnose-rls-for-invitations.sql`，查看当前策略状态。

### 步骤 2：执行强制修复脚本
**重要**：在 Supabase SQL Editor 中执行 `fix-rls-force-for-invitations.sql`

这个脚本会：
1. 强制删除所有现有的 users 和 households 表策略
2. 重新创建所有必需的策略
3. 验证策略是否正确创建

### 步骤 3：验证执行结果
执行脚本后，应该看到两个验证表格：
- **Users Policies Created**：应该显示 4 个策略（SELECT、INSERT、UPDATE）
- **Households Policies Created**：应该显示 4 个策略（SELECT、INSERT、UPDATE）

关键策略：
- ✅ `users_select_own` - 必须存在，允许用户查看自己的记录
- ✅ `households_select_invited` - 必须存在，允许用户查看被邀请的家庭

### 步骤 4：测试
1. 重新启动应用
2. 尝试登录
3. 检查是否还有权限错误

## 如果仍然失败

### 检查点 1：确认策略存在
在 Supabase SQL Editor 中运行：
```sql
SELECT policyname, cmd 
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT';
```

应该看到 `users_select_own` 策略。

### 检查点 2：确认 RLS 已启用
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'households');
```

`rowsecurity` 列应该都是 `true`。

### 检查点 3：测试当前用户权限
在有用户登录的情况下运行：
```sql
SELECT COUNT(*) FROM users WHERE id = auth.uid();
```

如果返回 0，说明策略没有正确工作。

### 检查点 4：检查是否有策略冲突
```sql
SELECT policyname, cmd, qual 
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;
```

确保没有多个冲突的 SELECT 策略。

## 常见问题

### Q: 执行脚本后仍然报错
A: 
1. 确保你是项目管理员
2. 尝试刷新 Supabase Dashboard
3. 确保没有其他 SQL 脚本同时修改这些策略

### Q: 策略已创建但仍然无法访问
A: 
1. 检查策略的 `qual`（USING 子句）是否正确
2. 确认 `auth.uid()` 返回正确的用户 ID
3. 尝试在应用中断开并重新连接 Supabase

### Q: 如何确认策略正在工作？
A: 执行诊断脚本 `diagnose-rls-for-invitations.sql`，查看测试结果。

