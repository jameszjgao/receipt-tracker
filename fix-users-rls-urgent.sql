-- ============================================
-- 紧急修复：确保用户能够查询自己的记录
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 users 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 第二步：创建最简单的 users SELECT 策略
-- 只允许用户查看自己的记录（最基本的权限）
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  USING (id = auth.uid());

-- 第三步：创建 users INSERT 策略
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 第四步：创建 users UPDATE 策略
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第五步：验证策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

