-- 创建数据库函数来获取家庭成员的最后登录时间
-- 在 Supabase SQL Editor 中执行此脚本

CREATE OR REPLACE FUNCTION get_household_members_with_last_signin(p_household_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.email AS email,
    au.last_sign_in_at AS last_sign_in_at
  FROM user_households uh
  JOIN users u ON u.id = uh.user_id
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE uh.household_id = p_household_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION get_household_members_with_last_signin(UUID) TO authenticated;

