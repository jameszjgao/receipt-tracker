-- ============================================
-- 最小化 users 表 RLS 策略
-- 先测试最基本的操作，确保策略能正常工作
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 第二步：创建最基本的 SELECT 策略（只允许查看自己）
-- 先测试这个是否工作
CREATE POLICY "users_select_own_minimal" ON users
  FOR SELECT 
  USING (id = auth.uid());

-- 第三步：创建 INSERT 策略
CREATE POLICY "users_insert_own_minimal" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 第四步：创建 UPDATE 策略
CREATE POLICY "users_update_own_minimal" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第五步：验证
SELECT 
    '✅ Minimal policies created' as status,
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 说明：
-- 这个脚本只创建最基本的策略，允许：
-- 1. 用户查看自己的记录
-- 2. 用户插入自己的记录
-- 3. 用户更新自己的记录
-- 
-- 先测试这些基本操作是否工作，如果工作，再添加其他权限

