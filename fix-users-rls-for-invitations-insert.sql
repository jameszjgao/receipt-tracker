-- ============================================
-- 修复 users 表的 RLS 策略，解决 household_invitations INSERT 权限问题
-- 问题：复杂的 users SELECT 策略在 INSERT 操作时触发权限错误
-- 解决方案：简化 users 表的策略，避免在 RLS 检查时触发循环依赖
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 users SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
        RAISE NOTICE 'Dropped users SELECT policy: %', r.policyname;
    END LOOP;
END $$;

-- 第二步：创建简化的 users SELECT 策略
-- 策略1：用户可以查看自己的记录（最重要，必须放在第一位）
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- 策略2：用户可以查看同一家庭的成员
-- 注意：使用 SECURITY DEFINER 函数来避免 RLS 循环依赖
-- 如果函数不存在，使用简单的子查询
CREATE POLICY "users_select_household_members" ON users
  FOR SELECT 
  TO authenticated
  USING (
    -- 使用 EXISTS 子查询，避免复杂的 JOIN
    EXISTS (
      SELECT 1 
      FROM user_households uh1
      WHERE uh1.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 
          FROM user_households uh2
          WHERE uh2.household_id = uh1.household_id
            AND uh2.user_id = users.id
            AND uh2.user_id != auth.uid()
        )
    )
  );

-- 策略3：用户可以查看邀请者（用于显示邀请信息）
-- 注意：简化策略，避免复杂的 JOIN
CREATE POLICY "users_select_inviters" ON users
  FOR SELECT 
  TO authenticated
  USING (
    -- 使用 EXISTS 子查询，避免复杂的 JOIN
    EXISTS (
      SELECT 1 
      FROM household_invitations hi
      WHERE hi.inviter_id = users.id
        AND hi.invitee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
        AND hi.status = 'pending'
        AND hi.expires_at > NOW()
    )
  );

-- 第三步：确保 INSERT 和 UPDATE 策略存在且正确
-- 删除现有的 INSERT 策略
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;

-- 创建 INSERT 策略
CREATE POLICY "users_insert_own" ON users
  FOR INSERT 
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 删除现有的 UPDATE 策略
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;

-- 创建 UPDATE 策略
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第四步：验证所有策略已创建
SELECT 
    '✅ Users Policies' as status,
    policyname, 
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND policyname = 'users_select_own' THEN '✓ Own record'
        WHEN cmd = 'SELECT' AND policyname = 'users_select_household_members' THEN '✓ Household members'
        WHEN cmd = 'SELECT' AND policyname = 'users_select_inviters' THEN '✓ Inviters'
        WHEN cmd = 'INSERT' AND policyname = 'users_insert_own' THEN '✓ Insert own'
        WHEN cmd = 'UPDATE' AND policyname = 'users_update_own' THEN '✓ Update own'
        ELSE '?'
    END as description
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

