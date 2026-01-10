-- ============================================
-- 创建 users 表的 RPC 函数
-- 使用 SECURITY DEFINER 绕过 RLS 限制
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：创建更新用户名字的函数
CREATE OR REPLACE FUNCTION update_user_name(p_user_id UUID, p_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证用户 ID 是否匹配
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only update own record';
  END IF;
  
  UPDATE users
  SET name = p_name
  WHERE id = p_user_id;
END;
$$;

-- 第二步：创建更新用户当前家庭的函数
CREATE OR REPLACE FUNCTION update_user_current_household(p_user_id UUID, p_household_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证用户 ID 是否匹配
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only update own record';
  END IF;
  
  -- 验证用户是否属于该家庭
  IF NOT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = p_user_id 
      AND household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this household';
  END IF;
  
  UPDATE users
  SET current_household_id = p_household_id
  WHERE id = p_user_id;
END;
$$;

-- 第三步：创建查询同家庭用户的函数
CREATE OR REPLACE FUNCTION get_household_member_users(p_household_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT,
  current_household_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 验证当前用户是否属于该家庭
  IF NOT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid() 
      AND household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this household';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.current_household_id,
    u.created_at
  FROM users u
  INNER JOIN user_households uh ON u.id = uh.user_id
  WHERE uh.household_id = p_household_id;
END;
$$;

-- 第四步：创建查询邀请者的函数
CREATE OR REPLACE FUNCTION get_inviter_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- 获取当前用户的 email（明确指定表别名）
  SELECT au.email INTO v_user_email
  FROM auth.users au
  WHERE au.id = auth.uid();
  
  IF v_user_email IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name
  FROM users u
  INNER JOIN household_invitations hi ON u.id = hi.inviter_id
  WHERE hi.invitee_email = v_user_email
    AND hi.status = 'pending'
    AND hi.expires_at > NOW();
END;
$$;

-- 第五步：确保这些函数的拥有者是 postgres（这样在默认 RLS 模式下可以绕过 users 表的 RLS）
-- 注意：这一步必须在 Supabase SQL Editor 中以 postgres 超级用户身份执行才会生效
ALTER FUNCTION update_user_name(UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION update_user_current_household(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION get_household_member_users(UUID) OWNER TO postgres;
ALTER FUNCTION get_inviter_users() OWNER TO postgres;

-- 第六步：授予函数执行权限
GRANT EXECUTE ON FUNCTION update_user_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_current_household(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_member_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_inviter_users() TO authenticated;

-- 第七步：验证函数已创建
SELECT 
    '✅ Functions created' as status,
    routine_name,
    security_type,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'update_user_name',
    'update_user_current_household',
    'get_household_member_users',
    'get_inviter_users'
  )
ORDER BY routine_name;

