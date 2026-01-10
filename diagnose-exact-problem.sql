-- ============================================
-- 精确定位问题：找出 INSERT 策略查询 users 表的地方
-- ============================================

-- 第一步：检查当前 INSERT 策略的完整定义（最重要！）
SELECT 
    '=== 当前 INSERT 策略定义（关键！）===' as section,
    policyname,
    cmd,
    roles,
    with_check as full_with_check_clause,
    -- 检查是否包含 users 表查询
    CASE 
        WHEN with_check LIKE '%users%' OR with_check LIKE '%FROM users%' OR with_check LIKE '%JOIN users%' 
          OR with_check LIKE '%public.users%' THEN '❌❌❌ 策略中包含 users 表查询（这是问题！）'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用 get_user_household_id 函数（需要检查函数定义）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 第二步：检查是否有多个 INSERT 策略（可能冲突）
SELECT 
    '=== INSERT 策略数量 ===' as section,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ 没有 INSERT 策略'
        WHEN COUNT(*) = 1 THEN '✅ 只有一个 INSERT 策略'
        ELSE '⚠️  有多个 INSERT 策略（可能冲突）'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第三步：检查外键约束（可能触发 RLS 检查）
SELECT 
    '=== 外键约束检查 ===' as section,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN ccu.table_name = 'users' THEN '❌ 外键约束指向 users 表（这会触发 RLS 检查）'
        ELSE '✅ 外键约束不指向 users 表'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'household_invitations';

-- 第四步：检查触发器（可能查询 users 表）
SELECT 
    '=== 触发器检查 ===' as section,
    trigger_name,
    event_manipulation,
    action_timing,
    SUBSTRING(action_statement, 1, 200) as action_preview,
    CASE 
        WHEN action_statement LIKE '%users%' OR action_statement LIKE '%FROM users%' 
          OR action_statement LIKE '%JOIN users%' THEN '❌ 触发器可能查询 users 表'
        ELSE '✅ 触发器不查询 users 表'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 第五步：检查 get_user_household_id 函数的实际定义
SELECT 
    '=== get_user_household_id 函数定义 ===' as section,
    routine_name,
    security_type,
    routine_definition as full_function_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' 
          OR routine_definition LIKE '%public.users%' THEN 
            CASE 
                WHEN security_type = 'DEFINER' THEN '⚠️  函数查询 users 表，但使用 SECURITY DEFINER（应该可以）'
                ELSE '❌ 函数查询 users 表，但不使用 SECURITY DEFINER（会失败）'
            END
        WHEN routine_definition LIKE '%user_households%' THEN '✅ 函数只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 第六步：测试直接插入（查看详细错误信息）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_email TEXT;
    test_token TEXT;
    test_invitation_id UUID;
BEGIN
    RAISE NOTICE '=== 测试直接插入（查看详细错误） ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    -- 获取用户的 email
    SELECT email INTO test_email
    FROM auth.users
    WHERE id = test_user_id;
    
    -- 获取家庭 ID（从 user_households，不查询 users）
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '⚠️  用户不是管理员，但继续测试';
        -- 使用任意家庭 ID 进行测试
        SELECT id INTO test_household_id FROM households LIMIT 1;
        IF test_household_id IS NULL THEN
            RAISE NOTICE '❌ 没有家庭可用';
            RETURN;
        END IF;
    END IF;
    
    test_token := 'test-token-' || gen_random_uuid()::text;
    
    RAISE NOTICE '尝试插入，用户 ID: %, 家庭 ID: %', test_user_id, test_household_id;
    
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
            test_email,
            'test@example.com',
            test_token,
            NOW() + INTERVAL '7 days'
        )
        RETURNING id INTO test_invitation_id;
        
        RAISE NOTICE '✅✅✅ 插入成功！ID: %', test_invitation_id;
        DELETE FROM household_invitations WHERE id = test_invitation_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌❌❌ 插入失败！';
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RAISE NOTICE 'SQLERRM: %', SQLERRM;
        RAISE NOTICE '错误上下文: %', SQLERRM;
        
        -- 如果是权限错误，输出详细信息
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE '❌❌❌ 这是权限错误（42501）';
            RAISE NOTICE '说明 INSERT 策略在检查时查询了 users 表，但被拒绝了';
            RAISE NOTICE '请检查 INSERT 策略的 WITH CHECK 子句';
        END IF;
    END;
END $$;

