-- ============================================
-- 修复：允许查询同 space 的用户（用于显示小票的 created_by_user）
-- 即使成员已被移除，历史小票的记录者信息也应该能显示
-- ============================================

-- 第一步：检查当前的 users SELECT 策略
SELECT 
  'Current Policies' as check_type,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;

-- 第二步：创建或更新策略，允许查询同 space 的用户
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "users_select_same_space" ON users;
DROP POLICY IF EXISTS "users_select_space_members" ON users;

-- 创建新策略：允许查询同 space 的用户（包括已被移除的）
-- 这对于显示历史小票的 created_by_user 很重要
CREATE POLICY "users_select_same_space" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 允许查询自己的记录
    id = auth.uid()
    OR
    -- 允许查询与自己同 space 的用户（通过 user_spaces 表）
    -- 即使该用户已经被移除，只要历史记录中有关联，就应该能查询
    id IN (
      SELECT DISTINCT us1.user_id
      FROM user_spaces us1
      WHERE us1.space_id IN (
        SELECT us2.space_id
        FROM user_spaces us2
        WHERE us2.user_id = auth.uid()
      )
    )
    OR
    -- 允许查询在 receipts 表中作为 created_by 的用户（历史记录）
    -- 这样可以显示历史小票的记录者，即使该用户已被移除
    id IN (
      SELECT DISTINCT r.created_by
      FROM receipts r
      WHERE r.space_id IN (
        SELECT us.space_id
        FROM user_spaces us
        WHERE us.user_id = auth.uid()
      )
      AND r.created_by IS NOT NULL
    )
  );

-- 第三步：验证策略已创建
SELECT 
  'Policy Verification' as check_type,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;

-- 第四步：测试查询（可选，需要替换为实际用户ID）
-- SELECT 
--   u.id,
--   u.email,
--   u.name
-- FROM users u
-- WHERE u.id IN (
--   SELECT DISTINCT r.created_by
--   FROM receipts r
--   WHERE r.space_id IN (
--     SELECT us.space_id
--     FROM user_spaces us
--     WHERE us.user_id = auth.uid()
--   )
--   AND r.created_by IS NOT NULL
-- );
