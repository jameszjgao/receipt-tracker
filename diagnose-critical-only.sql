-- ============================================
-- 关键诊断：重点检查可能查询 users 表的地方
-- ============================================

-- 关键检查 1：INSERT 策略的完整内容（这是最可能的问题来源）
SELECT 
    '🔍 INSERT 策略完整内容' as check_type,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' OR qual LIKE '%users%' THEN '❌❌❌ 包含 users 表查询！'
        WHEN with_check LIKE '%user_households%' OR qual LIKE '%user_households%' THEN '✅ 只查询 user_households'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 关键检查 2：检查 INSERT 策略是否引用了其他函数（这些函数可能查询 users）
SELECT 
    '🔍 INSERT 策略中的函数调用' as check_type,
    policyname,
    with_check,
    -- 提取函数调用
    regexp_matches(with_check, '(\w+\([^)]*\))', 'g') as function_calls
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
  AND (with_check ~* '\(.*\)' OR qual ~* '\(.*\)');

-- 关键检查 3：检查所有可能被 RLS 策略调用的函数（这些函数可能查询 users）
SELECT 
    '🔍 可能被调用的函数' as check_type,
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' OR routine_definition LIKE '%JOIN users%' THEN '❌ 包含 users 表查询'
        WHEN routine_definition LIKE '%users.%' THEN '⚠️  可能包含 users 表'
        ELSE '✅ 不包含 users 表'
    END as status,
    -- 只显示函数定义的前 200 个字符（避免太长）
    LEFT(routine_definition, 200) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%user%' OR 
    routine_name LIKE '%household%' OR
    routine_name LIKE '%invitation%'
  )
ORDER BY routine_name;

-- 关键检查 4：尝试直接插入（这会显示最详细的错误信息）
-- 这是最重要的测试，会触发所有检查并显示具体错误
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_error TEXT;
    test_error_code TEXT;
BEGIN
    -- 获取当前用户ID
    test_user_id := auth.uid();
    
    RAISE NOTICE '=== 开始插入测试 ===';
    RAISE NOTICE '当前用户ID: %', test_user_id;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    -- 获取用户的家庭ID
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    RAISE NOTICE '用户家庭ID: %', test_household_id;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '❌ 用户没有管理员权限的家庭';
        RETURN;
    END IF;
    
    -- 尝试插入（这会触发所有检查）
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
        -- 回滚测试数据
        ROLLBACK;
        
    EXCEPTION WHEN OTHERS THEN
        test_error := SQLERRM;
        test_error_code := SQLSTATE;
        
        RAISE NOTICE '❌❌❌ 插入失败！';
        RAISE NOTICE '错误代码: %', test_error_code;
        RAISE NOTICE '错误信息: %', test_error;
        RAISE NOTICE '错误详情: %', SQLERRM;
        
        -- 获取更详细的错误信息
        GET STACKED DIAGNOSTICS 
            test_error = MESSAGE_TEXT,
            test_error_code = RETURNED_SQLSTATE;
            
        RAISE NOTICE '堆栈诊断 - 错误代码: %', test_error_code;
        RAISE NOTICE '堆栈诊断 - 错误信息: %', test_error;
    END;
    
    RAISE NOTICE '=== 插入测试结束 ===';
END $$;

-- 关键检查 5：检查是否有隐藏的约束或检查
SELECT 
    '🔍 所有约束（包括隐藏的）' as check_type,
    conname as constraint_name,
    contype as constraint_type,
    CASE contype
        WHEN 'f' THEN '外键约束'
        WHEN 'c' THEN '检查约束'
        WHEN 'p' THEN '主键约束'
        WHEN 'u' THEN '唯一约束'
        ELSE '其他'
    END as constraint_type_name,
    pg_get_constraintdef(oid) as constraint_definition,
    -- 检查约束定义中是否包含 users
    CASE 
        WHEN pg_get_constraintdef(oid) LIKE '%users%' THEN '❌ 包含 users'
        ELSE '✅ 不包含 users'
    END as contains_users
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
ORDER BY contype, conname;

