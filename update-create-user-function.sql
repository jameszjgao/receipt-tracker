-- 更新 create_user_with_household 函数以支持多家庭系统
-- 在 Supabase SQL Editor 中执行此脚本

-- 更新函数：为新用户创建家庭和用户记录，同时创建 user_households 关联和设置 current_household_id
CREATE OR REPLACE FUNCTION create_user_with_household(
  p_user_id UUID,
  p_email TEXT,
  p_household_name TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_final_household_name TEXT;
  v_final_user_name TEXT;
BEGIN
  -- 生成家庭名称
  IF p_household_name IS NULL OR p_household_name = '' THEN
    v_final_household_name := split_part(p_email, '@', 1) || '的家庭';
  ELSE
    v_final_household_name := p_household_name;
  END IF;

  -- 生成用户名称
  IF p_user_name IS NULL OR p_user_name = '' THEN
    v_final_user_name := split_part(p_email, '@', 1);
  ELSE
    v_final_user_name := p_user_name;
  END IF;

  -- 创建家庭
  INSERT INTO households (name)
  VALUES (v_final_household_name)
  RETURNING id INTO v_household_id;

  -- 创建用户记录（如果不存在）
  -- 使用 ON CONFLICT 来处理用户记录已存在的情况
  INSERT INTO users (id, email, household_id, current_household_id, name)
  VALUES (p_user_id, p_email, v_household_id, v_household_id, v_final_user_name)
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = p_email,
    name = COALESCE(users.name, EXCLUDED.name),
    household_id = COALESCE(users.household_id, EXCLUDED.household_id),
    current_household_id = COALESCE(users.current_household_id, EXCLUDED.current_household_id);

  -- 创建 user_households 关联记录（如果不存在）
  INSERT INTO user_households (user_id, household_id, is_admin)
  VALUES (p_user_id, v_household_id, TRUE)
  ON CONFLICT (user_id, household_id) DO NOTHING;

  -- 返回家庭 ID
  RETURN v_household_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_user_with_household(UUID, TEXT, TEXT, TEXT) TO authenticated;

