# 彻底问题分析报告

## 📊 诊断结果分析

### ✅ 已确认的事实

1. **外键约束已移除** ✓
   - 从诊断结果看，`household_invitations` 表只有以下约束：
     - `household_invitations_household_id_fkey` → `households(id)` (这个正常)
     - `household_invitations_pkey` → 主键
     - `household_invitations_token_key` → 唯一约束
     - `valid_status` → 检查约束
   - **没有** `inviter_id` 到 `users` 表的外键约束

2. **错误信息**
   - `permission denied for table users`
   - 发生在 INSERT 操作时

### ❓ 需要进一步排查的点

由于外键约束已经移除，但仍然报错，说明问题出在其他地方。可能的原因：

## 🔍 可能的问题来源

### 1. INSERT RLS 策略中查询 users 表

**检查方法**：执行以下 SQL 查看 INSERT 策略的详细内容
```sql
SELECT 
    policyname,
    cmd,
    with_check,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';
```

**可能的问题**：
- `with_check` 子句中可能包含查询 `users` 表的逻辑
- 即使我们之前创建的策略看起来没问题，但可能有多个策略存在
- 策略中的函数（如 `get_user_household_id()`）可能在查询 `users` 表

### 2. 触发器函数查询 users 表

**检查方法**：执行以下 SQL 查看所有触发器
```sql
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';
```

**可能的问题**：
- `BEFORE INSERT` 触发器可能在查询 `users` 表
- 触发器调用的函数可能在查询 `users` 表

### 3. 其他表的外键约束反向引用

**检查方法**：检查是否有其他表的外键引用 `household_invitations.inviter_id`
```sql
SELECT 
    tc.table_name AS referencing_table,
    kcu.column_name AS referencing_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users'
  AND ccu.column_name = 'id';
```

**可能的问题**：虽然不太可能，但检查一下是否有反向引用

### 4. RLS 策略中使用的函数查询 users 表

**检查方法**：检查所有可能被 RLS 策略调用的函数
```sql
-- 检查 get_user_household_id() 函数
SELECT routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';
```

**可能的问题**：
- `get_user_household_id()` 函数在查询 `users` 表
- 虽然使用了 `SECURITY DEFINER`，但在某些情况下可能仍然失败

### 5. 表定义中的 CHECK 约束查询 users 表

**检查方法**：检查所有 CHECK 约束
```sql
SELECT 
    conname,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND contype = 'c';
```

**可能的问题**：CHECK 约束可能在查询 `users` 表

### 6. Supabase 的隐藏机制

**可能的问题**：
- Supabase 可能有某些内部机制在检查外键
- 虽然我们移除了外键约束，但可能有缓存的元数据

## 🎯 系统排查步骤

请按顺序执行以下检查：

### 步骤 1: 检查 INSERT 策略详情
```sql
-- 完整的 INSERT 策略检查
SELECT 
    'INSERT 策略检查' as check_type,
    policyname,
    cmd,
    with_check,
    qual as using_clause,
    CASE 
        WHEN with_check LIKE '%users%' OR qual LIKE '%users%' THEN '❌ 包含 users 表'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  使用 get_user_household_id 函数'
        ELSE '✅ 不包含 users 表'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';
```

### 步骤 2: 检查所有触发器
```sql
-- 完整的触发器检查
SELECT 
    '触发器检查' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation,
    CASE 
        WHEN action_statement LIKE '%users%' THEN '❌ 可能查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';
```

### 步骤 3: 检查 get_user_household_id 函数
```sql
-- 检查函数定义
SELECT 
    '函数检查' as check_type,
    routine_name,
    security_type,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' OR routine_definition LIKE '%JOIN users%' THEN '❌ 查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';
```

### 步骤 4: 检查实际插入时的详细错误
```sql
-- 在 SQL Editor 中尝试直接插入，查看详细错误信息
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    admin_check BOOLEAN;
BEGIN
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '没有认证用户';
        RETURN;
    END IF;
    
    -- 获取家庭ID并检查是否是管理员
    SELECT household_id, is_admin INTO test_household_id, admin_check
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '用户不是任何家庭的管理员';
        RETURN;
    END IF;
    
    RAISE NOTICE '准备插入，用户ID: %, 家庭ID: %', test_user_id, test_household_id;
    
    -- 尝试插入
    BEGIN
        INSERT INTO household_invitations (
            household_id,
            inviter_id,
            inviter_email,
            invitee_email,
            token,
            expires_at
        ) VALUES (
            test_household_id,
            test_user_id,
            'test@example.com',
            'test@example.com',
            'test-token-' || gen_random_uuid()::text,
            NOW() + INTERVAL '7 days'
        );
        RAISE NOTICE '✅ 插入成功！';
        ROLLBACK; -- 回滚测试数据
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ 插入失败！';
        RAISE NOTICE '错误代码: %', SQLSTATE;
        RAISE NOTICE '错误信息: %', SQLERRM;
        RAISE NOTICE '错误详情: %', pg_exception_detail();
        RAISE NOTICE '错误上下文: %', pg_exception_context();
    END;
END $$;
```

### 步骤 5: 检查是否有多个 INSERT 策略冲突
```sql
-- 检查是否有多个 INSERT 策略
SELECT 
    '策略冲突检查' as check_type,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';
```

## 🎯 最可能的原因

基于目前的信息，**最可能的原因是**：

1. **INSERT 策略中的函数查询 users 表**
   - `get_user_household_id()` 函数可能在查询 `users` 表
   - 即使使用了 `SECURITY DEFINER`，在某些执行上下文中可能仍然失败

2. **多个 INSERT 策略冲突**
   - 可能存在多个 INSERT 策略，其中某个策略在查询 `users` 表
   - PostgreSQL 的 RLS 策略是 OR 关系，任何一个策略允许就可以

3. **触发器在查询 users 表**
   - 可能有我们不知道的触发器在 INSERT 时触发

## 📋 下一步行动计划

1. **先执行上述 5 个步骤的检查 SQL**
2. **收集所有检查结果**
3. **根据结果确定具体问题**
4. **针对性地修复**

请执行上述检查步骤，并提供结果，我会根据结果给出精确的修复方案。

