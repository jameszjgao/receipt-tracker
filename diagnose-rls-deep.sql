-- ============================================
-- 深入排查 RLS 问题 - 不使用绕过方法
-- 找出 INSERT 策略中查询 users 表的根本原因
-- ============================================

-- 第一步：检查当前 INSERT 策略的完整定义
SELECT 
    '=== 当前 INSERT 策略定义 ===' as section,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' OR with_check LIKE '%FROM users%' OR with_check LIKE '%JOIN users%' 
          OR with_check LIKE '%public.users%' THEN '❌ 策略中包含 users 表查询（这是问题！）'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用 get_user_household_id 函数（需要确认函数定义）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第二步：检查 get_user_household_id 函数的实际定义
SELECT 
    '=== get_user_household_id 函数定义 ===' as section,
    routine_name,
    routine_definition,
    security_type,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' 
          OR routine_definition LIKE '%public.users%' THEN '❌ 函数仍然查询 users 表'
        ELSE '✅ 函数不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 第三步：检查是否有触发器在查询 users 表
SELECT 
    '=== 触发器检查 ===' as section,
    trigger_name,
    event_manipulation,
    action_statement,
    CASE 
        WHEN action_statement LIKE '%users%' OR action_statement LIKE '%FROM users%' 
          OR action_statement LIKE '%JOIN users%' THEN '❌ 触发器可能查询 users 表'
        ELSE '✅ 触发器不查询 users 表'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 第四步：检查外键约束（虽然已删除，但确认一下）
SELECT 
    '=== 外键约束检查 ===' as section,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN ccu.table_name = 'users' THEN '❌ 外键约束指向 users 表（这是问题！）'
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

-- 第五步：测试 INSERT 策略的执行过程（模拟）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    policy_check TEXT;
    r RECORD;
BEGIN
    RAISE NOTICE '=== 模拟 INSERT 策略执行 ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    RAISE NOTICE '当前用户 ID: %', test_user_id;
    
    -- 获取当前的 INSERT 策略定义
    SELECT with_check INTO policy_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_invitations'
      AND cmd = 'INSERT'
    LIMIT 1;
    
    IF policy_check IS NULL THEN
        RAISE NOTICE '❌ 没有找到 INSERT 策略';
        RETURN;
    END IF;
    
    RAISE NOTICE 'INSERT 策略的 WITH CHECK 子句: %', policy_check;
    
    -- 获取用户的家庭 ID
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '⚠️  用户不是任何家庭的管理员，但继续测试策略本身';
    ELSE
        RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    END IF;
    
    -- 测试策略中的每个部分
    RAISE NOTICE '--- 测试 1: 检查 inviter_id = auth.uid() ---';
    BEGIN
        IF test_user_id = auth.uid() THEN
            RAISE NOTICE '✅ inviter_id = auth.uid() 检查通过';
        ELSE
            RAISE NOTICE '❌ inviter_id = auth.uid() 检查失败';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ 测试 1 出错: %', SQLERRM;
    END;
    
    RAISE NOTICE '--- 测试 2: 检查 EXISTS 子查询（这是关键！）---';
    BEGIN
        -- 模拟策略中的 EXISTS 子查询
        IF EXISTS (
            SELECT 1 
            FROM user_households 
            WHERE user_households.user_id = auth.uid()
              AND user_households.household_id = test_household_id
              AND user_households.is_admin = TRUE
        ) THEN
            RAISE NOTICE '✅ EXISTS 子查询检查通过（不查询 users 表）';
        ELSE
            RAISE NOTICE '⚠️  EXISTS 子查询返回 false（用户可能不是管理员）';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ 测试 2 出错: %', SQLERRM;
        RAISE NOTICE '❌❌❌ 这里出错说明 EXISTS 子查询在查询 users 表！';
    END;
    
    RAISE NOTICE '--- 测试 3: 检查 get_user_household_id() 函数（如果策略使用了它）---';
    BEGIN
        IF policy_check LIKE '%get_user_household_id%' THEN
            DECLARE
                func_result UUID;
            BEGIN
                func_result := get_user_household_id();
                RAISE NOTICE '✅ get_user_household_id() 返回: %', func_result;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE '❌ get_user_household_id() 出错: %', SQLERRM;
                RAISE NOTICE '❌❌❌ 函数内部可能在查询 users 表！';
            END;
        ELSE
            RAISE NOTICE '⚠️  策略不使用 get_user_household_id() 函数';
        END IF;
    END;
    
END $$;

-- 第六步：检查所有可能查询 users 表的函数（包括在策略中使用的）
SELECT 
    '=== 所有可能查询 users 的函数 ===' as section,
    routine_name,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' 
          OR routine_definition LIKE '%public.users%' THEN '❌ 查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status,
    SUBSTRING(routine_definition, 1, 200) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition LIKE '%users%'
    OR routine_name LIKE '%user%'
  )
ORDER BY routine_name;

