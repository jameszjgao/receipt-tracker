-- ============================================
-- 修复 users 表的 SELECT RLS 策略
-- 允许用户查询自己的记录，即使还没有 household
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：检查当前的 users SELECT 策略
SELECT 
    'Current Policies' as check_type,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 第二步：删除所有现有的 users SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
        RAISE NOTICE 'Dropped SELECT policy: %', r.policyname;
    END LOOP;
END $$;

-- 第三步：创建新的 SELECT 策略
-- 策略1：用户可以查看自己的记录（关键：即使没有 household 也能查看）
-- 这是最重要的策略，必须放在第一位
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- 策略2：用户可以查看同一家庭的成员（通过 user_households 关联）
-- 注意：只有当用户已经在某个家庭中时才适用
CREATE POLICY "users_select_household_members" ON users
  FOR SELECT 
  TO authenticated
  USING (
    -- 确保用户至少属于一个家庭
    EXISTS (
      SELECT 1 FROM user_households WHERE user_id = auth.uid()
    )
    AND
    -- 查看同一家庭的其他成员
    id IN (
      SELECT uh2.user_id 
      FROM user_households uh1
      INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
    )
  );

-- 第四步：验证策略已创建
SELECT 
    'Policy Verification' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN '✓ Correct'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 第五步：显示所有 users 相关的策略（用于调试）
SELECT 
    'All Users Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

