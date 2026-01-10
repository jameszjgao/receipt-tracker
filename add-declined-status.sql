-- ============================================
-- 添加 declined 状态到 household_invitations 表
-- ============================================

-- 删除旧的 CHECK 约束
ALTER TABLE household_invitations 
  DROP CONSTRAINT IF EXISTS valid_status;

-- 创建新的 CHECK 约束（包含 declined 状态）
ALTER TABLE household_invitations 
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'declined'));

-- 验证约束
SELECT 
    '=== 验证状态约束 ===' as section,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND conname = 'valid_status';

-- ============================================
-- 完成
-- ============================================

SELECT '✅ declined 状态已添加到约束中' as result;

