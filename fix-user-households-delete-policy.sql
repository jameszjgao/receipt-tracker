-- ============================================
-- 修复 user_households 表的 DELETE RLS 策略
-- 允许管理员删除同一家庭中的其他成员
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的 DELETE 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_households' 
          AND cmd = 'DELETE'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_households', r.policyname);
    END LOOP;
END $$;

-- 第二步：创建辅助函数来检查用户是否是管理员
-- 使用 SECURITY DEFINER 绕过 RLS，避免递归问题
CREATE OR REPLACE FUNCTION is_admin_of_household(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- 直接查询 user_households 表，使用 SECURITY DEFINER 绕过 RLS
  RETURN EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid()
      AND household_id = p_household_id
      AND is_admin = TRUE
  );
END;
$$;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION is_admin_of_household(UUID) TO authenticated;

-- 第三步：创建 RPC 函数来删除成员（作为备选方案，绕过 RLS）
CREATE OR REPLACE FUNCTION remove_household_member(
  p_target_user_id UUID,
  p_household_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- 获取当前用户ID
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- 检查当前用户是否是管理员
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = v_current_user_id
      AND household_id = p_household_id
      AND is_admin = TRUE
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can remove members';
  END IF;
  
  -- 不允许删除自己（通过UI应该已经阻止，但在这里也做保护）
  IF v_current_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;
  
  -- 删除成员关联（绕过 RLS）
  DELETE FROM user_households
  WHERE user_id = p_target_user_id
    AND household_id = p_household_id;
  
  RETURN TRUE;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION remove_household_member(UUID, UUID) TO authenticated;

-- 第四步：创建 DELETE 策略
-- 允许：
-- 1. 用户可以删除自己的关联（离开家庭）
-- 2. 管理员可以删除同一家庭中其他成员的关联（移除成员）
CREATE POLICY "user_households_delete_policy" ON user_households
  FOR DELETE USING (
    -- 用户可以删除自己的关联
    user_id = auth.uid()
    -- 或者管理员可以删除同一家庭中其他成员的关联
    OR is_admin_of_household(household_id)
  );

-- 第四步：验证策略已创建
SELECT 
    '✅ DELETE policy created' as status,
    tablename, 
    policyname, 
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
  AND cmd = 'DELETE';

-- 第五步：验证函数已创建
SELECT 
    '✅ Helper function created' as status,
    routine_name,
    security_type,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'is_admin_of_household';

