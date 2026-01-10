-- ============================================
-- 修复创建邀请的 RPC 函数和 RLS 策略
-- 解决列名歧义和权限问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：修复 RPC 函数（解决列名歧义问题）
CREATE OR REPLACE FUNCTION create_household_invitation(
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
  
  -- 创建邀请（使用表别名避免列名歧义）
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
    household_invitations.id,
    household_invitations.household_id,
    household_invitations.inviter_id,
    household_invitations.inviter_email,
    household_invitations.invitee_email,
    household_invitations.token,
    household_invitations.status,
    household_invitations.expires_at,
    household_invitations.created_at
  INTO v_result;
  
  -- 返回结果
  RETURN QUERY SELECT 
    v_result.id,
    v_result.household_id,
    v_result.inviter_id,
    v_result.inviter_email,
    v_result.invitee_email,
    v_result.token,
    v_result.status,
    v_result.expires_at,
    v_result.created_at;
END;
$$;

-- 确保函数所有者是 postgres（完全绕过 RLS）
ALTER FUNCTION create_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) OWNER TO postgres;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 第二步：确保 household_invitations 表的 INSERT 策略允许直接插入（作为备选方案）
-- 如果 RPC 函数失败，直接插入需要这个策略
DO $$
BEGIN
  -- 检查是否存在 INSERT 策略
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'household_invitations' 
      AND cmd = 'INSERT'
  ) THEN
    -- 如果不存在，创建一个（使用 SECURITY DEFINER 函数检查权限）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      WITH CHECK (
        inviter_id = auth.uid()
        AND EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE 'Created household_invitations INSERT policy';
  ELSE
    RAISE NOTICE 'household_invitations INSERT policy already exists';
  END IF;
END $$;

-- 第三步：验证函数已创建
SELECT 
    '✅ Function created' as status,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_invitation';

-- 第四步：验证策略
SELECT 
    '✅ Policies' as status,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

