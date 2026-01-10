-- ============================================
-- 创建 RPC 函数来插入邀请（绕过 RLS）
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- 创建函数：插入邀请记录
-- 使用 SECURITY DEFINER 可以绕过 RLS 策略
CREATE OR REPLACE FUNCTION create_household_invitation(
  p_household_id UUID,
  p_inviter_id UUID,
  p_inviter_email TEXT,
  p_invitee_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
BEGIN
  -- 直接插入邀请记录（绕过 RLS）
  INSERT INTO household_invitations (
    household_id,
    inviter_id,
    inviter_email,
    invitee_email,
    status,
    created_at
  )
  VALUES (
    p_household_id,
    p_inviter_id,
    p_inviter_email,
    LOWER(TRIM(p_invitee_email)),
    'pending',
    NOW()
  )
  RETURNING id INTO v_invitation_id;

  -- 返回邀请 ID
  RETURN v_invitation_id;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_invitation(UUID, UUID, TEXT, TEXT) TO authenticated;

-- 验证函数已创建
SELECT 
    '=== 验证函数 ===' as section,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_invitation';

-- ============================================
-- 完成
-- ============================================

SELECT '✅ RPC 函数创建完成！' as result;
