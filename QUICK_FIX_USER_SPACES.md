# 快速修复：登录后无法识别已有Space

## 问题诊断

根据你提供的诊断结果，`spaces` 表的 RLS 策略是正常的，但**关键问题可能在 `user_spaces` 表的 SELECT 策略**。

`getUserSpaces()` 函数查询的是 `user_spaces` 表，如果这个表没有正确的 SELECT 策略，就会返回空结果。

## 立即执行修复

### 步骤1：检查 user_spaces 表的 RLS 策略

在 Supabase SQL Editor 中运行：

```sql
-- 检查 user_spaces 表的 SELECT 策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT';
```

**如果返回空结果或策略有问题，继续步骤2。**

### 步骤2：执行修复脚本

运行 `fix-user-spaces-rls.sql`：

```sql
-- 在 Supabase SQL Editor 中执行 fix-user-spaces-rls.sql
```

或者直接执行以下SQL：

```sql
-- 删除所有现有的 user_spaces SELECT 策略
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_spaces'
      AND cmd = 'SELECT'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_spaces', r.policyname);
  END LOOP;
END $$;

-- 创建正确的 SELECT 策略
CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 步骤3：验证修复

运行检查脚本：

```sql
-- 检查策略是否已创建
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT';
```

应该看到 `user_spaces_select_policy` 策略。

### 步骤4：测试应用

1. **重新构建应用**（如果已安装，可以跳过）：
   ```bash
   npx expo run:android  # 或 ios
   ```

2. **登录现有账号**

3. **查看日志**，应该看到：
   ```
   getUserSpaces: Querying for user_id: <user_id>
   getUserSpaces: Found X spaces for user <user_id>
   ```

## 如果问题仍然存在

### 检查数据是否存在

运行以下查询（替换 `YOUR_USER_ID` 为实际用户ID）：

```sql
-- 检查用户是否有 user_spaces 记录
SELECT 
  us.id,
  us.user_id,
  us.space_id,
  us.is_admin,
  s.name as space_name
FROM user_spaces us
LEFT JOIN spaces s ON s.id = us.space_id
WHERE us.user_id = 'YOUR_USER_ID';
```

**如果返回空结果**，说明数据库中没有 `user_spaces` 记录，需要手动创建：

```sql
-- 创建 user_spaces 关联（替换 YOUR_USER_ID 和 SPACE_ID）
INSERT INTO user_spaces (user_id, space_id, is_admin)
VALUES ('YOUR_USER_ID', 'SPACE_ID', true);
```

### 检查用户ID是否匹配

在应用中添加临时日志，查看实际的用户ID：

```typescript
// 在 getUserSpaces 函数中添加
const { data: { user: authUser } } = await supabase.auth.getUser();
console.log('Current auth user ID:', authUser?.id);
```

然后与数据库中的 `user_spaces.user_id` 对比，确保一致。

## 常见问题

### Q: 策略创建后仍然无法查询

**A:** 检查：
1. 用户是否已登录（`auth.uid()` 不为 null）
2. `user_spaces` 表中是否有该用户的记录
3. 策略是否正确应用（运行验证查询）

### Q: 创建space时仍然提示邮件确认

**A:** 这是另一个问题，已在前面的修复中处理。如果仍然出现：
1. 查看新的错误信息（应该更详细）
2. 检查是否是RLS错误还是其他错误
3. 检查 `users` 表的 INSERT 策略

## 下一步

修复后，请：
1. ✅ 重新构建应用
2. ✅ 测试登录和space识别
3. ✅ 测试创建新space
4. ✅ 查看应用日志确认问题已解决

如果问题仍然存在，请提供：
- `user_spaces` 表的 RLS 策略查询结果
- 用户的实际 `user_spaces` 记录查询结果
- 应用日志中的错误信息
