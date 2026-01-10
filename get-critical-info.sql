-- ============================================
-- 获取关键诊断信息
-- 请执行此脚本并提供所有结果（特别是检查 1 和检查 5）
-- ============================================

-- ============================================
-- 检查 1: get_user_household_id 函数的实际定义（最重要！）
-- ============================================
SELECT 
    '=== 检查 1: get_user_household_id 函数（最关键）===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%'
          OR routine_definition LIKE '%current_household_id%'
          OR routine_definition LIKE '%users WHERE%' THEN '❌ 仍然查询 users 表！这是问题！'
        WHEN routine_definition LIKE '%FROM user_households%' THEN '✅ 只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- ============================================
-- 检查 2: INSERT 策略的详细内容
-- ============================================
SELECT 
    '=== 检查 2: INSERT 策略详情 ===' as section,
    policyname,
    cmd,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用 get_user_household_id 函数'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- ============================================
-- 检查 3: 所有触发器
-- ============================================
SELECT 
    '=== 检查 3: 所有触发器 ===' as section,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    CASE 
        WHEN action_statement LIKE '%users%' THEN '❌ 触发器可能查询 users 表'
        ELSE '✅ 触发器不查询 users 表'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- ============================================
-- 检查 4: 所有可能被调用的函数
-- ============================================
SELECT 
    '=== 检查 4: 所有可能查询 users 的函数 ===' as section,
    routine_name,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' THEN '❌ 查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition LIKE '%household_invitations%'
    OR routine_definition LIKE '%inviter%'
    OR routine_name LIKE '%invitation%'
  )
  AND (routine_definition LIKE '%users%' OR routine_definition LIKE '%FROM%');

-- ============================================
-- 检查 5: 直接插入测试（最关键！会显示详细错误）
-- ============================================
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    admin_check BOOLEAN;
    error_detail TEXT;
    error_hint TEXT;
    error_context TEXT;
    error_sqlstate TEXT;
    error_message TEXT;
BEGIN
    RAISE NOTICE '=== 检查 5: 直接插入测试（最关键！）===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    RAISE NOTICE '当前用户ID: %', test_user_id;
    
    -- 获取家庭ID并检查是否是管理员
    SELECT household_id, is_admin INTO test_household_id, admin_check
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '❌ 用户不是任何家庭的管理员';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    RAISE NOTICE '准备插入测试数据...';
    
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
        RAISE NOTICE '✅✅✅ 插入成功！所有检查都通过！';
        ROLLBACK;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            error_sqlstate = RETURNED_SQLSTATE,
            error_message = MESSAGE_TEXT,
            error_detail = PG_EXCEPTION_DETAIL,
            error_hint = PG_EXCEPTION_HINT,
            error_context = PG_EXCEPTION_CONTEXT;
            
        RAISE NOTICE '❌ 插入失败！';
        RAISE NOTICE '错误代码 (SQLSTATE): %', error_sqlstate;
        RAISE NOTICE '错误信息: %', error_message;
        RAISE NOTICE '错误详情: %', COALESCE(error_detail, '无详情');
        RAISE NOTICE '错误提示: %', COALESCE(error_hint, '无提示');
        RAISE NOTICE '错误上下文: %', COALESCE(error_context, '无上下文');
        
        -- 如果是权限错误
        IF error_sqlstate = '42501' THEN
            RAISE NOTICE '';
            RAISE NOTICE '⚠️  这是权限错误 (42501)';
            RAISE NOTICE '   可能的原因：';
            RAISE NOTICE '   1. INSERT 策略中的函数在查询 users 表';
            RAISE NOTICE '   2. 触发器在查询 users 表';
            RAISE NOTICE '   3. get_user_household_id() 函数没有被正确修复';
            RAISE NOTICE '';
        END IF;
    END;
END $$;

