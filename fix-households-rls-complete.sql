-- ============================================
-- 完整修复 households 表的 RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 households 策略（避免冲突）
-- 使用更彻底的方式删除所有策略
DROP POLICY IF EXISTS "households_select_policy" ON households;
DROP POLICY IF EXISTS "households_insert_policy" ON households;
DROP POLICY IF EXISTS "households_update_policy" ON households;
DROP POLICY IF EXISTS "households_delete_policy" ON households;
DROP POLICY IF EXISTS "households_insert" ON households;
DROP POLICY IF EXISTS "households_select" ON households;
DROP POLICY IF EXISTS "households_update" ON households;
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Users can insert their household" ON households;
DROP POLICY IF EXISTS "Users can create their household" ON households;
DROP POLICY IF EXISTS "Users can update their household" ON households;
DROP POLICY IF EXISTS "Users can manage households" ON households;

-- 额外清理：删除可能存在的其他策略
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
    END LOOP;
END $$;

-- 第二步：确保 RLS 已启用
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- 第三步：重新创建所有策略

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
-- 重要：新用户还没有家庭，所以必须允许所有已认证用户创建
-- 使用 WITH CHECK (true) 表示允许所有插入
-- 注意：不需要 USING 子句，因为 INSERT 操作只检查 WITH CHECK
-- 如果策略设置为 public，则使用 TO public；否则使用 TO authenticated
-- 这里使用 TO authenticated，因为只有已认证用户才能创建家庭
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 如果上面的策略仍然失败，可以尝试使用 public 角色（不推荐，安全性较低）
-- CREATE POLICY "households_insert_policy" ON households
--   FOR INSERT 
--   TO public
--   WITH CHECK (true);

-- 立即验证策略是否创建成功
DO $$
DECLARE
  policy_exists BOOLEAN;
  policy_with_check TEXT;
  policy_roles TEXT[];
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'households' 
      AND policyname = 'households_insert_policy'
      AND cmd = 'INSERT'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Failed to create households_insert_policy!';
  END IF;
  
  -- 检查 with_check 值
  SELECT with_check, roles INTO policy_with_check, policy_roles
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename = 'households' 
    AND policyname = 'households_insert_policy'
    AND cmd = 'INSERT';
  
  IF policy_with_check IS NULL OR policy_with_check != 'true' THEN
    RAISE EXCEPTION 'households_insert_policy WITH CHECK is not true! Current value: %', policy_with_check;
  END IF;
  
  -- 检查 roles
  IF policy_roles IS NULL OR array_length(policy_roles, 1) IS NULL THEN
    RAISE WARNING 'households_insert_policy roles is NULL or empty!';
  END IF;
  
  RAISE NOTICE 'households_insert_policy created successfully:';
  RAISE NOTICE '  - WITH CHECK = %', policy_with_check;
  RAISE NOTICE '  - ROLES = %', policy_roles;
END $$;

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

-- 4. DELETE 策略：用户只能删除自己所属的家庭（管理员）
-- 注意：通常不建议删除家庭，但为了完整性添加此策略
CREATE POLICY "households_delete_policy" ON households
  FOR DELETE 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- 第四步：验证策略是否创建成功
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

-- 预期结果：
-- 1. households_insert_policy 应该存在，with_check = 'true'
-- 2. RLS 应该已启用（rowsecurity = true）

