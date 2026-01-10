-- ============================================
-- 调整 users 表的 RLS 策略
-- 给予被邀请者查询邀请者信息的权限
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

-- 第二步：创建 users SELECT 策略
-- 允许用户查看：
-- 1. 自己的记录
-- 2. 邀请者的信息（如果当前用户有 pending 邀请）
-- 3. 同家庭的用户（通过 user_households 表）
CREATE POLICY "users_select_policy" ON users
  FOR SELECT 
  USING (
    -- 用户可以查看自己的记录（最基本的权限，必须放在第一位）
    id = auth.uid() 
    -- 或者用户可以查看邀请者的信息（用于显示邀请对话框）
    -- 如果当前用户有 pending 邀请，且该用户的 id 是邀请者（inviter_id）
    -- 注意：使用 auth.users 表获取 email，避免递归查询 users 表
    OR id IN (
      SELECT inviter_id 
      FROM household_invitations 
      WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
      AND status = 'pending'
      AND expires_at > NOW()
    )
    -- 或者用户可以查看同家庭的用户（通过 user_households 表）
    -- 注意：不查询 users 表的 current_household_id，而是直接通过 user_households 表关联
    -- 这个策略允许用户查看与自己同家庭的所有其他用户
    OR id IN (
      SELECT uh2.user_id
      FROM user_households uh1
      JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id != auth.uid()
    )
  );

-- 第三步：创建 users INSERT 策略
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 第四步：创建 users UPDATE 策略
-- 允许用户更新自己的记录（包括 current_household_id）
-- USING 子句检查用户是否只能更新自己的记录
-- WITH CHECK 子句确保更新后的记录仍然是自己的
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第五步：验证策略
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

-- 第六步：测试查询（可选，需要替换为实际的用户 ID 和邀请者 ID）
-- 注意：这个测试需要在有用户登录的情况下运行
-- SELECT id, email, name FROM users WHERE id = auth.uid(); -- 查看自己
-- SELECT id, email, name FROM users WHERE id IN (
--   SELECT inviter_id FROM household_invitations 
--   WHERE invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
--   AND status = 'pending'
-- ); -- 查看邀请者

