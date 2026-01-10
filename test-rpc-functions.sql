-- ============================================
-- 测试 RPC 函数是否正常工作
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：需要在有用户登录的情况下测试
-- ============================================

-- 测试 1：检查函数是否存在
SELECT 
    'Test 1: Functions exist' as test_name,
    routine_name,
    security_type,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'update_user_name',
    'update_user_current_household',
    'get_household_member_users',
    'get_inviter_users'
  )
ORDER BY routine_name;

-- 测试 2：测试 get_inviter_users（如果当前用户有 pending 邀请）
SELECT 
    'Test 2: get_inviter_users' as test_name,
    *
FROM get_inviter_users();

-- 测试 3：测试 get_household_member_users（需要替换为实际的 household_id）
-- 注意：需要先获取当前用户的 household_id
-- SELECT 
--     'Test 3: get_household_member_users' as test_name,
--     *
-- FROM get_household_member_users('YOUR_HOUSEHOLD_ID_HERE');

-- 测试 4：检查当前用户是否有家庭
SELECT 
    'Test 4: Current user households' as test_name,
    uh.household_id,
    h.name as household_name
FROM user_households uh
JOIN households h ON uh.household_id = h.id
WHERE uh.user_id = auth.uid();

