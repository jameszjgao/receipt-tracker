-- ============================================
-- 完全修复 household_invitations 表的 RLS 策略
-- 确保创建邀请和查询邀请都不会触发 users 表的权限检查
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 household_invitations 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

-- 第二步：创建 SELECT 策略
-- 用户可以查看：
-- 1. 自己收到的邀请（通过 email 匹配，使用 auth.users）
-- 2. 自己所属家庭的邀请（通过 user_households，不查询 users 表）
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者用户可以查看自己所属家庭的邀请（通过 user_households，不查询 users 表）
    OR household_id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 第三步：创建 INSERT 策略
-- 用户可以为自己家庭创建邀请（必须是管理员）
-- 只使用 user_households 表检查，不查询 users 表
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  WITH CHECK (
    -- 检查用户是否是管理员（只查询 user_households，不查询 users 表）
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
    -- 确保 inviter_id 是当前用户（不需要查询 users 表验证）
    AND inviter_id = auth.uid()
  );

-- 第四步：创建 UPDATE 策略
-- 用户可以更新自己收到的邀请（接受/拒绝邀请）
-- 只使用 auth.users 获取 email，不查询 users 表
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  USING (
    -- 用户可以更新自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- 确保更新后仍然是自己的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第五步：验证策略已创建
SELECT 
    '✅ household_invitations policies' as status,
    policyname, 
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- 第六步：验证 RLS 已启用
SELECT 
    '✅ RLS status' as status,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'household_invitations';

-- 第七步：测试查询（可选，需要用户登录）
-- SELECT COUNT(*) FROM household_invitations 
-- WHERE invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid());

