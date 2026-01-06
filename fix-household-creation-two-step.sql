-- ============================================
-- 修复两步注册后创建household的问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：确保 create_household_with_user RPC 函数存在且正确
-- 这个函数用于创建household并关联用户（绕过RLS）

CREATE OR REPLACE FUNCTION create_household_with_user(
  p_household_name TEXT,
  p_household_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- 从 auth.users 获取用户信息（如果 users 表记录不存在）
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  -- 如果 users 表记录不存在，尝试创建（使用 auth.users 的信息）
  INSERT INTO users (id, email, name, current_household_id)
  SELECT 
    p_user_id,
    COALESCE(v_user_email, ''),
    COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = p_user_id), split_part(COALESCE(v_user_email, ''), '@', 1), 'User'),
    NULL
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- 创建家庭
  INSERT INTO households (name, address)
  VALUES (p_household_name, p_household_address)
  RETURNING id INTO v_household_id;

  -- 更新用户的 current_household_id
  UPDATE users
  SET current_household_id = v_household_id
  WHERE id = p_user_id;

  -- 创建 user_households 关联记录
  INSERT INTO user_households (user_id, household_id, is_admin)
  VALUES (p_user_id, v_household_id, TRUE)
  ON CONFLICT (user_id, household_id) DO NOTHING;

  -- 返回家庭 ID
  RETURN v_household_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_with_user(TEXT, TEXT, UUID) TO authenticated;

-- 第二步：确保 households 表的 INSERT 策略正确
-- 删除所有现有的 households INSERT 策略
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

-- 创建新的 INSERT 策略：允许任何已认证用户创建家庭
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 第三步：确保 user_households 表的 INSERT 策略正确
-- 删除所有现有的 user_households INSERT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_households'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_households', r.policyname);
        RAISE NOTICE 'Dropped INSERT policy: %', r.policyname;
    END LOOP;
END $$;

-- 创建新的 INSERT 策略：用户可以插入自己的家庭关联
CREATE POLICY "user_households_insert_policy" ON user_households
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 第四步：确保 users 表的 UPDATE 策略允许更新 current_household_id
-- 检查并更新 users 表的 UPDATE 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'UPDATE'
    ) LOOP
        -- 如果策略存在，检查是否需要更新
        -- 这里我们假设策略已经允许用户更新自己的记录（id = auth.uid()）
        -- 如果策略不允许，需要重新创建
        RAISE NOTICE 'Found UPDATE policy: %', r.policyname;
    END LOOP;
END $$;

-- 确保 users 表的 UPDATE 策略允许用户更新自己的 current_household_id
-- 如果策略不存在，创建它
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'UPDATE'
          AND policyname = 'users_update_policy'
    ) THEN
        CREATE POLICY "users_update_policy" ON users
          FOR UPDATE
          USING (id = auth.uid())
          WITH CHECK (id = auth.uid());
        RAISE NOTICE 'Created users_update_policy';
    ELSE
        RAISE NOTICE 'users_update_policy already exists';
    END IF;
END $$;

-- 第五步：验证所有策略和函数
-- 验证 RPC 函数
SELECT 
    'RPC Function Check' as check_type,
    routine_name,
    routine_type,
    security_type,
    CASE 
        WHEN routine_name = 'create_household_with_user' THEN '✓ Function exists'
        ELSE '✗ Function missing'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_with_user';

-- 验证 households INSERT 策略
SELECT 
    'Households INSERT Policy' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) AND with_check = 'true' THEN '✓ Correct'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ WITH CHECK is not true'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT';

-- 验证 user_households INSERT 策略
SELECT 
    'User Households INSERT Policy' as check_type,
    policyname,
    cmd,
    roles,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) THEN '✓ Correct'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ Missing WITH CHECK'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
  AND cmd = 'INSERT';

-- 验证 users UPDATE 策略
SELECT 
    'Users UPDATE Policy' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check,
    CASE 
        WHEN cmd = 'UPDATE' AND qual LIKE '%auth.uid()%' AND with_check LIKE '%auth.uid()%' THEN '✓ Correct'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'UPDATE';

-- 第六步：显示所有相关策略（用于调试）
SELECT 
    'All Policies Summary' as check_type,
    tablename,
    policyname,
    cmd,
    roles,
    CASE WHEN with_check IS NOT NULL THEN 'Yes' ELSE 'No' END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('households', 'user_households', 'users')
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY tablename, cmd, policyname;

