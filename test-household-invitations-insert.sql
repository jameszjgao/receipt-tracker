-- ============================================
-- 测试 household_invitations INSERT 权限
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查当前用户和家庭
SELECT 
    'Current User Info' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email;

-- 2. 检查用户所属的家庭和管理员状态
SELECT 
    'User Households' as check_type,
    household_id,
    is_admin,
    created_at
FROM user_households
WHERE user_id = auth.uid();

-- 3. 测试 is_user_household_admin 函数
-- 替换为实际的 household_id
SELECT 
    'Test is_user_household_admin' as check_type,
    household_id,
    is_user_household_admin(household_id) as is_admin
FROM user_households
WHERE user_id = auth.uid();

-- 4. 检查 household_invitations 表的 INSERT 策略
SELECT 
    'INSERT Policy' as check_type,
    policyname,
    cmd,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 5. 尝试手动测试 INSERT（使用实际的 household_id 和 email）
-- 注意：这个查询会失败，但会显示具体的错误信息
-- 请替换 <HOUSEHOLD_ID> 和 <INVITEE_EMAIL> 为实际值
/*
INSERT INTO household_invitations (
    household_id,
    inviter_id,
    inviter_email,
    invitee_email,
    token,
    status,
    expires_at
) VALUES (
    '<HOUSEHOLD_ID>'::uuid,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    '<INVITEE_EMAIL>',
    'test-token-' || gen_random_uuid()::text,
    'pending',
    NOW() + INTERVAL '7 days'
);
*/

-- 6. 检查函数的所有者和权限
SELECT 
    'Function Info' as check_type,
    routine_name,
    routine_type,
    security_type,
    routine_owner
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_user_household_admin', 'user_belongs_to_household')
ORDER BY routine_name;

-- 7. 检查 user_households 表的 RLS 策略
SELECT 
    'user_households policies' as check_type,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
ORDER BY policyname;

