# 修复 user_spaces SELECT 策略说明

## 问题分析

根据检查结果，`user_spaces_select_policy` 策略存在**循环依赖问题**：

### 当前策略（有问题）：
```sql
((user_id = auth.uid()) 
 OR 
 (space_id IN (
   SELECT user_spaces_1.space_id
   FROM user_spaces user_spaces_1
   WHERE (user_spaces_1.user_id = auth.uid())
 )))
```

**问题**：这个策略在查询 `user_spaces` 表时，又查询 `user_spaces` 表，导致：
1. **性能问题**：每次查询都要执行子查询
2. **可能的循环依赖**：在某些情况下可能导致查询失败
3. **不必要的复杂性**：第二个条件实际上是冗余的

### 正确的策略：
```sql
user_id = auth.uid()
```

**原因**：
- `getUserSpaces()` 函数只需要查询用户自己的 `user_spaces` 记录
- 不需要查看其他用户的记录
- 简单、高效、无循环依赖

## 执行修复

### 方法1：使用简化脚本（推荐）

运行 `fix-user-spaces-rls-simple.sql`：

```sql
-- 删除现有策略
DROP POLICY IF EXISTS "user_spaces_select_policy" ON user_spaces;

-- 创建正确策略
CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 方法2：使用完整脚本

运行修复后的 `fix-user-spaces-rls.sql`（已修复语法错误）

## 验证修复

运行以下查询验证：

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT';
```

应该看到：
- `policyname`: `user_spaces_select_policy`
- `qual`: `(user_id = auth.uid())`

## 测试

修复后，重新测试应用：

1. **重新构建应用**（如果需要）：
   ```bash
   npx expo run:android  # 或 ios
   ```

2. **登录现有账号**

3. **查看日志**，应该看到：
   ```
   getUserSpaces: Querying for user_id: <user_id>
   getUserSpaces: Found X spaces for user <user_id>
   Index: User spaces count: X
   ```

## 如果仍然无法识别Space

如果修复策略后仍然无法识别space，检查：

### 1. 数据库中是否有 user_spaces 记录

```sql
-- 替换 YOUR_USER_ID 为实际用户ID
SELECT 
  us.id,
  us.user_id,
  us.space_id,
  s.name as space_name
FROM user_spaces us
LEFT JOIN spaces s ON s.id = us.space_id
WHERE us.user_id = 'YOUR_USER_ID';
```

**如果返回空结果**，说明数据库中没有记录，需要手动创建：

```sql
-- 创建关联（替换 YOUR_USER_ID 和 SPACE_ID）
INSERT INTO user_spaces (user_id, space_id, is_admin)
VALUES ('YOUR_USER_ID', 'SPACE_ID', true);
```

### 2. 检查用户ID是否匹配

确保应用中的用户ID与数据库中的 `user_spaces.user_id` 一致。

### 3. 检查 spaces 表的 SELECT 策略

虽然 `spaces` 表的策略看起来正常，但确保策略允许查询：

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'spaces' AND cmd = 'SELECT';
```

应该看到 `spaces_select_policy`，条件应该包含通过 `user_spaces` 关联的space。

## 总结

修复的关键点：
1. ✅ 简化 `user_spaces_select_policy`，移除循环依赖
2. ✅ 确保策略允许用户查看自己的记录：`user_id = auth.uid()`
3. ✅ 验证策略已正确创建
4. ✅ 测试应用功能

修复后，`getUserSpaces()` 函数应该能够正常查询到用户的space关联记录。
