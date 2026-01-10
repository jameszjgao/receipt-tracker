-- ============================================
-- 修复 user_households 表的 RLS 策略
-- 确保同一家庭的成员可以互相查看
-- ============================================

-- 1. 删除所有现有的 user_households SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_households' AND cmd = 'SELECT') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_households';
    END LOOP;
END $$;

-- 2. 创建一个辅助函数来检查用户是否属于某个家庭
-- 使用 SECURITY DEFINER 和直接查询来绕过 RLS，避免递归
CREATE OR REPLACE FUNCTION user_belongs_to_household(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- 直接查询 user_households 表，使用 SECURITY DEFINER 绕过 RLS
  -- 这样就不会触发递归
  RETURN EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid()
      AND household_id = p_household_id
  );
END;
$$;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION user_belongs_to_household(UUID) TO authenticated;

-- 3. 创建新的 SELECT 策略
-- 允许用户查看同一家庭的所有成员（通过household_id匹配）
-- 使用辅助函数避免递归（函数内部使用 SECURITY DEFINER 绕过 RLS）
CREATE POLICY "user_households_select_same_household" ON user_households
  FOR SELECT 
  USING (
    -- 用户可以查看自己所属的家庭的所有成员
    -- 使用辅助函数，函数内部使用 SECURITY DEFINER 绕过 RLS，避免递归
    user_belongs_to_household(household_id)
  );

-- 4. 验证策略和函数已创建
SELECT 
    '✅ user_households RLS 策略已修复' as result,
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_households'
ORDER BY cmd, policyname;

-- 5. 验证函数已创建
SELECT 
    '✅ 辅助函数已创建' as result,
    routine_name,
    security_type,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'user_belongs_to_household';

-- 6. 确保 get_household_member_users RPC 函数存在且正确
-- 如果函数不存在，请执行 create-users-rpc-functions.sql

