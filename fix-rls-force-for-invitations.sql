-- ============================================
-- 强制修复 RLS 策略以支持邀请功能
-- 此脚本会强制删除所有相关策略并重新创建
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 第一步：强制删除所有 users 表的策略
-- ============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
        RAISE NOTICE 'Dropped users policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- 第二步：强制删除所有 households 表的策略
-- ============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'households'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON households', r.policyname);
        RAISE NOTICE 'Dropped households policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- 第三步：确保 RLS 已启用
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 第四步：创建 users 表的策略（最简化，只允许查看自己的记录）
-- ============================================

-- 策略1：用户可以查看自己的记录（最重要）
-- 这个策略必须存在，且必须是第一个
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- 策略2：用户可以插入自己的记录（注册时需要）
CREATE POLICY "users_insert_own" ON users
  FOR INSERT 
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 策略3：用户可以更新自己的记录
CREATE POLICY "users_update_own" ON users
  FOR UPDATE 
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 策略4：用户可以查看同一家庭的成员（可选，用于家庭功能）
CREATE POLICY "users_select_household_members" ON users
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT uh2.user_id 
      FROM user_households uh1
      INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
    )
  );

-- ============================================
-- 第五步：创建 households 表的策略
-- ============================================

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
-- 使用 auth.users 表直接获取 email，避免 RLS 限制
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

-- 策略3：用户可以插入新家庭（注册时需要）
CREATE POLICY "households_insert" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 策略4：用户可以更新自己的家庭
CREATE POLICY "households_update_own" ON households
  FOR UPDATE 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第六步：验证策略已创建
-- ============================================

-- 验证 users 表策略
SELECT 
    'Users Policies Created' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' AND policyname = 'users_select_own' THEN '✓ Critical policy exists'
        WHEN cmd IN ('SELECT', 'INSERT', 'UPDATE') THEN '✓ Policy exists'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 验证 households 表策略
SELECT 
    'Households Policies Created' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' AND policyname LIKE '%invited%' THEN '✓ Invited policy exists'
        WHEN cmd IN ('SELECT', 'INSERT', 'UPDATE') THEN '✓ Policy exists'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- ============================================
-- 第七步：测试策略（需要使用当前用户）
-- ============================================
-- 注意：这些测试查询需要在有用户登录的情况下运行
-- 在客户端应用中使用这些查询来测试

-- 测试1：检查是否可以查看自己的用户记录
SELECT 
    'Test: Can see own user record?' as test,
    COUNT(*) as record_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ YES'
        ELSE '✗ NO - This is a problem!'
    END as result
FROM users
WHERE id = auth.uid();

