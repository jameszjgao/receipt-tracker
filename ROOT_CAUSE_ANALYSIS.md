# 根本原因分析

## 🔍 问题现象
- 错误：`permission denied for table users`
- 外键约束已经移除（已验证）
- 仍然报错

## 💡 可能的原因分析

### 原因 1：INSERT 策略查询 user_households 表，触发递归查询
**最可能的原因！**

当执行 INSERT 时：
```sql
WITH CHECK (
  inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_households.user_id = auth.uid()
      AND user_households.household_id = household_invitations.household_id
      AND user_households.is_admin = TRUE
  )
)
```

这个 `EXISTS (SELECT 1 FROM user_households ...)` 查询会触发 `user_households` 表的 RLS 策略。

**如果 `user_households` 表的 SELECT 策略查询了 `users` 表**，就会导致：
1. INSERT 策略检查 → 查询 user_households 表
2. user_households 表的 RLS 策略 → 查询 users 表
3. users 表的 RLS 策略 → 权限错误

### 原因 2：INSERT 策略调用了查询 users 的函数
INSERT 策略可能调用了某个函数（比如 `get_user_household_id()`），而这个函数内部查询了 users 表。

### 原因 3：有旧的策略没有被删除
可能有多个 INSERT 策略存在，旧的策略还在查询 users 表。

### 原因 4：user_households 表的 SELECT 策略有问题
即使我们的 INSERT 策略不直接查询 users，但通过查询 user_households，可能间接触发了对 users 的查询。

## 🎯 诊断步骤

### 步骤 1：检查 INSERT 策略的完整内容
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';
```

**重点检查**：
- `with_check` 中是否包含 `users` 关键字
- 是否调用了可能查询 users 的函数

### 步骤 2：检查 user_households 表的 SELECT 策略
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
  AND cmd = 'SELECT';
```

**重点检查**：
- SELECT 策略是否查询了 users 表
- 是否有递归查询的问题

### 步骤 3：检查所有可能被调用的函数
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%users%'
  AND routine_definition LIKE '%user_households%';
```

### 步骤 4：执行直接插入测试
这会显示最详细的错误信息，包括：
- 具体哪个策略导致的问题
- 错误发生在哪个步骤

## 📋 最可能的情况

基于分析，**最可能的情况是**：
- INSERT 策略查询 `user_households` 表
- `user_households` 表的 SELECT 策略查询了 `users` 表
- 导致递归查询和权限错误

## ✅ 解决方案方向

1. **确保 user_households 表的 SELECT 策略不查询 users 表**
2. **简化 INSERT 策略，避免查询 user_households（如果可能）**
3. **或者使用 SECURITY DEFINER 函数完全绕过 RLS**

