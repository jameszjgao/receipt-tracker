-- ============================================
-- 获取关键检查结果
-- 请执行这个脚本并提供所有结果
-- ============================================

-- ============================================
-- 检查 1: INSERT 策略详情（最重要！）
-- ============================================
SELECT 
    '=== 检查 1: INSERT 策略详情（最重要！）===' as section,
    policyname,
    cmd,
    with_check as with_check_clause,
    qual as using_clause,
    CASE 
        WHEN with_check LIKE '%users%' OR qual LIKE '%users%' THEN '❌ 包含 users 表'
        WHEN with_check LIKE '%get_user_household_id%' OR qual LIKE '%get_user_household_id%' THEN '⚠️  使用 get_user_household_id 函数（可能查询 users）'
        WHEN with_check LIKE '%user_households%' OR qual LIKE '%user_households%' THEN '✅ 只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- ============================================
-- 检查 4: INSERT 策略数量
-- ============================================
SELECT 
    '=== 检查 4: INSERT 策略数量 ===' as section,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ 没有 INSERT 策略'
        WHEN COUNT(*) = 1 THEN '✅ 只有一个 INSERT 策略'
        ELSE '⚠️  有多个 INSERT 策略（可能冲突）'
    END as status,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- ============================================
-- 检查 3: get_user_household_id 函数定义
-- ============================================
SELECT 
    '=== 检查 3: get_user_household_id 函数 ===' as section,
    routine_name,
    security_type,
    routine_type,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%' THEN '❌ 查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- ============================================
-- 检查 2: 所有触发器
-- ============================================
SELECT 
    '=== 检查 2: 所有触发器 ===' as section,
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation,
    action_statement,
    CASE 
        WHEN action_statement LIKE '%users%' OR action_statement LIKE '%public.users%' THEN '❌ 可能查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- ============================================
-- 检查 6: 测试直接插入（查看详细错误）
-- 这个最重要！会显示具体的错误信息
-- ============================================
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    admin_check BOOLEAN;
    error_detail TEXT;
    error_hint TEXT;
    error_context TEXT;
BEGIN
    RAISE NOTICE '=== 检查 6: 测试直接插入（最重要！）===';
    
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
        RAISE NOTICE '✅ 插入成功！外键约束和 RLS 策略都通过';
        ROLLBACK; -- 回滚测试数据
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS 
            error_detail = PG_EXCEPTION_DETAIL,
            error_hint = PG_EXCEPTION_HINT,
            error_context = PG_EXCEPTION_CONTEXT;
            
        RAISE NOTICE '❌ 插入失败！';
        RAISE NOTICE '错误代码 (SQLSTATE): %', SQLSTATE;
        RAISE NOTICE '错误信息 (SQLERRM): %', SQLERRM;
        RAISE NOTICE '错误详情: %', COALESCE(error_detail, '无');
        RAISE NOTICE '错误提示: %', COALESCE(error_hint, '无');
        RAISE NOTICE '错误上下文: %', COALESCE(error_context, '无');
        
        -- 检查是否是权限错误
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE '⚠️  这是权限错误 (42501)';
            RAISE NOTICE '   可能是 RLS 策略或触发器导致的';
        END IF;
    END;
END $$;

