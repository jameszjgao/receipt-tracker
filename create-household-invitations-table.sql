-- 创建家庭邀请表
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建 household_invitations 表
CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_household_invitations_token ON household_invitations(token);
CREATE INDEX IF NOT EXISTS idx_household_invitations_email ON household_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id ON household_invitations(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_status ON household_invitations(status);

-- 启用 Row Level Security
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- SELECT: 用户可以查看自己家庭的邀请或自己收到的邀请
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
    OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- INSERT: 用户可以为自己家庭创建邀请（必须是管理员）
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM user_households 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- UPDATE: 用户可以更新自己收到的邀请（接受邀请）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- 创建函数：自动过期邀请（可以通过定时任务调用）
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE household_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

