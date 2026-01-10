-- ============================================
-- 完整解决方案：修复 users 表 RLS 问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：创建或替换 SECURITY DEFINER 函数
-- 这个函数会绕过 RLS，直接查询 users 表
CREATE OR REPLACE FUNCTION get_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  current_household_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.current_household_id,
    u.created_at
  FROM users u
  WHERE u.id = p_user_id;
END;
$$;

-- 第二步：授予函数执行权限
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO anon;

-- 第三步：删除所有现有的 users 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 第四步：创建最简单的 RLS 策略
-- 只允许用户查看自己的记录（最基本的权限）
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  USING (id = auth.uid());

-- 创建 INSERT 策略
CREATE POLICY "users_insert_own" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 创建 UPDATE 策略
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第五步：验证函数和策略
SELECT 
    'Function created' as status,
    routine_name,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_by_id';

SELECT 
    'Policy created' as status,
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- 第六步：检查 RLS 是否启用
SELECT 
    'RLS status' as status,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

