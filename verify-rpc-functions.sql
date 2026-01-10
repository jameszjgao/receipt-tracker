-- ============================================
-- 验证 RPC 函数是否正确创建
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：检查所有 RPC 函数是否存在
SELECT 
    '✅ Function Status' as check_type,
    routine_name,
    security_type,
    routine_type,
    routine_definition IS NOT NULL as has_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_user_by_id',
    'update_user_name',
    'update_user_current_household',
    'get_household_member_users',
    'get_inviter_users'
  )
ORDER BY routine_name;

-- 第二步：检查函数权限
SELECT 
    '✅ Function Permissions' as check_type,
    routine_name,
    routine_schema,
    routine_name as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.routine_privileges 
            WHERE routine_schema = 'public' 
              AND routine_name = r.routine_name
              AND grantee = 'authenticated'
        ) THEN '✅ Has permission'
        ELSE '❌ Missing permission'
    END as permission_status
FROM information_schema.routines r
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_user_by_id',
    'update_user_name',
    'update_user_current_household',
    'get_household_member_users',
    'get_inviter_users'
  )
ORDER BY routine_name;

-- 第三步：测试函数（需要用户登录）
-- 注意：这些测试需要在有用户登录的情况下运行
-- SELECT 'Test: get_inviter_users' as test_name, * FROM get_inviter_users();

