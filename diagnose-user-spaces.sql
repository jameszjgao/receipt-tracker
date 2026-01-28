-- 诊断用户空间关联问题
-- 用于检查为什么登录后无法识别到已有的space

-- 1. 检查当前认证用户（需要在应用中使用，这里只是示例）
-- SELECT auth.uid() as current_user_id;

-- 2. 检查特定用户的user_spaces关联（替换YOUR_USER_ID为实际用户ID）
-- SELECT 
--   us.id,
--   us.user_id,
--   us.space_id,
--   us.is_admin,
--   us.created_at,
--   s.name as space_name,
--   s.address as space_address
-- FROM user_spaces us
-- LEFT JOIN spaces s ON s.id = us.space_id
-- WHERE us.user_id = 'YOUR_USER_ID'
-- ORDER BY us.created_at DESC;

-- 3. 检查users表中的用户记录和current_space_id
-- SELECT 
--   id,
--   email,
--   name,
--   current_space_id,
--   created_at
-- FROM users
-- WHERE id = 'YOUR_USER_ID';

-- 4. 检查所有用户的space关联情况（管理员查询）
SELECT 
  u.id as user_id,
  u.email,
  u.name,
  u.current_space_id,
  COUNT(us.id) as space_count,
  STRING_AGG(s.name, ', ') as space_names
FROM users u
LEFT JOIN user_spaces us ON us.user_id = u.id
LEFT JOIN spaces s ON s.id = us.space_id
GROUP BY u.id, u.email, u.name, u.current_space_id
ORDER BY u.created_at DESC
LIMIT 20;

-- 5. 检查user_spaces表的RLS策略
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
ORDER BY policyname;

-- 6. 检查spaces表的RLS策略
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
WHERE tablename = 'spaces'
ORDER BY policyname;

-- 7. 检查是否有孤立的空间关联（user_spaces存在但space不存在）
SELECT 
  us.id,
  us.user_id,
  us.space_id,
  us.created_at
FROM user_spaces us
LEFT JOIN spaces s ON s.id = us.space_id
WHERE s.id IS NULL;

-- 8. 检查是否有孤立的空间（space存在但没有user_spaces关联）
SELECT 
  s.id,
  s.name,
  s.address,
  s.created_at
FROM spaces s
LEFT JOIN user_spaces us ON us.space_id = s.id
WHERE us.id IS NULL;
