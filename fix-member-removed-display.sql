-- ============================================
-- 修复：确保 users 表的 RLS 策略允许查询同 space 的用户
-- 用于显示小票的 created_by_user 信息
-- ============================================

-- 检查当前的 users SELECT 策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;

-- 创建或更新策略：允许查询同 space 的用户（即使他们已经被移除）
-- 这对于显示历史小票的 created_by_user 很重要

-- 删除可能冲突的策略
DROP POLICY IF EXISTS "users_select_same_space" ON users;

-- 创建新策略：允许查询同 space 的用户
CREATE POLICY "users_select_same_space" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 允许查询与自己同 space 的用户（通过 user_spaces 表）
    -- 即使该用户已经被移除，只要历史记录中有关联，就应该能查询
    id IN (
      SELECT us1.user_id
      FROM user_spaces us1
      WHERE us1.space_id IN (
        SELECT us2.space_id
        FROM user_spaces us2
        WHERE us2.user_id = auth.uid()
      )
    )
    OR
    -- 允许查询自己的记录
    id = auth.uid()
  );

-- 验证策略已创建
SELECT 
  'Policy Verification' as check_type,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;
