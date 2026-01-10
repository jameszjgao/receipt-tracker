-- ============================================
-- 从 household_invitations 表删除 token 和 expires_at 字段
-- ============================================

-- 删除 token 字段
ALTER TABLE household_invitations 
  DROP COLUMN IF EXISTS token CASCADE;

-- 删除 expires_at 字段
ALTER TABLE household_invitations 
  DROP COLUMN IF EXISTS expires_at CASCADE;

-- 删除 token 相关的索引
DROP INDEX IF EXISTS idx_household_invitations_token;

-- 验证删除
SELECT 
    '=== 验证字段删除 ===' as section,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'household_invitations'
  AND column_name IN ('token', 'expires_at');

-- ============================================
-- 完成
-- ============================================

SELECT '✅ token 和 expires_at 字段已删除' as result;

