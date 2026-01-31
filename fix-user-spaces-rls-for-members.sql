-- ============================================
-- 修复 user_spaces 表的 SELECT 策略
-- 允许用户查看同一空间的所有成员
-- ============================================

-- 删除现有的 SELECT 策略
DROP POLICY IF EXISTS "user_spaces_select_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_select_same_space" ON user_spaces;

-- 创建新的 SELECT 策略：用户可以查看同一空间的所有成员
-- 逻辑：如果用户属于某个空间，则可以查看该空间的所有成员
CREATE POLICY "user_spaces_select_same_space" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (
    -- 用户可以查看自己所在空间的所有成员
    space_id IN (
      SELECT us.space_id 
      FROM user_spaces us 
      WHERE us.user_id = auth.uid()
    )
  );

-- 验证策略已创建
SELECT 
  policyname,
  cmd,
  qual::text as policy_definition
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT';

-- 测试：查看当前用户所在空间的成员数量
-- SELECT space_id, COUNT(*) as member_count 
-- FROM user_spaces 
-- GROUP BY space_id;
