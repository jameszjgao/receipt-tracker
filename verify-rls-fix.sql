-- ============================================
-- 验证 RLS 策略修复是否成功
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 1. 检查 users 表的所有策略
-- ============================================
SELECT 
    'Users Table Policies' as check_section,
    policyname,
    cmd as operation,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND policyname = 'users_select_own' THEN '✓ 关键策略存在'
        WHEN cmd = 'SELECT' THEN '✓ SELECT 策略存在'
        WHEN cmd = 'INSERT' THEN '✓ INSERT 策略存在'
        WHEN cmd = 'UPDATE' THEN '✓ UPDATE 策略存在'
        ELSE '其他策略'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================
-- 2. 检查 households 表的所有策略
-- ============================================
SELECT 
    'Households Table Policies' as check_section,
    policyname,
    cmd as operation,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND policyname = 'households_select_invited' THEN '✓ 关键策略存在（邀请功能）'
        WHEN cmd = 'SELECT' AND policyname = 'households_select_own' THEN '✓ 查看自己家庭策略存在'
        WHEN cmd = 'SELECT' THEN '✓ SELECT 策略存在'
        WHEN cmd = 'INSERT' THEN '✓ INSERT 策略存在'
        WHEN cmd = 'UPDATE' THEN '✓ UPDATE 策略存在'
        ELSE '其他策略'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- ============================================
-- 3. 检查 RLS 是否已启用
-- ============================================
SELECT 
    'RLS Status' as check_section,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✓ RLS 已启用'
        ELSE '✗ RLS 未启用 - 需要修复！'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'households')
ORDER BY tablename;

-- ============================================
-- 4. 检查关键策略的详细定义
-- ============================================
SELECT 
    'Policy Details' as check_section,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'households')
  AND (
    (tablename = 'users' AND policyname = 'users_select_own')
    OR
    (tablename = 'households' AND policyname = 'households_select_invited')
  )
ORDER BY tablename, policyname;

-- ============================================
-- 5. 验证关键策略是否存在（汇总）
-- ============================================
SELECT 
    'Summary' as check_section,
    'users_select_own' as required_policy,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'users' 
              AND policyname = 'users_select_own'
        ) THEN '✓ 存在'
        ELSE '✗ 缺失 - 需要修复！'
    END as status
UNION ALL
SELECT 
    'Summary',
    'households_select_invited',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'households' 
              AND policyname = 'households_select_invited'
        ) THEN '✓ 存在'
        ELSE '✗ 缺失 - 需要修复！'
    END
UNION ALL
SELECT 
    'Summary',
    'households_select_own',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'households' 
              AND policyname = 'households_select_own'
        ) THEN '✓ 存在'
        ELSE '✗ 缺失 - 需要修复！'
    END
UNION ALL
SELECT 
    'Summary',
    'users RLS enabled',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
              AND tablename = 'users' 
              AND rowsecurity = true
        ) THEN '✓ 已启用'
        ELSE '✗ 未启用 - 需要修复！'
    END
UNION ALL
SELECT 
    'Summary',
    'households RLS enabled',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
              AND tablename = 'households' 
              AND rowsecurity = true
        ) THEN '✓ 已启用'
        ELSE '✗ 未启用 - 需要修复！'
    END;

