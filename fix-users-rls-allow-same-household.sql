-- ============================================
-- 修复 users 表的 RLS 策略，允许查询同家庭的用户信息
-- 解决所有查询用户信息时的权限问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：确保 get_user_household_id() 函数存在且正确
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    -- 优先使用 current_household_id
    (SELECT current_household_id FROM users WHERE id = auth.uid()),
    -- 如果为 NULL，从 user_households 表获取第一个家庭
    (SELECT household_id FROM user_households WHERE user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 第二步：删除所有现有的 users 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- 第三步：重新创建 users 表的 RLS 策略

-- SELECT: 允许用户查看同家庭的用户或自己
-- 使用 user_households 表来检查是否在同一家庭
CREATE POLICY "users_select_same_household" ON users
  FOR SELECT 
  TO authenticated
  USING (
    -- 允许查看自己（最重要，必须放在第一位）
    id = auth.uid()
    OR
    -- 允许查看同家庭的用户（通过 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households uh1
      INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id = users.id
    )
  );

-- INSERT: 允许用户创建自己的记录（注册时需要）
CREATE POLICY "users_insert_own_record" ON users
  FOR INSERT 
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: 用户只能更新自己的记录
CREATE POLICY "users_update_own_record" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第四步：验证策略已创建
SELECT 
    '✅ Users RLS policies created' as status,
    tablename,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN with_check IS NOT NULL THEN '有 WITH CHECK' 
        ELSE '无 WITH CHECK' 
    END as has_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 第五步：验证 RLS 已启用
SELECT 
    '✅ RLS Status' as status,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

