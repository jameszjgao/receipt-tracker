-- ============================================
-- 最终解决方案：使用 SECURITY DEFINER 函数插入
-- 这是最可靠的方案，完全绕过 RLS 和外键约束问题
-- ============================================

-- 第一步：创建插入函数（使用 SECURITY DEFINER 完全绕过 RLS）
CREATE OR REPLACE FUNCTION insert_household_invitation(
  p_household_id UUID,
  p_invitee_email TEXT,
  p_token TEXT,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  inviter_id UUID,
  inviter_email TEXT,
  invitee_email TEXT,
  token TEXT,
  status TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_id UUID;
  v_inviter_email TEXT;
  v_is_admin BOOLEAN;
  v_result RECORD;
  v_invitation_id UUID;
  v_invitation_household_id UUID;
  v_invitation_inviter_id UUID;
  v_invitation_inviter_email TEXT;
  v_invitation_invitee_email TEXT;
  v_invitation_token TEXT;
  v_invitation_status TEXT;
  v_invitation_expires_at TIMESTAMP WITH TIME ZONE;
  v_invitation_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 获取当前用户ID
  v_inviter_id := auth.uid();
  
  IF v_inviter_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- 获取当前用户的 email（从 auth.users，不需要查询 public.users）
  SELECT email INTO v_inviter_email
  FROM auth.users
  WHERE id = v_inviter_id;
  
  IF v_inviter_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;
  
  -- 检查用户是否是管理员（使用 SECURITY DEFINER 函数绕过 RLS）
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_households.user_id = v_inviter_id 
      AND user_households.household_id = p_household_id 
      AND user_households.is_admin = TRUE
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can create invitations';
  END IF;
  
  -- 检查是否已有未过期的邀请
  IF EXISTS (
    SELECT 1 
    FROM household_invitations 
    WHERE household_invitations.household_id = p_household_id 
      AND household_invitations.invitee_email = LOWER(TRIM(p_invitee_email))
      AND household_invitations.status = 'pending'
      AND household_invitations.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'An invitation has already been sent to this email';
  END IF;
  
  -- 插入邀请（使用 SECURITY DEFINER，完全绕过 RLS）
  -- 使用明确的表别名避免列名歧义
  INSERT INTO household_invitations (
    household_id,
    inviter_id,
    inviter_email,
    invitee_email,
    token,
    status,
    expires_at
  ) VALUES (
    p_household_id,
    v_inviter_id,
    v_inviter_email,
    LOWER(TRIM(p_invitee_email)),
    p_token,
    'pending',
    p_expires_at
  )
  RETURNING 
    id,
    household_id,
    inviter_id,
    inviter_email,
    invitee_email,
    token,
    status,
    expires_at,
    created_at
  INTO 
    v_invitation_id,
    v_invitation_household_id,
    v_invitation_inviter_id,
    v_invitation_inviter_email,
    v_invitation_invitee_email,
    v_invitation_token,
    v_invitation_status,
    v_invitation_expires_at,
    v_invitation_created_at;
  
  -- 返回结果（使用明确的变量名避免歧义）
  RETURN QUERY SELECT 
    v_invitation_id,
    v_invitation_household_id,
    v_invitation_inviter_id,
    v_invitation_inviter_email,
    v_invitation_invitee_email,
    v_invitation_token,
    v_invitation_status,
    v_invitation_expires_at,
    v_invitation_created_at;
END;
$$;

-- 确保函数所有者是 postgres（完全绕过 RLS）
DO $$
BEGIN
  BEGIN
    ALTER FUNCTION insert_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) OWNER TO postgres;
    RAISE NOTICE 'Function owner changed to postgres';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not change function owner (this is OK): %', SQLERRM;
  END;
END $$;

-- 授予权限
GRANT EXECUTE ON FUNCTION insert_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 验证函数已创建
SELECT 
    '✅ 函数已创建' as status,
    routine_name,
    security_type,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'insert_household_invitation';

