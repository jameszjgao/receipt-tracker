-- ============================================
-- 简化版：修复 user_spaces 表的 SELECT 策略
-- 解决登录后无法识别到已有space的问题
-- ============================================

-- 删除现有的 SELECT 策略（可能有循环依赖问题）
DROP POLICY IF EXISTS "user_spaces_select_policy" ON user_spaces;

-- 创建正确的 SELECT 策略
-- 策略：用户可以查看自己的 user_spaces 记录
-- 这是最基本的策略，允许 getUserSpaces() 函数正常工作
CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 验证策略已创建
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT';
