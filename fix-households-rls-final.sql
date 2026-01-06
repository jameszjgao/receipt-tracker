-- ============================================
-- 最终修复 households 表的 RLS 策略
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

-- 第三步：重新创建所有策略（使用最简单的定义）

-- 1. SELECT 策略：用户只能查看自己所属的家庭
CREATE POLICY "households_select_policy" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 2. INSERT 策略：允许任何已认证用户创建家庭（关键！）
-- 尝试两种方式：先使用 authenticated，如果失败可以改为 public
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 如果 authenticated 不工作，取消注释下面的代码并注释掉上面的
-- DROP POLICY IF EXISTS "households_insert_policy" ON households;
-- CREATE POLICY "households_insert_policy" ON households
--   FOR INSERT 
--   TO public
--   WITH CHECK (true);

-- 3. UPDATE 策略：用户只能更新自己所属的家庭
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

-- 4. DELETE 策略：管理员可以删除家庭
CREATE POLICY "households_delete_policy" ON households
  FOR DELETE 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- 第四步：详细验证策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles,
    qual,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND with_check = 'true' THEN '✓ Correct'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ WITH CHECK is not true'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- 第五步：验证 RLS 是否启用
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 第六步：检查当前用户的认证状态（需要在应用中以用户身份执行）
-- SELECT 
--     current_user,
--     session_user,
--     auth.uid() as current_auth_uid,
--     auth.role() as current_auth_role;

