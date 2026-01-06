-- ============================================
-- 检查当前用户的 JWT token role
-- 在 Supabase SQL Editor 中执行此脚本（需要以已认证用户身份执行）
-- ============================================

-- 1. 检查当前用户身份和角色
SELECT 
    current_user,
    session_user,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role,
    auth.jwt() as jwt_claims;

-- 2. 检查 households 表的 INSERT 策略
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'INSERT';

-- 3. 检查 RLS 是否启用
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 4. 尝试测试插入（如果 role 正确，应该成功）
-- 注意：这个操作会创建一个测试家庭，执行后可以删除
-- INSERT INTO households (name, address)
-- VALUES ('Test Household from SQL', 'Test Address')
-- RETURNING id, name, address, created_at;

-- 5. 如果插入成功，删除测试数据
-- DELETE FROM households WHERE name = 'Test Household from SQL';

