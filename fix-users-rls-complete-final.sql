-- ============================================
-- 完整修复 users 表 RLS 策略
-- 解决所有 "permission denied for table users" 错误
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 users 表策略（确保没有残留）
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
-- 1. 自己的记录（最基本的权限）
-- 2. 邀请者的信息（如果当前用户有 pending 邀请）
-- 3. 同家庭的用户（通过 user_households 表）
CREATE POLICY "users_select_policy" ON users
  FOR SELECT 
  USING (
    -- 条件1：用户可以查看自己的记录（最基本的权限，必须放在第一位）
    id = auth.uid() 
    -- 条件2：用户可以查看邀请者的信息（用于显示邀请对话框）
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
    -- 条件3：用户可以查看同家庭的用户（通过 user_households 表）
    -- 注意：不查询 users 表的 current_household_id，而是直接通过 user_households 表关联
    -- 这个策略允许用户查看与自己同家庭的所有其他用户（用于显示家庭成员列表）
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
-- 用于切换家庭时更新 current_household_id
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 第五步：验证策略已创建
SELECT 
    '✅ Policy created' as status,
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- 第六步：验证 RLS 已启用
SELECT 
    '✅ RLS status' as status,
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 说明：
-- 1. SELECT 策略允许用户查看自己、邀请者和同家庭的用户
-- 2. UPDATE 策略允许用户更新自己的记录（包括切换家庭）
-- 3. 所有策略都避免递归查询 users 表，使用 auth.users 或 user_households 表

