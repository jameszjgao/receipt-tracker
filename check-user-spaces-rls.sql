-- 检查 user_spaces 表的 RLS 策略
-- 这是关键！getUserSpaces 函数查询这个表

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_spaces'
ORDER BY cmd, policyname;

-- 如果上面的查询返回空结果或没有 SELECT 策略，说明问题就在这里！
-- 需要创建 SELECT 策略允许用户查看自己的 user_spaces 记录
