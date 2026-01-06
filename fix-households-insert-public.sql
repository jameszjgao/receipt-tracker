-- ============================================
-- 使用 public 角色修复 households INSERT 策略
-- 如果 authenticated 角色不工作，执行此脚本
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

-- 第三步：使用 public 角色创建 INSERT 策略
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO public
  WITH CHECK (true);

-- 第四步：验证策略
SELECT 
    'Policy Status' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND with_check = 'true' AND 'public' = ANY(roles) THEN '✓ Correct (public)'
        WHEN cmd = 'INSERT' AND with_check = 'true' AND 'authenticated' = ANY(roles) THEN '✓ Correct (authenticated)'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ WITH CHECK is not true'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT';

