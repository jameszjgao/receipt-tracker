-- ============================================
-- 简单且完整的 users 表 RLS 策略修复
-- 确保所有操作都能正常工作
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：强制删除所有现有的 users 表策略（包括可能的隐藏策略）
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有已知的策略名称
    DROP POLICY IF EXISTS "users_select_policy" ON users;
    DROP POLICY IF EXISTS "users_select_own" ON users;
    DROP POLICY IF EXISTS "Users can view users in their household" ON users;
    DROP POLICY IF EXISTS "users_insert_policy" ON users;
    DROP POLICY IF EXISTS "users_insert_own" ON users;
    DROP POLICY IF EXISTS "Users can insert their own record" ON users;
    DROP POLICY IF EXISTS "users_update_policy" ON users;
    DROP POLICY IF EXISTS "users_update_own" ON users;
    DROP POLICY IF EXISTS "Users can update their own record" ON users;
    
    -- 删除所有其他策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 第二步：创建 users SELECT 策略（最基础的权限）
CREATE POLICY "users_select_own" ON users
  FOR SELECT 
  USING (id = auth.uid());

-- 第三步：创建额外的 SELECT 策略，允许查看邀请者
CREATE POLICY "users_select_inviters" ON users
  FOR SELECT 
  USING (
    id IN (
      SELECT inviter_id 
      FROM household_invitations 
      WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND status = 'pending'
      AND expires_at > NOW()
    )
  );

-- 第四步：创建额外的 SELECT 策略，允许查看同家庭的用户
CREATE POLICY "users_select_household_members" ON users
  FOR SELECT 
  USING (
    id IN (
      SELECT uh2.user_id
      FROM user_households uh1
      JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id != auth.uid()
    )
  );

-- 第五步：创建 users INSERT 策略
CREATE POLICY "users_insert_own" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 第六步：创建 users UPDATE 策略
-- 允许用户更新自己的记录（包括 name 和 current_household_id）
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第七步：验证所有策略已创建
SELECT 
    '✅ Verification' as status,
    policyname, 
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as has_using,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 第八步：验证 RLS 已启用
SELECT 
    '✅ RLS Status' as status,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

