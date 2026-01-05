-- 修复 households 表的 INSERT 策略，允许用户创建新家庭
-- 在 Supabase SQL Editor 中执行此脚本

-- 检查并删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can insert their household" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "households_insert" ON households;
DROP POLICY IF EXISTS "households_insert_policy" ON households;

-- 允许所有已认证用户创建家庭
-- 注意：使用 WITH CHECK (true) 允许任何已认证用户创建家庭
-- 这是必要的，因为新用户还没有 household_id，无法使用 get_user_household_id() 检查
CREATE POLICY "Users can create households" ON households
  FOR INSERT 
  WITH CHECK (true);

-- 验证策略是否创建成功
SELECT 
    tablename, 
    policyname, 
    cmd,
    CASE WHEN with_check IS NOT NULL THEN '有 WITH CHECK' ELSE '无 WITH CHECK' END as has_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'households'
ORDER BY policyname;

