-- 修复 users 表的 RLS SELECT 策略以支持多家庭系统
-- 允许同一家庭的用户查看其他成员的email和name
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 创建函数：检查两个用户是否在同一家庭（使用 SECURITY DEFINER 避免递归）
CREATE OR REPLACE FUNCTION users_in_same_household(p_current_user_id UUID, p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- 检查两个用户是否有共同的家庭
  SELECT EXISTS (
    SELECT 1 
    FROM user_households uh1
    INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
    WHERE uh1.user_id = p_current_user_id
      AND uh2.user_id = p_target_user_id
  );
$$;

-- 2. 删除现有的 users SELECT 策略
DROP POLICY IF EXISTS "Users can view users in their household" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- 3. 创建新的 SELECT 策略：
-- 用户可以查看同一家庭中所有成员的信息，或者自己的信息
CREATE POLICY "users_select_policy" ON users
  FOR SELECT USING (
    -- 用户可以查看自己的记录
    id = auth.uid()
    OR
    -- 或者用户可以查看同一家庭中其他成员的记录
    -- 使用 SECURITY DEFINER 函数来检查，避免递归
    users_in_same_household(auth.uid(), users.id)
  );

-- 5. 验证策略已创建
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND policyname = 'users_select_policy';

