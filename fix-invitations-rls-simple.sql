-- ============================================
-- 简化 household_invitations 表的 RLS 策略
-- 允许用户直接插入邀请，不使用 RPC 函数
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

-- 第二步：创建简化的 RLS 策略

-- SELECT: 用户可以查看自己收到的邀请或自己家庭的邀请
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 用户可以查看自己所属家庭的邀请（通过 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
    )
  );

-- INSERT: 允许用户为自己所属的家庭创建邀请（必须是管理员）
-- 简化策略：只检查用户是否是管理员，不查询 users 表
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员
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
    -- 只能更新自己收到的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 或者管理员可以更新自己家庭的邀请
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
    -- 管理员可以删除自己家庭的邀请
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
    OR
    -- 用户可以删除自己收到的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第三步：确保 user_households 表有正确的 SELECT 策略
-- 如果 user_households 表的 SELECT 策略不允许用户查看自己的记录，INSERT 策略会失败
DO $$
BEGIN
  -- 检查是否存在允许用户查看自己记录的 SELECT 策略
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_households' 
      AND cmd = 'SELECT'
      AND (qual LIKE '%user_id = auth.uid()%' OR qual LIKE '%auth.uid() = user_id%')
  ) THEN
    -- 如果不存在，创建一个
    CREATE POLICY "user_households_select_own" ON user_households
      FOR SELECT 
      TO authenticated
      USING (user_id = auth.uid());
    
    RAISE NOTICE 'Created user_households SELECT policy';
  ELSE
    RAISE NOTICE 'user_households SELECT policy already exists';
  END IF;
END $$;

-- 第四步：验证策略已创建
SELECT 
    '✅ household_invitations policies' as status,
    policyname, 
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN '查看邀请'
        WHEN cmd = 'INSERT' THEN '创建邀请'
        WHEN cmd = 'UPDATE' THEN '更新邀请'
        WHEN cmd = 'DELETE' THEN '删除邀请'
        ELSE '?'
    END as description
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- 第五步：验证 RLS 已启用
SELECT 
    '✅ RLS status' as status,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations';

