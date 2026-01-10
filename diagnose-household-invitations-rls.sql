-- ============================================
-- 诊断 household_invitations 表的 RLS 状态
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查 RLS 是否启用
SELECT
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'household_invitations';

-- 2. 检查所有策略
SELECT
    'Policies' as check_type,
    policyname,
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'household_invitations'
ORDER BY policyname;

-- 3. 检查是否有策略引用了 users 表（不应该有）
SELECT
    'Policy References' as check_type,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND (
    qual::text LIKE '%users%' 
    OR qual::text LIKE '%FROM users%'
    OR qual::text LIKE '%JOIN users%'
  );

-- 4. 检查当前用户（如果有）
SELECT 
    'Current User' as check_type,
    auth.uid() as current_user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email;

-- 5. 尝试直接查询（如果可能）
-- 注意：这个查询可能会失败，取决于 RLS 策略
SELECT 
    'Test Query' as check_type,
    COUNT(*) as invitation_count
FROM household_invitations
WHERE invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'pending'
  AND expires_at > NOW();

