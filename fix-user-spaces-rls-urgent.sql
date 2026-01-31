-- ============================================
-- 紧急修复：user_spaces 表的 RLS 策略
-- 解决循环依赖问题，允许查看同一空间的成员
-- ============================================

-- 第一步：删除有问题的策略
DROP POLICY IF EXISTS "user_spaces_select_same_space" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_select_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_select_own_and_same_space" ON user_spaces;

-- 第二步：删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_user_space_ids();

-- 第三步：创建 SECURITY DEFINER 函数来获取用户的 space_id 列表
-- 这个函数绕过 RLS，不会造成循环依赖
CREATE OR REPLACE FUNCTION get_user_space_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT space_id FROM user_spaces WHERE user_id = auth.uid();
$$;

-- 第四步：创建新的 SELECT 策略
-- 用户可以查看自己的记录，或者同一空间的其他成员
CREATE POLICY "user_spaces_select_own_and_same_space" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR 
    space_id IN (SELECT get_user_space_ids())
  );

-- 验证策略已创建
SELECT 
  policyname,
  cmd,
  qual::text as policy_definition
FROM pg_policies
WHERE tablename = 'user_spaces';
