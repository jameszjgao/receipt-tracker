-- ============================================
-- 修复 RLS 策略 - 允许用户查询邀请者信息和家庭信息
-- 用于在邀请对话框中显示邀请者email和家庭名称
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：修复 get_user_household_id() 函数
-- 使用 current_household_id 而不是 household_id（支持多家庭架构）
-- SECURITY DEFINER 允许函数绕过 RLS，直接查询 users 表
-- 注意：这个函数只在需要时使用，RLS 策略应该尽量避免调用它
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT current_household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 第二步：修复 Users SELECT 策略
-- 允许用户查看邀请者的email（用于显示邀请对话框）
-- 用户可以通过 inviter_id 查询邀请者的信息
-- 重要：先删除所有现有策略，避免冲突
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

CREATE POLICY "users_select_policy" ON users
  FOR SELECT 
  USING (
    -- 用户可以查看自己（这是最基本的权限，必须放在第一位）
    id = auth.uid() 
    -- 或者查看同家庭的用户（通过 user_households 表）
    OR (
      current_household_id IS NOT NULL
      AND current_household_id IN (
        SELECT household_id 
        FROM user_households 
        WHERE user_id = auth.uid()
      )
    )
    -- 或者查看邀请者信息（用于显示邀请对话框）
    -- 如果当前用户有 pending 邀请，且该用户的 inviter_id 等于这个用户的 id
    -- 注意：使用 auth.users 表获取 email，避免递归查询 users 表
    OR id IN (
      SELECT inviter_id 
      FROM household_invitations 
      WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND status = 'pending'
    )
  );

-- 第三步：修复 Households SELECT 策略
-- 允许用户查看被邀请的家庭信息（用于显示邀请对话框）
DROP POLICY IF EXISTS "households_select_policy" ON households;
DROP POLICY IF EXISTS "households_select_invited" ON households;
DROP POLICY IF EXISTS "households_select_own" ON households;
DROP POLICY IF EXISTS "Users can view their household" ON households;

CREATE POLICY "households_select_policy" ON households
  FOR SELECT 
  USING (
    -- 用户可以查看自己所属的家庭（通过 user_households 表）
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
    -- 或者查看被邀请的家庭（用于显示邀请对话框）
    -- 注意：使用 auth.users 表获取 email，避免递归查询 users 表
    OR id IN (
      SELECT household_id 
      FROM household_invitations 
      WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND status = 'pending'
    )
  );

-- 第四步：确保 user_households 表有正确的 SELECT 策略
DROP POLICY IF EXISTS "user_households_select_policy" ON user_households;
DROP POLICY IF EXISTS "Users can view their household associations" ON user_households;

CREATE POLICY "user_households_select_policy" ON user_households
  FOR SELECT 
  USING (user_id = auth.uid());

-- 第五步：修复 household_invitations 表的 RLS 策略
-- 移除对 users 表的递归查询，改用 auth.users 表
-- 重要：先删除所有现有策略，避免冲突
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

-- SELECT: 用户可以查看自己家庭的邀请或自己收到的邀请
-- 注意：使用 auth.users 表获取 email，避免递归查询 users 表
-- 简化策略：只检查 invitee_email，不检查 household_id（避免查询 user_households 可能触发 users 表查询）
CREATE POLICY "household_invitations_select_policy" ON household_invitations
  FOR SELECT
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者用户可以查看自己所属家庭的邀请（通过 user_households 表）
    -- 注意：这个查询不应该触发对 users 表的查询，因为 user_households 的 RLS 策略只检查 user_id
    OR household_id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- UPDATE: 用户可以更新自己收到的邀请（接受邀请）
-- 注意：使用 auth.users 表获取 email，避免递归查询 users 表
CREATE POLICY "household_invitations_update_policy" ON household_invitations
  FOR UPDATE
  USING (
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第六步：验证策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    CASE WHEN with_check IS NOT NULL THEN '有 WITH CHECK' ELSE '无 WITH CHECK' END as has_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('households', 'users', 'user_households', 'household_invitations')
ORDER BY tablename, policyname;

