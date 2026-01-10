-- ============================================
-- 创建 RPC 函数来更新邀请状态（绕过 RLS）
-- 用于管理员移除成员时更新邀请状态为 'removed'
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：确保 CHECK 约束包含 'removed' 状态
ALTER TABLE household_invitations
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE household_invitations
  ADD CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed'));

-- 第二步：创建 RPC 函数来更新邀请状态
CREATE OR REPLACE FUNCTION update_invitation_status(
  p_invitation_id UUID,
  p_new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- 验证状态值
  IF p_new_status NOT IN ('pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;
  
  -- 获取邀请记录的家庭ID
  SELECT household_id INTO v_household_id
  FROM household_invitations
  WHERE id = p_invitation_id;
  
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  -- 检查用户是否是该家庭的管理员
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = v_user_id 
      AND household_id = v_household_id 
      AND is_admin = TRUE
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can update invitation status';
  END IF;
  
  -- 更新邀请状态（绕过 RLS）
  UPDATE household_invitations
  SET status = p_new_status
  WHERE id = p_invitation_id;
  
  RETURN TRUE;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION update_invitation_status(UUID, TEXT) TO authenticated;

-- 第三步：创建批量更新邀请状态的 RPC 函数
CREATE OR REPLACE FUNCTION update_invitations_status_batch(
  p_invitation_ids UUID[],
  p_new_status TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id UUID;
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_count INTEGER;
BEGIN
  -- 获取当前用户ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- 验证状态值
  IF p_new_status NOT IN ('pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;
  
  IF array_length(p_invitation_ids, 1) = 0 THEN
    RETURN 0;
  END IF;
  
  -- 获取第一个邀请记录的家庭ID（假设所有邀请都属于同一个家庭）
  SELECT household_id INTO v_household_id
  FROM household_invitations
  WHERE id = ANY(p_invitation_ids)
  LIMIT 1;
  
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No invitations found';
  END IF;
  
  -- 检查用户是否是该家庭的管理员
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = v_user_id 
      AND household_id = v_household_id 
      AND is_admin = TRUE
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can update invitation status';
  END IF;
  
  -- 验证所有邀请都属于同一个家庭
  IF EXISTS (
    SELECT 1 
    FROM household_invitations
    WHERE id = ANY(p_invitation_ids)
      AND household_id != v_household_id
  ) THEN
    RAISE EXCEPTION 'All invitations must belong to the same household';
  END IF;
  
  -- 批量更新邀请状态（绕过 RLS）
  UPDATE household_invitations
  SET status = p_new_status
  WHERE id = ANY(p_invitation_ids);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION update_invitations_status_batch(UUID[], TEXT) TO authenticated;

-- 第四步：验证函数已创建
SELECT 
    '✅ Functions created' as status,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('update_invitation_status', 'update_invitations_status_batch')
ORDER BY routine_name;

-- 第五步：验证约束已更新
SELECT 
    '✅ Status constraint updated' as status,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND conname = 'valid_status';

