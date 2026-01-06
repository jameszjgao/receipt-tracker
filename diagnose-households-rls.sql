-- ============================================
-- 诊断 households 表的 RLS 策略问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查当前所有 households 表的策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- 2. 检查 RLS 是否启用
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 3. 检查当前用户是否有 authenticated 角色
SELECT 
    current_user,
    session_user,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role;

-- 4. 测试策略：尝试查看策略是否允许插入
-- 注意：这个查询不会实际插入数据，只是检查策略
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'INSERT' AND with_check = 'true' THEN 'Should allow insert'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN 'WITH CHECK is NULL - PROBLEM!'
        ELSE 'Check policy definition'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT';

