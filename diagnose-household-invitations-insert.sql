-- ============================================
-- 诊断 household_invitations INSERT 权限问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查当前用户
SELECT 
    'Current User' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email;

-- 2. 检查函数是否存在
SELECT 
    'Functions' as check_type,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_user_household_admin', 'user_belongs_to_household')
ORDER BY routine_name;

-- 3. 检查 user_households 表的 RLS 策略
SELECT 
    'user_households policies' as check_type,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
ORDER BY policyname;

-- 4. 检查 household_invitations 表的 INSERT 策略
SELECT 
    'household_invitations INSERT policy' as check_type,
    policyname,
    cmd,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 5. 测试函数是否可以正常执行（需要替换为实际的 household_id）
-- 注意：这个查询可能会失败，取决于 RLS 策略
SELECT 
    'Test is_user_household_admin function' as check_type,
    is_user_household_admin(
        (SELECT household_id FROM user_households WHERE user_id = auth.uid() LIMIT 1)
    ) as is_admin;

-- 6. 检查用户所属的家庭和管理员状态
SELECT 
    'User households' as check_type,
    household_id,
    is_admin,
    created_at
FROM user_households
WHERE user_id = auth.uid();

-- 7. 检查 users 表的 RLS 策略（可能导致权限错误）
SELECT 
    'users policies' as check_type,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

