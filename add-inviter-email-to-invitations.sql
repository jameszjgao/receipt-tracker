-- ============================================
-- 在 household_invitations 表中添加 inviter_email 字段
-- 这样查询邀请时就不需要再查询 users 表，避免 RLS 权限问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：添加 inviter_email 字段
ALTER TABLE household_invitations
ADD COLUMN IF NOT EXISTS inviter_email TEXT;

-- 第二步：为现有记录填充 inviter_email（如果有的话）
-- 注意：这个更新可能会因为 RLS 策略而失败，但不影响新记录的创建
UPDATE household_invitations hi
SET inviter_email = (
  SELECT u.email 
  FROM users u 
  WHERE u.id = hi.inviter_id
)
WHERE inviter_email IS NULL
  AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = hi.inviter_id
  );

-- 第三步：创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_household_invitations_inviter_email 
ON household_invitations(inviter_email);

-- 第四步：验证字段已添加
SELECT 
    '✅ Column added' as status,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'household_invitations'
  AND column_name = 'inviter_email';

