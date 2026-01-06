-- 修复 household_invitations 表的 UPDATE RLS 策略
-- 允许管理员更新（撤销）他们家庭的邀请
-- 在 Supabase SQL Editor 中执行此脚本

-- 删除现有的 UPDATE 策略
DROP POLICY IF EXISTS "household_invitations_update" ON household_invitations;

-- 创建新的 UPDATE 策略：
-- 1. 允许用户更新自己收到的邀请（接受/拒绝邀请）
-- 2. 允许管理员更新他们家庭的邀请（撤销邀请）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  USING (
    -- 用户可以更新自己收到的邀请
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
    OR
    -- 管理员可以更新他们家庭的邀请
    household_id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  )
  WITH CHECK ( ，
    -- 用户可以更新自己收到的邀请
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
    OR
    -- 管理员可以更新他们家庭的邀请
    household_id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- 验证策略已创建
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND policyname = 'household_invitations_update';

