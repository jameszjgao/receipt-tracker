-- ============================================
-- 修复 households 表的 INSERT RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 删除现有的 households INSERT 策略（如果存在）
DROP POLICY IF EXISTS "households_insert_policy" ON households;
DROP POLICY IF EXISTS "households_insert" ON households;
DROP POLICY IF EXISTS "Users can insert their household" ON households;
DROP POLICY IF EXISTS "Users can create their household" ON households;

-- 重新创建 INSERT 策略
-- 允许任何已认证用户创建家庭（注册时需要）
-- 重要：新用户还没有家庭，所以必须允许所有已认证用户创建
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 验证策略是否创建成功
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- 如果策略创建成功，应该看到：
-- tablename: households
-- policyname: households_insert_policy
-- cmd: INSERT
-- roles: {authenticated}
-- with_check: true

