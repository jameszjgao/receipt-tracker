-- ============================================
-- 彻底修复 household_invitations 表的 RLS 策略
-- 确保不查询 users 表，只使用 user_households 表
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 household_invitations 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- 第二步：确保 user_households 表有正确的 SELECT 策略（不查询 users 表）
DO $$
DECLARE
    r RECORD;
BEGIN
  -- 删除所有现有的 user_households SELECT 策略
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_households'
      AND cmd = 'SELECT'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_households', r.policyname);
  END LOOP;
  
  -- 创建简单的 SELECT 策略（只检查 user_id，不查询 users 表）
  CREATE POLICY "user_households_select_own" ON user_households
    FOR SELECT 
    TO authenticated
    USING (user_id = auth.uid());
  
  RAISE NOTICE 'Created user_households SELECT policy';
END $$;

-- 第三步：创建 household_invitations 表的 RLS 策略（完全不查询 users 表）

-- SELECT: 用户可以查看自己收到的邀请或自己家庭的邀请
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 用户可以查看自己所属家庭的邀请（只查询 user_households 表，不查询 users 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
    )
  );

-- INSERT: 允许用户为自己所属的家庭创建邀请（必须是管理员）
-- 完全不查询 users 表，只查询 user_households 表
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  );

-- UPDATE: 用户可以更新自己收到的邀请（接受或拒绝）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  TO authenticated
  USING (
    -- 只能更新自己收到的邀请（使用 auth.users，不查询 public.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 或者管理员可以更新自己家庭的邀请（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  )
  WITH CHECK (
    -- 更新后仍然必须是自己的邀请或自己家庭的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  );

-- DELETE: 管理员可以删除自己家庭的邀请，或用户可以删除自己收到的邀请
CREATE POLICY "household_invitations_delete" ON household_invitations
  FOR DELETE
  TO authenticated
  USING (
    -- 管理员可以删除自己家庭的邀请（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
    OR
    -- 用户可以删除自己收到的邀请（使用 auth.users，不查询 public.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第四步：验证策略已创建
SELECT 
    '✅ household_invitations policies' as status,
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- 第五步：验证 user_households 策略
SELECT 
    '✅ user_households policies' as status,
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
ORDER BY cmd, policyname;

-- 第六步：检查是否有触发器查询 users 表
SELECT 
    '✅ Triggers check' as status,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

