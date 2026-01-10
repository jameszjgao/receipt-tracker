-- ============================================
-- 诊断 household_invitations INSERT 权限问题
-- ============================================

-- 1. 检查 household_invitations 表的结构和外键约束
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

-- 2. 检查外键约束（可能引用 users 表）
SELECT 
    '=== 外键约束 ===' as section,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND ccu.table_name = 'users';

-- 3. 检查触发器（可能访问 users 表）
SELECT 
    '=== 触发器 ===' as section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 4. 检查当前的 RLS 策略
SELECT 
    '=== 当前 RLS 策略 ===' as section,
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

-- 5. 检查 users 表的 RLS 策略（可能阻止访问）
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

-- 6. 检查是否有函数在 RLS 策略中被调用，且该函数访问了 users 表
SELECT 
    '=== 可能访问 users 表的函数 ===' as section,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%users%'
  AND routine_definition LIKE '%auth.uid()%';

-- 7. 测试：尝试模拟插入（需要替换为实际的用户ID和家庭ID）
-- 注意：这个查询会失败，但可以看到详细的错误信息
SELECT 
    '=== 测试查询（需要替换实际值）===' as section,
    '请手动执行以下查询来测试插入权限：' as instruction,
    'INSERT INTO household_invitations (household_id, inviter_id, inviter_email, invitee_email, token, expires_at) VALUES (''<household_id>'', auth.uid(), ''<inviter_email>'', ''<invitee_email>'', ''test-token'', NOW() + INTERVAL ''7 days'');' as test_query;

-- 8. 检查 inviter_id 字段是否有外键约束到 users 表
SELECT 
    '=== inviter_id 外键详情 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass
  AND confrelid = 'users'::regclass;

