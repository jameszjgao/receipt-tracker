-- ============================================
-- 完整诊断：找出所有仍然查询 users 表的地方
-- ============================================

-- 检查 1: 确认 get_user_household_id 函数是否已修复
SELECT 
    '=== 检查 1: get_user_household_id 函数 ===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%'
          OR routine_definition LIKE '%current_household_id%' THEN '❌ 仍然查询 users 表！'
        WHEN routine_definition LIKE '%FROM user_households%' THEN '✅ 只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 检查 2: 检查所有可能被调用的函数
SELECT 
    '=== 检查 2: 所有可能查询 users 的函数 ===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' THEN '❌ 查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_definition LIKE '%household_invitations%' OR routine_definition LIKE '%inviter%')
  AND (routine_definition LIKE '%users%' OR routine_definition LIKE '%FROM%');

-- 检查 3: 检查所有触发器函数
SELECT 
    '=== 检查 3: 所有触发器 ===' as section,
    trigger_name,
    action_statement,
    pg_get_functiondef(action_statement::regproc::oid) as function_definition
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 检查 4: 检查 INSERT 策略的完整内容
SELECT 
    '=== 检查 4: INSERT 策略完整内容 ===' as section,
    policyname,
    cmd,
    qual as using_clause,
    with_check,
    pg_get_expr(pg_policies.qual, pg_policies.schemaname::regnamespace) as using_expr_expanded,
    pg_get_expr(pg_policies.with_check, pg_policies.schemaname::regnamespace) as with_check_expr_expanded
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 检查 5: 直接测试插入（查看详细错误堆栈）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    error_detail TEXT;
    error_hint TEXT;
    error_context TEXT;
    error_position TEXT;
BEGIN
    RAISE NOTICE '=== 检查 5: 直接测试插入 ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    -- 获取家庭ID并检查是否是管理员
    SELECT household_id INTO test_household_id
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
        RAISE NOTICE '✅✅✅ 插入成功！';
        ROLLBACK;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            error_detail = PG_EXCEPTION_DETAIL,
            error_hint = PG_EXCEPTION_HINT,
            error_context = PG_EXCEPTION_CONTEXT;
            
        RAISE NOTICE '❌ 插入失败！';
        RAISE NOTICE '错误代码: %', SQLSTATE;
        RAISE NOTICE '错误信息: %', SQLERRM;
        RAISE NOTICE '错误详情: %', COALESCE(error_detail, '无');
        RAISE NOTICE '错误提示: %', COALESCE(error_hint, '无');
        RAISE NOTICE '错误上下文: %', COALESCE(error_context, '无');
        
        -- 如果是权限错误，尝试找出具体位置
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE '⚠️  这是权限错误 (42501)';
            RAISE NOTICE '   可能是 RLS 策略、触发器或函数导致的';
        END IF;
    END;
END $$;

