-- ============================================
-- 深度诊断 household_invitations INSERT 权限问题
-- 彻查所有可能触发 "permission denied for table users" 的地方
-- ============================================

-- ============================================
-- 第一部分：检查外键约束（最可能的原因）
-- ============================================

SELECT 
    '=== 外键约束检查 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column,
    CASE 
        WHEN condeferrable THEN 'DEFERRABLE'
        ELSE 'NOT DEFERRABLE'
    END as deferrable_status
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass;

-- ============================================
-- 第二部分：检查触发器（可能访问 users 表）
-- ============================================

SELECT 
    '=== 触发器检查 ===' as section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 检查触发器的详细定义
SELECT 
    '=== 触发器详细定义 ===' as section,
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'household_invitations'::regclass
  AND tgisinternal = false;

-- ============================================
-- 第三部分：检查 RLS 策略（特别是 INSERT 策略）
-- ============================================

SELECT 
    '=== household_invitations INSERT 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- ============================================
-- 第四部分：检查是否有函数在 RLS 策略中被调用
-- ============================================

-- 检查所有可能访问 users 表的函数
SELECT 
    '=== 可能访问 users 表的函数 ===' as section,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition LIKE '%users%'
    OR routine_definition LIKE '%FROM users%'
    OR routine_definition LIKE '%JOIN users%'
  )
  AND routine_definition LIKE '%auth.uid()%';

-- ============================================
-- 第五部分：检查 SELECT 策略（插入后可能触发）
-- ============================================

SELECT 
    '=== household_invitations SELECT 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'SELECT';

-- ============================================
-- 第六部分：检查表结构中的约束
-- ============================================

SELECT 
    '=== household_invitations 表结构 ===' as section,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'household_invitations'
ORDER BY ordinal_position;

-- ============================================
-- 第七部分：检查是否有 CHECK 约束访问 users 表
-- ============================================

SELECT 
    '=== CHECK 约束 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND contype = 'c';

-- ============================================
-- 第八部分：检查是否有默认值函数访问 users 表
-- ============================================

SELECT 
    '=== 默认值检查 ===' as section,
    column_name,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'household_invitations'
  AND column_default IS NOT NULL
  AND column_default LIKE '%users%';

-- ============================================
-- 第九部分：测试查询（模拟插入，查看详细错误）
-- ============================================

SELECT 
    '=== 测试说明 ===' as section,
    '请手动执行以下查询来测试插入权限（需要替换实际值）：' as instruction,
    'INSERT INTO household_invitations (household_id, inviter_id, inviter_email, invitee_email, token, expires_at) VALUES (''<household_id>'', auth.uid(), ''<inviter_email>'', ''<invitee_email>'', ''test-token-' || now()::text || ''', NOW() + INTERVAL ''7 days'') RETURNING *;' as test_query;

-- ============================================
-- 第十部分：检查是否有视图或物化视图
-- ============================================

SELECT 
    '=== 视图检查 ===' as section,
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition LIKE '%household_invitations%'
  AND view_definition LIKE '%users%';

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 诊断脚本执行完成！请检查上述结果。' as result;

