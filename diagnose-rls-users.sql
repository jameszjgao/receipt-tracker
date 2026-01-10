-- ============================================
-- 诊断 users 表的 RLS 状态
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查 users 表的 RLS 是否启用
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 2. 检查 users 表的所有策略
SELECT 
    policyname, 
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause,
    roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;

-- 3. 检查当前用户（如果有）
SELECT auth.uid() as current_user_id;

-- 4. 尝试直接查询（如果可能）
-- 注意：这个查询可能会失败，取决于 RLS 策略
SELECT id, email, name, current_household_id 
FROM users 
WHERE id = auth.uid()
LIMIT 1;

