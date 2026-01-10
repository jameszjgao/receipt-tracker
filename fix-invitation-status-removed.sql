-- ============================================
-- 修复邀请表以支持 'removed' 状态
-- 1. 修改 CHECK 约束以支持 'removed' 状态
-- 2. 更新 RLS 策略以允许管理员更新自己家庭的邀请记录
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除现有的 CHECK 约束
ALTER TABLE household_invitations
  DROP CONSTRAINT IF EXISTS valid_status;

-- 第二步：重新创建 CHECK 约束，包含 'removed' 和 'declined' 状态
ALTER TABLE household_invitations
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed'));

-- 第三步：删除现有的 UPDATE 策略
DROP POLICY IF EXISTS "household_invitations_update" ON household_invitations;

-- 第四步：创建新的 UPDATE 策略，允许：
-- 1. 用户更新自己收到的邀请（接受/拒绝邀请）
-- 2. 管理员更新自己家庭的邀请记录（移除成员时更新状态）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  USING (
    -- 用户可以更新自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者管理员可以更新自己家庭的邀请记录
    OR household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  )
  WITH CHECK (
    -- 确保更新后：
    -- 1. 如果是自己的邀请，保持是自己的邀请
    -- 2. 如果是管理员更新，必须是管理员所属家庭的邀请
    (
      invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
    OR (
      household_id IN (
        SELECT household_id 
        FROM user_households 
        WHERE user_id = auth.uid() AND is_admin = TRUE
      )
    )
  );

-- 第五步：验证约束已更新
SELECT 
    '✅ Status constraint updated' as status,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND conname = 'valid_status';

-- 第六步：验证策略已更新
SELECT 
    '✅ Update policy updated' as status,
    policyname, 
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND policyname = 'household_invitations_update';

