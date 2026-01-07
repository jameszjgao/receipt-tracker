-- ============================================
-- 诊断 RLS 策略问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查 users 表的 SELECT 策略
SELECT 
    'Users Table Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. 检查 households 表的 SELECT 策略
SELECT 
    'Households Table Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 3. 检查当前用户（使用当前认证用户）
SELECT 
    'Current Auth User' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- 4. 测试用户是否可以看到自己的记录
SELECT 
    'Test: Can user see own record?' as test,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ YES - User can see own record'
        ELSE '✗ NO - User CANNOT see own record'
    END as result
FROM users
WHERE id = auth.uid();

-- 5. 测试用户是否可以看到被邀请的家庭
SELECT 
    'Test: Can user see invited households?' as test,
    COUNT(DISTINCT h.id) as household_count,
    CASE 
        WHEN COUNT(DISTINCT h.id) > 0 THEN '✓ YES - User can see invited households'
        ELSE '✗ NO - User CANNOT see invited households'
    END as result
FROM households h
WHERE h.id IN (
    SELECT hi.household_id 
    FROM household_invitations hi
    WHERE hi.status = 'pending'
      AND hi.expires_at > NOW()
      AND hi.invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
);

-- 6. 检查用户的邀请数量（通过邀请表直接查询，不受 RLS 限制）
SELECT 
    'Pending Invitations for Current User' as check_type,
    COUNT(*) as invitation_count,
    STRING_AGG(hi.invitee_email || ' -> ' || hi.household_id::text, ', ') as invitations
FROM household_invitations hi
WHERE hi.status = 'pending'
  AND hi.expires_at > NOW()
  AND hi.invitee_email = COALESCE(
    (SELECT email FROM users WHERE id = auth.uid()),
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 7. 检查 users 表的 RLS 是否启用
SELECT 
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✓ Enabled'
        ELSE '✗ Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'households')
ORDER BY tablename;

