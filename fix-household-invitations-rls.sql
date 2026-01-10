-- ============================================
-- 修复 household_invitations 表的 RLS 策略
-- 解决 "permission denied for table users" 错误
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

-- 第二步：创建最简单的 SELECT 策略
-- 只使用 auth.users 表获取 email，避免查询 users 表
CREATE POLICY "household_invitations_select_policy" ON household_invitations
  FOR SELECT
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者用户可以查看自己所属家庭的邀请（通过 user_households 表）
    OR household_id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 第三步：创建 UPDATE 策略
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

-- 第四步：验证策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY policyname;

