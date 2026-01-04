-- ============================================
-- 诊断 RLS 问题
-- 在 Supabase SQL Editor 中执行此脚本以检查当前状态
-- ============================================

-- 1. 检查 get_user_household_id() 函数是否存在
SELECT 
    routine_name, 
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_household_id';

-- 2. 检查 receipts 表的 RLS 是否启用
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'receipts';

-- 3. 检查 receipts 表的所有策略
SELECT 
    policyname, 
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause,
    roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'receipts'
ORDER BY policyname;

-- 4. 检查 receipt_items 表的所有策略
SELECT 
    policyname, 
    cmd as operation,
    qual as using_clause,
    with_check as with_check_clause,
    roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'receipt_items'
ORDER BY policyname;

-- 5. 检查当前登录用户（如果有）
-- 注意：这个查询需要在有用户登录的情况下运行
SELECT auth.uid() as current_user_id;

