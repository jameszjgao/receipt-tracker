-- ============================================
-- 修复 household_invitations 表的 INSERT 权限问题
-- 确保 INSERT 策略不查询 users 表，同时确保外键约束检查可以通过
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：确保 users 表的 SELECT 策略允许用户查看自己的记录
-- 这是外键约束检查所必需的
-- 注意：外键约束检查在 PostgreSQL 中通常绕过 RLS，但为了安全起见，我们确保策略正确
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有现有的 users SELECT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
    END LOOP;
    
    -- 创建简单的 SELECT 策略：允许用户查看自己的记录（外键约束检查需要）
    -- 这允许外键约束检查时访问 users 表
    CREATE POLICY "users_select_own" ON users
      FOR SELECT 
      TO authenticated
      USING (id = auth.uid());
    
    -- 注意：外键约束检查可能需要访问被引用表中的任何行，不仅仅是当前用户的记录
    -- 但在我们的情况下，inviter_id 总是等于 auth.uid()，所以这个策略应该足够
    
    RAISE NOTICE 'Created users SELECT policy for own record';
END $$;

-- 第二步：删除所有现有的 household_invitations INSERT 策略
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
    
    RAISE NOTICE 'Dropped all household_invitations INSERT policies';
END $$;

-- 第三步：创建新的 INSERT 策略（完全不查询 users 表）
-- 只查询 user_households 表来验证用户是否是管理员
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员（只查询 user_households 表，不查询 users 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  );

-- 第四步：验证策略已创建
SELECT 
    '✅ household_invitations INSERT policy' as status,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查策略内容'
    END as policy_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第五步：验证 users 表的 SELECT 策略
SELECT 
    '✅ users SELECT policy' as status,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT';

-- 第六步：确保外键约束检查可以通过
-- 外键约束检查需要访问 users 表，所以我们需要确保 users 表的 SELECT 策略允许访问
-- 但是，外键约束检查通常绕过 RLS，所以这可能不是问题
-- 为了安全起见，我们确保 users 表有正确的策略

-- 第七步：创建或更新 RPC 函数来插入邀请（使用 SECURITY DEFINER 绕过 RLS）
-- 这是最可靠的解决方案，因为 RPC 函数可以绕过 RLS 策略
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
  
  -- 创建邀请（使用明确的变量名避免列名歧义）
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
-- 注意：在 Supabase 中，可能需要使用 service_role 密钥来执行此操作
-- 如果无法更改所有者，函数仍然可以工作，因为 SECURITY DEFINER 已经设置了
DO $$
BEGIN
  -- 尝试更改函数所有者，如果失败则忽略
  BEGIN
    ALTER FUNCTION create_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) OWNER TO postgres;
    RAISE NOTICE 'Function owner changed to postgres';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not change function owner (this is OK if not superuser): %', SQLERRM;
  END;
END $$;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_household_invitation(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 确保外键约束检查可以通过
-- 外键约束检查在 PostgreSQL 中应该绕过 RLS，但为了安全起见，我们确保 users 表有正确的策略
-- 注意：外键约束检查通常不需要通过 RLS，但某些情况下可能需要

-- 第八步：显示完整的策略定义（用于调试）
SELECT 
    '策略定义' as info,
    tablename,
    policyname,
    cmd,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND (tablename = 'household_invitations' OR tablename = 'users')
  AND (cmd = 'INSERT' OR cmd = 'SELECT')
ORDER BY tablename, cmd;

-- 第九步：验证 RPC 函数已创建
SELECT 
    '✅ RPC Function created' as status,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_invitation';

