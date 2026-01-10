-- ============================================
-- 精准诊断：找出导致 "permission denied for table users" 的具体原因
-- ============================================

-- 检查 1：查看当前生效的 INSERT 策略（所有策略）
SELECT 
    '当前生效的 INSERT 策略' as check_type,
    policyname,
    roles,
    cmd,
    qual as using_clause,
    with_check,
    -- 检查是否包含 users 关键字
    CASE 
        WHEN with_check LIKE '%users%' OR qual LIKE '%users%' THEN '❌❌❌ 包含 users！'
        WHEN with_check LIKE '%FROM users%' OR qual LIKE '%FROM users%' THEN '❌❌❌ 查询 users 表！'
        WHEN with_check LIKE '%JOIN users%' OR qual LIKE '%JOIN users%' THEN '❌❌❌ JOIN users 表！'
        ELSE '✅ 不直接包含 users'
    END as direct_users_check,
    -- 检查是否调用了函数
    CASE 
        WHEN with_check ~* '\w+\s*\([^)]*\)' OR qual ~* '\w+\s*\([^)]*\)' THEN '⚠️  调用了函数'
        ELSE '✅ 没有函数调用'
    END as function_call_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 检查 2：查看 user_households 表的 SELECT 策略（关键！）
-- 因为 INSERT 策略查询了 user_households，所以这个表的策略很重要
SELECT 
    'user_households 表的 SELECT 策略' as check_type,
    policyname,
    roles,
    cmd,
    qual as using_clause,
    with_check,
    -- 检查是否包含 users
    CASE 
        WHEN qual LIKE '%users%' OR with_check LIKE '%users%' THEN '❌❌❌ 包含 users！'
        WHEN qual LIKE '%FROM users%' OR with_check LIKE '%FROM users%' THEN '❌❌❌ 查询 users 表！'
        WHEN qual LIKE '%JOIN users%' OR with_check LIKE '%JOIN users%' THEN '❌❌❌ JOIN users 表！'
        ELSE '✅ 不包含 users'
    END as contains_users,
    -- 检查是否调用了可能查询 users 的函数
    CASE 
        WHEN qual ~* 'get_user.*household' OR with_check ~* 'get_user.*household' THEN '⚠️  可能调用查询 users 的函数'
        ELSE '✅ 没有可疑函数调用'
    END as suspicious_function
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 检查 3：检查 get_user_household_id 等函数（这些函数可能查询 users）
SELECT 
    '可能查询 users 的函数' as check_type,
    routine_name,
    security_type,
    routine_type,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' OR routine_definition LIKE '%JOIN users%' THEN '❌❌❌ 查询 users 表！'
        WHEN routine_definition LIKE '%users.%' THEN '⚠️  可能访问 users 表'
        ELSE '✅ 不查询 users'
    END as query_users_status,
    LEFT(routine_definition, 300) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%user%household%' OR
    routine_name LIKE '%household%user%' OR
    routine_name = 'get_user_household_id'
  )
ORDER BY routine_name;

-- 检查 4：尝试最简单的插入测试（不查询 user_households）
-- 这会告诉我们问题是否在 INSERT 策略本身
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_error TEXT;
    test_error_code TEXT;
BEGIN
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户，无法测试';
        RETURN;
    END IF;
    
    -- 先获取一个家庭ID（使用简单查询，不触发复杂的 RLS）
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '❌ 用户没有家庭，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '=== 开始测试 ===';
    RAISE NOTICE '用户ID: %', test_user_id;
    RAISE NOTICE '家庭ID: %', test_household_id;
    
    -- 测试 1：尝试最简单的插入（直接插入，让 RLS 策略生效）
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
        
        RAISE NOTICE '✅✅✅ 插入成功！';
        ROLLBACK;
        
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            test_error = MESSAGE_TEXT,
            test_error_code = RETURNED_SQLSTATE;
            
        RAISE NOTICE '❌❌❌ 插入失败！';
        RAISE NOTICE '错误代码: %', test_error_code;
        RAISE NOTICE '错误信息: %', test_error;
        
        -- 如果是权限错误，尝试获取更多信息
        IF test_error_code = '42501' THEN
            RAISE NOTICE '这是权限错误（42501）';
            RAISE NOTICE '可能的原因：';
            RAISE NOTICE '  1. INSERT 策略查询了 users 表';
            RAISE NOTICE '  2. INSERT 策略调用的函数查询了 users 表';
            RAISE NOTICE '  3. INSERT 策略查询 user_households，而 user_households 的策略查询了 users';
        END IF;
    END;
    
    RAISE NOTICE '=== 测试结束 ===';
END $$;

-- 检查 5：检查是否有多个 INSERT 策略（可能有冲突的策略）
SELECT 
    '策略冲突检查' as check_type,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) > 1 THEN '⚠️  有多个 INSERT 策略（可能有冲突）'
        WHEN COUNT(*) = 1 THEN '✅ 只有一个 INSERT 策略'
        ELSE '❌ 没有 INSERT 策略'
    END as status,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

