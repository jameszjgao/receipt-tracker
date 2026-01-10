-- ============================================
-- 修复 get_inviter_users 函数
-- 解决 "column reference 'email' is ambiguous" 错误
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 重新创建 get_inviter_users 函数，修复 email 歧义问题
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
  -- 获取当前用户的 email（明确指定表别名 au，避免歧义）
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

-- 验证函数已修复
SELECT 
    '✅ Function fixed' as status,
    routine_name,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_inviter_users';

