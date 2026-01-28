-- ============================================
-- 验证修复：成员显示和小票记录者问题
-- ============================================

-- 1. 验证 users SELECT 策略
SELECT 
  '✅ Users SELECT Policies' as check_type,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%created_by%' THEN '✅ Includes receipts.created_by'
    WHEN qual LIKE '%user_spaces%' THEN '✅ Includes same space users'
    ELSE 'Other'
  END as policy_scope
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;

-- 2. 检查邀请状态分布
SELECT 
  '📊 Invitation Status Distribution' as check_type,
  status,
  COUNT(*) as count
FROM space_invitations
GROUP BY status
ORDER BY count DESC;

-- 3. 检查是否有 accepted 状态但用户不在成员列表的情况
SELECT 
  '⚠️  Accepted but not member' as check_type,
  si.id,
  si.invitee_email,
  si.status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM user_spaces us
      JOIN users u ON u.id = us.user_id
      WHERE us.space_id = si.space_id
      AND LOWER(u.email) = LOWER(si.invitee_email)
    ) THEN '✅ Is member'
    ELSE '❌ Not member'
  END as member_status
FROM space_invitations si
WHERE si.status = 'accepted'
ORDER BY si.created_at DESC
LIMIT 10;

-- 4. 检查小票的 created_by 和用户信息
SELECT 
  '📝 Receipts with created_by' as check_type,
  COUNT(*) as total_receipts,
  COUNT(created_by) as receipts_with_created_by,
  COUNT(*) - COUNT(created_by) as receipts_without_created_by,
  COUNT(DISTINCT created_by) as unique_creators
FROM receipts
WHERE space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
);

-- 5. 测试查询：检查是否能查询到 created_by 用户信息
SELECT 
  '🔍 Test: Receipt created_by user info' as check_type,
  r.id as receipt_id,
  r.supplier_name,
  r.created_by,
  u.email as created_by_email,
  u.name as created_by_name,
  CASE 
    WHEN u.id IS NULL THEN '❌ User not found'
    WHEN u.email IS NULL THEN '⚠️  User found but email null'
    ELSE '✅ User info available'
  END as status
FROM receipts r
LEFT JOIN users u ON u.id = r.created_by
WHERE r.space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
)
AND r.created_by IS NOT NULL
ORDER BY r.created_at DESC
LIMIT 10;

-- 6. 检查是否有已移除成员的小票
SELECT 
  '👤 Removed members receipts' as check_type,
  COUNT(*) as receipts_count,
  COUNT(DISTINCT r.created_by) as unique_removed_creators
FROM receipts r
WHERE r.space_id IN (
  SELECT us.space_id
  FROM user_spaces us
  WHERE us.user_id = auth.uid()
)
AND r.created_by IS NOT NULL
AND r.created_by NOT IN (
  SELECT us.user_id
  FROM user_spaces us
  WHERE us.space_id IN (
    SELECT us2.space_id
    FROM user_spaces us2
    WHERE us2.user_id = auth.uid()
  )
);
