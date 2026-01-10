-- ============================================
-- 最终完整修复：解决所有问题
-- 1. 确保 get_user_household_id 函数已修复（已验证）
-- 2. 修复 RPC 函数的列名歧义
-- 3. 确保 INSERT 策略完全不查询 users 表
-- 4. 移除所有可能查询 users 的触发器
-- ============================================

-- 第一步：确认 get_user_household_id 函数已修复（已验证，但再次确保）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 第二步：移除所有可能查询 users 的触发器
DROP TRIGGER IF EXISTS validate_inviter_id_trigger ON household_invitations CASCADE;
DROP FUNCTION IF EXISTS validate_inviter_id() CASCADE;

-- 第三步：修复并创建 RPC 函数（解决列名歧义问题）
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
  
  -- 如果插入成功但没有返回值，抛出异常
  IF v_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create invitation: No ID returned';
  END IF;
  
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

-- 第四步：完全删除并重新创建 INSERT 策略（确保不查询 users 表）
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有现有的 household_invitations INSERT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
    END LOOP;
    
    -- 创建新的 INSERT 策略（完全不查询 users 表，也不使用任何可能查询 users 的函数）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 邀请者必须是当前用户（直接比较，不查询任何表）
        inviter_id = auth.uid()
        AND
        -- 用户必须是该家庭的管理员（只查询 user_households 表）
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE '✅ 重新创建了 INSERT 策略（完全不查询 users 表）';
END $$;

-- 第五步：验证所有修复
SELECT 
    '=== 验证修复结果 ===' as section,
    'get_user_household_id 函数' as check_type,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' THEN '❌ 仍然查询 users 表'
        ELSE '✅ 不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id'

UNION ALL

SELECT 
    '=== 验证修复结果 ===' as section,
    'INSERT 策略' as check_type,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用可能查询 users 的函数'
        ELSE '✅ 策略不查询 users 表'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'

UNION ALL

SELECT 
    '=== 验证修复结果 ===' as section,
    'RPC 函数' as check_type,
    CASE 
        WHEN routine_name = 'insert_household_invitation' THEN '✅ RPC 函数已创建'
        ELSE '❌ RPC 函数不存在'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'insert_household_invitation'

UNION ALL

SELECT 
    '=== 验证修复结果 ===' as section,
    '触发器' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 没有 INSERT 触发器'
        ELSE '⚠️  仍有 INSERT 触发器存在'
    END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations'
  AND event_manipulation = 'INSERT';

