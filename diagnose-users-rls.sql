-- ============================================
-- 诊断 users 表的 RLS 策略状态
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查 users 表的 RLS 是否启用
SELECT 
    'RLS Status' as check_type,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 2. 检查所有现有的 users 表策略
SELECT 
    'Existing Policies' as check_type,
    policyname, 
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause,
    roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;

-- 3. 检查策略数量
SELECT 
    'Policy Count' as check_type,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';

-- 4. 检查是否有冲突的策略名称
SELECT 
    'Duplicate Policies' as check_type,
    policyname,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users'
GROUP BY policyname
HAVING COUNT(*) > 1;

