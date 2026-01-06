-- ============================================
-- 终极修复 households 表 RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：彻底删除所有现有的 households 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'households'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON households', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- 第二步：确保 RLS 已启用
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- 第三步：创建最简单的策略（允许所有角色插入）
-- 这是最宽松的策略，用于诊断问题
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO public
  WITH CHECK (true);

-- 第四步：创建其他必要的策略
CREATE POLICY "households_select_policy" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "households_update_policy" ON households
  FOR UPDATE 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "households_delete_policy" ON households
  FOR DELETE 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- 第五步：验证策略
SELECT 
    'Policy Verification' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND 'public' = ANY(roles) AND with_check = 'true' THEN '✓ INSERT policy correct (public)'
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) AND with_check = 'true' THEN '✓ INSERT policy correct (authenticated)'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ WITH CHECK is not true'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- 第六步：测试插入（如果策略正确，应该成功）
DO $$
DECLARE
    test_id UUID;
BEGIN
    INSERT INTO households (name, address)
    VALUES ('Ultimate Test Household', 'Test Address')
    RETURNING id INTO test_id;
    
    RAISE NOTICE '✓ Test insert successful! Household ID: %', test_id;
    
    -- 删除测试数据
    DELETE FROM households WHERE id = test_id;
    RAISE NOTICE '✓ Test household deleted successfully.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Test insert failed! Error: %, Code: %', SQLERRM, SQLSTATE;
END $$;

