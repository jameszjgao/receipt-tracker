-- ============================================
-- 测试 households 表的 INSERT 操作
-- 在 Supabase SQL Editor 中执行此脚本（需要以已认证用户身份执行）
-- ============================================

-- 1. 检查当前用户身份
SELECT 
    current_user,
    session_user,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role;

-- 2. 检查 households 表的 RLS 策略
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

-- 3. 检查 RLS 是否启用
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 4. 尝试直接插入测试（如果策略正确，应该成功）
-- 注意：这个操作会创建一个测试家庭，执行后可以删除
INSERT INTO households (name, address)
VALUES ('Test Household', 'Test Address')
RETURNING id, name, address, created_at;

-- 5. 如果插入成功，删除测试数据
-- DELETE FROM households WHERE name = 'Test Household';

-- 6. 如果插入失败，检查错误信息
-- 错误信息会显示具体的 RLS 策略问题

