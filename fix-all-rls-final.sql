-- ============================================
-- 完整修复所有 RLS 问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：修复 household_invitations 表的 RLS 策略
-- 删除所有现有策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

-- 创建最简单的 SELECT 策略（只使用 auth.users，不查询 users 表）
CREATE POLICY "household_invitations_select_policy" ON household_invitations
  FOR SELECT
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者用户可以查看自己所属家庭的邀请
    OR household_id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 创建 INSERT 策略（允许家庭成员创建邀请，需要是管理员）
CREATE POLICY "household_invitations_insert_policy" ON household_invitations
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
    AND inviter_id = auth.uid()
  );

-- 创建 UPDATE 策略
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

-- 第二步：确保 households 表有正确的 SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'households') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON households';
    END LOOP;
END $$;

-- 创建 households SELECT 策略（通过 user_households 表）
CREATE POLICY "households_select_policy" ON households
  FOR SELECT 
  USING (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- 创建 households INSERT 策略（允许创建家庭）
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  WITH CHECK (true);

-- 创建 households UPDATE 策略
CREATE POLICY "households_update_policy" ON households
  FOR UPDATE 
  USING (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- 第三步：确保 user_households 表有正确的 SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_households') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_households';
    END LOOP;
END $$;

CREATE POLICY "user_households_select_policy" ON user_households
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "user_households_insert_policy" ON user_households
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_households_update_policy" ON user_households
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 第四步：验证所有策略
SELECT 
    'household_invitations' as table_name,
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
UNION ALL
SELECT 
    'households' as table_name,
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
UNION ALL
SELECT 
    'user_households' as table_name,
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
ORDER BY table_name, policyname;

