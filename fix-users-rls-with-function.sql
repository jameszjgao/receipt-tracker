-- ============================================
-- 使用 SECURITY DEFINER 函数绕过 RLS 限制
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：创建 SECURITY DEFINER 函数来获取用户信息
-- 这个函数会绕过 RLS，直接查询 users 表
CREATE OR REPLACE FUNCTION get_user_by_id(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  current_household_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 第二步：确保 users 表有最基本的 RLS 策略
-- 删除所有现有策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 创建最简单的策略：只允许用户查看自己的记录
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

-- 第三步：验证
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- 第四步：授予函数执行权限（确保所有用户都能调用）
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO anon;

-- 第五步：验证函数已创建
SELECT 
    routine_name, 
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_by_id';

