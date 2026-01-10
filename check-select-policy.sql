-- ============================================
-- 检查 household_invitations 的 SELECT 策略
-- 这是关键！INSERT 后返回数据时会触发 SELECT 策略
-- ============================================

-- 检查 SELECT 策略（关键！）
SELECT 
    '=== SELECT 策略检查（关键！）===' as section,
    policyname,
    cmd,
    qual as using_clause,
    CASE 
        WHEN qual LIKE '%users%' OR qual LIKE '%public.users%' THEN '❌ 策略中包含 users 表查询（这是问题！）'
        WHEN qual LIKE '%get_user_household_id%' THEN '⚠️  策略使用 get_user_household_id 函数（需要确认函数已修复）'
        WHEN qual LIKE '%auth.users%' THEN '✅ 策略使用 auth.users（正确，不查询 public.users）'
        WHEN qual LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查'
    END as status,
    qual as 策略完整内容
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'SELECT';

-- 检查是否有多个 SELECT 策略
SELECT 
    '=== SELECT 策略数量 ===' as section,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ 没有 SELECT 策略'
        WHEN COUNT(*) = 1 THEN '✅ 只有一个 SELECT 策略'
        ELSE '⚠️  有多个 SELECT 策略（可能冲突）'
    END as status,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'SELECT';
