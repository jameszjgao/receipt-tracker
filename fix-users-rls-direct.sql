-- ============================================
-- 直接修复 users 表 RLS 策略
-- 使用最简单、最直接的方式
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：禁用 RLS（临时，用于测试）
-- 注意：这只是为了测试，确认问题是否在 RLS 策略本身
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 实际上，我们保持 RLS 启用，但使用最简单的策略

-- 第二步：删除所有现有策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- 第三步：创建一个包含所有条件的单一 SELECT 策略
-- 这样更简单，避免多个策略之间的冲突
CREATE POLICY "users_select_all_allowed" ON users
  FOR SELECT 
  USING (
    -- 用户可以查看自己的记录
    id = auth.uid() 
    -- 或者用户可以查看邀请者的信息
    OR id IN (
      SELECT inviter_id 
      FROM household_invitations 
      WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND status = 'pending'
      AND expires_at > NOW()
    )
    -- 或者用户可以查看同家庭的用户
    OR id IN (
      SELECT uh2.user_id
      FROM user_households uh1
      JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id != auth.uid()
    )
  );

-- 第四步：创建 INSERT 策略
CREATE POLICY "users_insert_allowed" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 第五步：创建 UPDATE 策略
-- 关键：确保 USING 和 WITH CHECK 都正确
CREATE POLICY "users_update_allowed" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第六步：验证
SELECT 
    policyname, 
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

