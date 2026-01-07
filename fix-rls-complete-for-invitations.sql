-- ============================================
-- 完整修复 RLS 策略以支持邀请功能
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 第一部分：修复 users 表的 SELECT 策略
-- ============================================

-- 删除所有现有的 users SELECT 策略
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
        RAISE NOTICE 'Dropped users SELECT policy: %', r.policyname;
    END LOOP;
END $$;

-- 创建新的 users SELECT 策略
-- 策略1：用户可以查看自己的记录（最重要，必须放在第一位）
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- 策略2：用户可以查看同一家庭的成员
CREATE POLICY "users_select_household_members" ON users
  FOR SELECT 
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_households WHERE user_id = auth.uid())
    AND
    id IN (
      SELECT uh2.user_id 
      FROM user_households uh1
      INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
    )
  );

-- ============================================
-- 第二部分：修复 households 表的 SELECT 策略
-- ============================================

-- 删除所有现有的 households SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'households'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON households', r.policyname);
        RAISE NOTICE 'Dropped households SELECT policy: %', r.policyname;
    END LOOP;
END $$;

-- 创建新的 households SELECT 策略
-- 策略1：用户可以查看自己的家庭（通过 user_households 关联）
CREATE POLICY "households_select_own" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 策略2：用户可以查看他们收到邀请的家庭（关键修复）
-- 注意：直接使用 auth.users 表，避免 RLS 限制
CREATE POLICY "households_select_invited" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT hi.household_id 
      FROM household_invitations hi
      WHERE hi.status = 'pending'
        AND hi.expires_at > NOW()
        AND hi.invitee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
  );

-- ============================================
-- 第三部分：验证所有策略
-- ============================================

-- 验证 users 表策略
SELECT 
    'Users Policies' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND policyname = 'users_select_own' AND 'authenticated' = ANY(roles) THEN '✓ Correct'
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN '✓ Present'
        ELSE '✗ Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 验证 households 表策略
SELECT 
    'Households Policies' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND policyname LIKE '%invited%' AND 'authenticated' = ANY(roles) THEN '✓ Invited policy present'
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN '✓ Present'
        ELSE '✗ Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================
-- 第四部分：显示所有相关策略（用于调试）
-- ============================================

SELECT 
    'All Policies Summary' as check_type,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'households')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;


