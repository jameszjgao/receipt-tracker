-- ============================================
-- 修复 user_spaces 表的 RLS 策略
-- 解决登录后无法识别到已有space的问题
-- ============================================

-- 第一步：检查当前的 user_spaces SELECT 策略
SELECT 
  'Current Policies' as check_type,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT'
ORDER BY policyname;

-- 第二步：删除所有现有的 user_spaces SELECT 策略
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_spaces'
      AND cmd = 'SELECT'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_spaces', r.policyname);
    RAISE NOTICE '✅ 删除了旧策略: %', r.policyname;
  END LOOP;
END $$;

-- 第三步：创建正确的 SELECT 策略
-- 策略：用户可以查看自己的 user_spaces 记录
-- 这是最基本的策略，允许 getUserSpaces() 函数正常工作
CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 第四步：验证策略已创建
SELECT 
  'Policy Verification' as check_type,
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'user_spaces' AND cmd = 'SELECT'
ORDER BY policyname;

-- 第五步：测试查询（需要替换为实际用户ID）
-- SELECT 
--   us.id,
--   us.user_id,
--   us.space_id,
--   s.name as space_name
-- FROM user_spaces us
-- LEFT JOIN spaces s ON s.id = us.space_id
-- WHERE us.user_id = auth.uid();

-- 完成提示
DO $$
BEGIN
-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ user_spaces SELECT 策略已修复！';
  RAISE NOTICE '现在用户可以查看自己的 space 关联记录了。';
END $$;
END $$;
