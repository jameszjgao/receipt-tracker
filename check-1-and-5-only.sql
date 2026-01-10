-- ============================================
-- 只获取检查 1 和检查 5 的结果（最关键！）
-- ============================================

-- ============================================
-- 检查 1: get_user_household_id 函数的实际定义（最重要！）
-- 请提供完整的 routine_definition 字段内容
-- ============================================
SELECT 
    '=== 检查 1: get_user_household_id 函数（最关键！）===' as section,
    routine_name,
    routine_definition as function_definition_full,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%'
          OR routine_definition LIKE '%current_household_id%'
          OR routine_definition LIKE '%users WHERE%' THEN '❌ 仍然查询 users 表！这是问题根源！'
        WHEN routine_definition LIKE '%FROM user_households%' THEN '✅ 只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- ============================================
-- 检查 5: 直接插入测试（最关键！）
-- 这个会显示详细的错误信息，包括错误发生在哪一步
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
    RAISE NOTICE '=== 检查 5: 直接插入测试（最关键！显示详细错误）===';
    RAISE NOTICE '';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 当前用户ID: %', test_user_id;
    
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
    RAISE NOTICE '';
    RAISE NOTICE '准备插入测试数据...';
    RAISE NOTICE '';
    
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
        RAISE NOTICE '';
        RAISE NOTICE '✅✅✅ 插入成功！所有检查都通过！';
        RAISE NOTICE '';
        ROLLBACK;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            error_sqlstate = RETURNED_SQLSTATE,
            error_message = MESSAGE_TEXT,
            error_detail = PG_EXCEPTION_DETAIL,
            error_hint = PG_EXCEPTION_HINT,
            error_context = PG_EXCEPTION_CONTEXT;
            
        RAISE NOTICE '';
        RAISE NOTICE '❌ 插入失败！';
        RAISE NOTICE '';
        RAISE NOTICE '=== 错误详细信息 ===';
        RAISE NOTICE '错误代码 (SQLSTATE): %', error_sqlstate;
        RAISE NOTICE '错误信息: %', error_message;
        RAISE NOTICE '';
        RAISE NOTICE '错误详情: %', COALESCE(error_detail, '（无详情）');
        RAISE NOTICE '错误提示: %', COALESCE(error_hint, '（无提示）');
        RAISE NOTICE '错误上下文: %', COALESCE(error_context, '（无上下文）');
        RAISE NOTICE '';
        
        -- 如果是权限错误
        IF error_sqlstate = '42501' THEN
            RAISE NOTICE '⚠️  这是权限错误 (42501)';
            RAISE NOTICE '';
            RAISE NOTICE '可能的原因：';
            RAISE NOTICE '1. INSERT 策略中的函数在查询 users 表';
            RAISE NOTICE '2. 触发器在查询 users 表';
            RAISE NOTICE '3. get_user_household_id() 函数没有被正确修复';
            RAISE NOTICE '4. 有其他隐藏的约束或机制在查询 users 表';
            RAISE NOTICE '';
        END IF;
    END;
END $$;

