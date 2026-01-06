-- ============================================
-- 创建用于创建家庭的 RPC 函数（绕过 RLS）
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 创建函数：创建家庭并关联用户（绕过 RLS）
CREATE OR REPLACE FUNCTION create_household_with_user(
  p_household_name TEXT,
  p_household_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- 从 auth.users 获取用户信息（如果 users 表记录不存在）
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  -- 如果 users 表记录不存在，尝试创建（使用 auth.users 的信息）
  INSERT INTO users (id, email, name, current_household_id)
  SELECT 
    p_user_id,
    COALESCE(v_user_email, ''),
    COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = p_user_id), split_part(COALESCE(v_user_email, ''), '@', 1), 'User'),
    NULL
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- 创建家庭
  INSERT INTO households (name, address)
  VALUES (p_household_name, p_household_address)
  RETURNING id INTO v_household_id;

  -- 更新用户的 current_household_id
  UPDATE users
  SET current_household_id = v_household_id
  WHERE id = p_user_id;

  -- 创建 user_households 关联记录
  INSERT INTO user_households (user_id, household_id, is_admin)
  VALUES (p_user_id, v_household_id, TRUE)
  ON CONFLICT (user_id, household_id) DO NOTHING;

  -- 返回家庭 ID
  RETURN v_household_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_with_user(TEXT, TEXT, UUID) TO authenticated;

-- 验证函数已创建
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_with_user';

