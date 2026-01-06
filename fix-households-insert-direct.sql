-- ============================================
-- 直接修复 households INSERT 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 households INSERT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'households'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON households', r.policyname);
        RAISE NOTICE 'Dropped INSERT policy: %', r.policyname;
    END LOOP;
END $$;

-- 第二步：确保 RLS 已启用
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- 第三步：创建最简单的 INSERT 策略（使用 authenticated 角色）
-- 如果这个不工作，请取消注释下面的 public 版本
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 如果上面的策略仍然失败，取消注释下面的代码并注释掉上面的
-- DROP POLICY IF EXISTS "households_insert_policy" ON households;
-- CREATE POLICY "households_insert_policy" ON households
--   FOR INSERT 
--   TO public
--   WITH CHECK (true);

-- 第四步：立即验证策略
SELECT 
    'Policy Status' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND with_check = 'true' AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles)) THEN '✓ Correct'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ WITH CHECK is not true'
        WHEN cmd = 'INSERT' AND 'authenticated' != ALL(roles) AND 'public' != ALL(roles) THEN '✗ Wrong role'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT';

-- 第五步：验证 RLS 状态
SELECT 
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✓ Enabled'
        ELSE '✗ Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 第六步：显示所有 households 策略（用于调试）
SELECT 
    'All Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

