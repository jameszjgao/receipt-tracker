-- ============================================
-- 检查当前的 INSERT 策略（实际执行的策略）
-- ============================================

-- 检查 INSERT 策略的完整内容
SELECT 
    '=== 当前 INSERT 策略（关键检查）===' as section,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' 
          OR with_check LIKE '%FROM users%' 
          OR with_check LIKE '%JOIN users%'
          OR with_check LIKE '%users.%' THEN '❌❌❌ 策略中包含 users 表查询（这是问题根源！）'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用 get_user_household_id 函数（需要确认函数不查询 users）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要仔细检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 检查是否有多个 INSERT 策略（可能导致冲突）
SELECT 
    '=== INSERT 策略数量 ===' as section,
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

-- 检查 get_user_household_id 函数的实际定义
SELECT 
    '=== get_user_household_id 函数定义 ===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' 
          OR routine_definition LIKE '%users.%' THEN '❌❌❌ 函数查询 users 表（这是问题！）'
        ELSE '✅ 函数不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

