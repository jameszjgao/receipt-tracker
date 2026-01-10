-- ============================================
-- 完整诊断 household_invitations INSERT 权限问题
-- ============================================

-- 1. 检查外键约束详情
SELECT 
    '=== 外键约束详情 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column,
    CASE 
        WHEN condeferrable THEN 'DEFERRABLE'
        ELSE 'NOT DEFERRABLE'
    END as deferrable_status,
    CASE 
        WHEN condeferred THEN 'DEFERRED'
        ELSE 'IMMEDIATE'
    END as deferred_status
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass
  AND confrelid = 'users'::regclass;

-- 2. 检查 users 表的 RLS 策略
SELECT 
    '=== users 表 RLS 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 3. 检查 household_invitations 表的 RLS 策略
SELECT 
    '=== household_invitations 表 RLS 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- 4. 测试：检查当前用户是否可以查看自己的 users 记录
-- 注意：这个查询需要在实际用户会话中执行
SELECT 
    '=== 测试查询（需要在用户会话中执行）===' as section,
    'SELECT * FROM users WHERE id = auth.uid();' as test_query_1,
    'SELECT * FROM household_invitations LIMIT 1;' as test_query_2;

-- 5. 检查是否有触发器
SELECT 
    '=== 触发器检查 ===' as section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 6. 检查表结构
SELECT 
    '=== household_invitations 表结构 ===' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'household_invitations'
ORDER BY ordinal_position;

