-- 更新数据库函数：household -> space, store -> supplier
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：此脚本会更新所有相关函数

-- ============================================
-- 1. 更新 get_user_household_id() -> get_user_space_id()
-- ============================================
CREATE OR REPLACE FUNCTION get_user_space_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT current_space_id FROM users WHERE id = auth.uid();
$$;

-- 保留旧函数作为别名（向后兼容，可选）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT get_user_space_id();
$$;

-- ============================================
-- 2. 更新 get_user_current_household_id() -> get_user_current_space_id()
-- ============================================
CREATE OR REPLACE FUNCTION get_user_current_space_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT current_space_id FROM users WHERE id = auth.uid();
$$;

-- 保留旧函数作为别名
CREATE OR REPLACE FUNCTION get_user_current_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT get_user_current_space_id();
$$;

-- ============================================
-- 3. 更新 get_user_household_ids() -> get_user_space_ids()
-- ============================================
CREATE OR REPLACE FUNCTION get_user_space_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ARRAY(
    SELECT space_id 
    FROM user_spaces 
    WHERE user_id = auth.uid()
  );
$$;

-- 保留旧函数作为别名
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT get_user_space_ids();
$$;

-- ============================================
-- 4. 更新 get_user_household_ids_for_rls() -> get_user_space_ids_for_rls()
-- ============================================
CREATE OR REPLACE FUNCTION get_user_space_ids_for_rls()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ARRAY(
    SELECT space_id 
    FROM user_spaces 
    WHERE user_id = auth.uid()
  );
$$;

-- 保留旧函数作为别名
CREATE OR REPLACE FUNCTION get_user_household_ids_for_rls()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT get_user_space_ids_for_rls();
$$;

-- ============================================
-- 5. 更新 create_household_with_user() -> create_space_with_user()
-- ============================================
-- 先删除旧函数（如果存在，可能有不同的参数签名）
DROP FUNCTION IF EXISTS create_household_with_user(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_household_with_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_household_with_user(TEXT);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_space_with_user(
  p_space_name TEXT,
  p_space_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_space_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- 从 auth.users 获取用户信息（如果 users 表记录不存在）
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  
  -- 如果 users 表记录不存在，尝试创建（使用 auth.users 的信息）
  INSERT INTO users (id, email, name, current_space_id)
  SELECT 
    p_user_id,
    COALESCE(v_user_email, ''),
    COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = p_user_id), split_part(COALESCE(v_user_email, ''), '@', 1), 'User'),
    NULL
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- 创建空间
  INSERT INTO spaces (name, address)
  VALUES (p_space_name, p_space_address)
  RETURNING id INTO v_space_id;

  -- 更新用户的 current_space_id
  UPDATE users
  SET current_space_id = v_space_id
  WHERE id = p_user_id;

  -- 创建 user_spaces 关联记录
  INSERT INTO user_spaces (user_id, space_id, is_admin)
  VALUES (p_user_id, v_space_id, TRUE)
  ON CONFLICT (user_id, space_id) DO NOTHING;

  -- 返回空间 ID
  RETURN v_space_id;
END;
$$;

-- 保留旧函数作为别名（先删除再创建，确保参数签名正确）
DROP FUNCTION IF EXISTS create_household_with_user(TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_household_with_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_household_with_user(TEXT);

CREATE OR REPLACE FUNCTION create_household_with_user(
  p_household_name TEXT,
  p_household_address TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_space_with_user(p_household_name, p_household_address, p_user_id);
END;
$$;

-- ============================================
-- 6. 更新 create_user_with_household() -> create_user_with_space()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_user_with_space(
  p_user_id UUID,
  p_email TEXT,
  p_space_name TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_space_id UUID;
  v_final_space_name TEXT;
BEGIN
  -- 生成空间名称
  IF p_space_name IS NULL OR p_space_name = '' THEN
    v_final_space_name := split_part(p_email, '@', 1) || '的空间';
  ELSE
    v_final_space_name := p_space_name;
  END IF;

  -- 创建空间
  INSERT INTO spaces (name)
  VALUES (v_final_space_name)
  RETURNING id INTO v_space_id;

  -- 创建用户记录（如果不存在）
  INSERT INTO users (id, email, name, current_space_id)
  VALUES (p_user_id, p_email, p_user_name, v_space_id)
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = p_email,
    name = COALESCE(p_user_name, users.name),
    current_space_id = COALESCE(users.current_space_id, v_space_id);

  -- 创建 user_spaces 关联记录
  INSERT INTO user_spaces (user_id, space_id, is_admin)
  VALUES (p_user_id, v_space_id, TRUE)
  ON CONFLICT (user_id, space_id) DO NOTHING;

  -- 返回空间 ID
  RETURN v_space_id;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_user_with_household(UUID, TEXT);

CREATE OR REPLACE FUNCTION create_user_with_household(
  p_user_id UUID,
  p_email TEXT,
  p_household_name TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_user_with_space(p_user_id, p_email, p_household_name, p_user_name);
END;
$$;

-- ============================================
-- 7. 更新 create_default_categories() 参数
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS create_default_categories(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_default_categories(p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO categories (space_id, name, color, is_default) VALUES
    (p_space_id, 'Groceries', '#FF6B6B', true),
    (p_space_id, 'Dining Out', '#4ECDC4', true),
    (p_space_id, 'Transportation', '#FFA07A', true),
    (p_space_id, 'Personal Care', '#FFD93D', true),
    (p_space_id, 'Health', '#F7DC6F', true),
    (p_space_id, 'Entertainment', '#E17055', true),
    (p_space_id, 'Education', '#BB8FCE', true),
    (p_space_id, 'Housing', '#45B7D1', true),
    (p_space_id, 'Utilities', '#74B9FF', true),
    (p_space_id, 'Clothing', '#FD79A8', true),
    (p_space_id, 'Subscriptions', '#55A3FF', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- 8. 更新 create_default_payment_accounts() 参数
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS create_default_payment_accounts(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_default_payment_accounts(p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO payment_accounts (space_id, name, is_ai_recognized) VALUES
    (p_space_id, 'Cash', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- 9. 更新 create_default_purposes() 参数
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS create_default_purposes(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_default_purposes(p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO purposes (space_id, name, color, is_default) VALUES
    (p_space_id, 'Home', '#00B894', true),
    (p_space_id, 'Gifts', '#E84393', true),
    (p_space_id, 'Business', '#FF9500', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- 10. 更新 get_household_member_users() -> get_space_member_users()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_household_member_users(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION get_space_member_users(p_space_id UUID)
RETURNS TABLE(id UUID, email TEXT, name TEXT, current_space_id UUID, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 验证当前用户是否属于该空间
  IF NOT EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid() 
      AND space_id = p_space_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this space';
  END IF;
  
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.current_space_id,
    u.created_at
  FROM users u
  INNER JOIN user_spaces us ON u.id = us.user_id
  WHERE us.space_id = p_space_id;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS get_household_member_users(UUID);

CREATE OR REPLACE FUNCTION get_household_member_users(p_household_id UUID)
RETURNS TABLE(id UUID, email TEXT, name TEXT, current_household_id UUID, created_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.email,
    r.name,
    r.current_space_id as current_household_id,
    r.created_at
  FROM get_space_member_users(p_household_id) r;
END;
$$;

-- ============================================
-- 11. 更新 get_household_members_with_last_signin() -> get_space_members_with_last_signin()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_household_members_with_last_signin(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION get_space_members_with_last_signin(p_space_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, last_sign_in_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.email AS email,
    au.last_sign_in_at AS last_sign_in_at
  FROM user_spaces us
  JOIN users u ON u.id = us.user_id
  LEFT JOIN auth.users au ON au.id = u.id
  WHERE us.space_id = p_space_id;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS get_household_members_with_last_signin(UUID);

CREATE OR REPLACE FUNCTION get_household_members_with_last_signin(p_household_id UUID)
RETURNS TABLE(user_id UUID, email TEXT, last_sign_in_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_space_members_with_last_signin(p_household_id);
END;
$$;

-- ============================================
-- 12. 更新 is_admin_of_household() -> is_admin_of_space()
-- ============================================
-- 注意：先创建新函数，然后再更新旧函数（因为 RLS 策略可能依赖旧函数）

-- 创建新函数
CREATE OR REPLACE FUNCTION is_admin_of_space(p_space_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid()
      AND space_id = p_space_id
      AND is_admin = TRUE
  );
END;
$$;

-- 更新旧函数（不删除，直接替换实现）
CREATE OR REPLACE FUNCTION is_admin_of_household(p_household_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN is_admin_of_space(p_household_id);
END;
$$;

-- ============================================
-- 13. 更新 is_household_admin() -> is_space_admin()
-- ============================================
-- 注意：先创建新函数，然后再更新旧函数（因为 RLS 策略可能依赖旧函数）

-- 创建新函数
CREATE OR REPLACE FUNCTION is_space_admin(p_space_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid()
      AND space_id = p_space_id
      AND is_admin = true
  );
$$;

-- 更新旧函数（不删除，直接替换实现）
CREATE OR REPLACE FUNCTION is_household_admin(p_household_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_space_admin(p_household_id);
$$;

-- ============================================
-- 14. 更新 is_user_household_admin() -> is_user_space_admin()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS is_user_household_admin(UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION is_user_space_admin(p_space_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid() 
      AND space_id = p_space_id 
      AND is_admin = TRUE
  );
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS is_user_household_admin(UUID);

CREATE OR REPLACE FUNCTION is_user_household_admin(p_household_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT is_user_space_admin(p_household_id);
$$;

-- ============================================
-- 15. 更新 user_belongs_to_household() -> user_belongs_to_space()
-- ============================================
-- 注意：先创建新函数，然后再更新旧函数（因为 RLS 策略可能依赖旧函数）

-- 创建新函数
CREATE OR REPLACE FUNCTION user_belongs_to_space(p_space_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid()
      AND space_id = p_space_id
  );
END;
$$;

-- 更新旧函数（不删除，直接替换实现）
CREATE OR REPLACE FUNCTION user_belongs_to_household(p_household_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN user_belongs_to_space(p_household_id);
END;
$$;

-- ============================================
-- 16. 更新 users_in_same_household() -> users_in_same_space()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS users_in_same_household(UUID, UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION users_in_same_space(p_current_user_id UUID, p_target_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_spaces us1
    INNER JOIN user_spaces us2 ON us1.space_id = us2.space_id
    WHERE us1.user_id = p_current_user_id
      AND us2.user_id = p_target_user_id
  );
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS users_in_same_household(UUID, UUID);

CREATE OR REPLACE FUNCTION users_in_same_household(p_current_user_id UUID, p_target_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT users_in_same_space(p_current_user_id, p_target_user_id);
$$;

-- ============================================
-- 17. 更新 remove_household_member() -> remove_space_member()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS remove_household_member(UUID, UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION remove_space_member(p_target_user_id UUID, p_space_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- 获取当前用户ID
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- 检查当前用户是否是管理员
  SELECT EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = v_current_user_id
      AND space_id = p_space_id
      AND is_admin = TRUE
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can remove members';
  END IF;
  
  -- 不允许删除自己（通过UI应该已经阻止，但在这里也做保护）
  IF v_current_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;
  
  -- 删除成员关联（绕过 RLS）
  DELETE FROM user_spaces
  WHERE user_id = p_target_user_id
    AND space_id = p_space_id;
  
  RETURN TRUE;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS remove_household_member(UUID, UUID);

CREATE OR REPLACE FUNCTION remove_household_member(p_target_user_id UUID, p_household_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN remove_space_member(p_target_user_id, p_household_id);
END;
$$;

-- ============================================
-- 18. 更新 update_user_current_household() -> update_user_current_space()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS update_user_current_household(UUID, UUID);

-- 创建新函数
CREATE OR REPLACE FUNCTION update_user_current_space(p_user_id UUID, p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 验证用户 ID 是否匹配
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only update own record';
  END IF;
  
  -- 验证用户是否属于该空间
  IF NOT EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = p_user_id 
      AND space_id = p_space_id
  ) THEN
    RAISE EXCEPTION 'User does not belong to this space';
  END IF;
  
  UPDATE users
  SET current_space_id = p_space_id
  WHERE id = p_user_id;
END;
$$;

-- 保留旧函数作为别名（不删除，直接替换实现）
CREATE OR REPLACE FUNCTION update_user_current_household(p_user_id UUID, p_household_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM update_user_current_space(p_user_id, p_household_id);
END;
$$;

-- ============================================
-- 19. 更新 create_space_invitation() 相关函数
-- ============================================
-- 先删除旧函数（如果存在，可能有不同的参数签名）
DROP FUNCTION IF EXISTS create_household_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_household_invitation(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_space_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_space_invitation(UUID, UUID, TEXT, TEXT);

-- 创建新函数
CREATE OR REPLACE FUNCTION create_space_invitation(
  p_space_id UUID,
  p_inviter_id UUID,
  p_inviter_email TEXT,
  p_invitee_email TEXT,
  p_space_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_invitation_id UUID;
  v_normalized_email TEXT := LOWER(TRIM(p_invitee_email));
  v_existing_id UUID;
  v_existing_status TEXT;
  v_final_space_name TEXT;
BEGIN
  -- 如果没有传入space_name，尝试从数据库获取
  IF p_space_name IS NULL OR p_space_name = '' THEN
    SELECT name INTO v_final_space_name
    FROM spaces
    WHERE id = p_space_id
    LIMIT 1;
  ELSE
    v_final_space_name := p_space_name;
  END IF;
  
  -- 如果仍然没有获取到，使用默认值
  IF v_final_space_name IS NULL OR v_final_space_name = '' THEN
    v_final_space_name := 'a space';
  END IF;

  -- 先检查是否已存在记录（基于space_id + normalized email）
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM space_invitations
  WHERE space_id = p_space_id
    AND LOWER(TRIM(invitee_email)) = v_normalized_email
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- 如果已存在，更新现有记录
    UPDATE space_invitations
    SET
      status = 'pending',
      inviter_id = p_inviter_id,
      inviter_email = p_inviter_email,
      space_name = v_final_space_name,
      created_at = NOW(),
      accepted_at = NULL
    WHERE id = v_existing_id
    RETURNING id INTO v_invitation_id;
  ELSE
    -- 如果不存在，创建新记录
    INSERT INTO space_invitations (
      space_id,
      inviter_id,
      inviter_email,
      invitee_email,
      space_name,
      status,
      created_at
    )
    VALUES (
      p_space_id,
      p_inviter_id,
      p_inviter_email,
      v_normalized_email,
      v_final_space_name,
      'pending',
      NOW()
    )
    RETURNING id INTO v_invitation_id;
  END IF;

  RETURN v_invitation_id;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS create_household_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_household_invitation(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_household_invitation(
  p_household_id UUID,
  p_inviter_id UUID,
  p_inviter_email TEXT,
  p_invitee_email TEXT,
  p_household_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_space_invitation(p_household_id, p_inviter_id, p_inviter_email, p_invitee_email, p_household_name);
END;
$$;

-- ============================================
-- 20. 更新 get_invitation_by_household_email() -> get_invitation_by_space_email()
-- ============================================
-- 先删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_invitation_by_household_email(UUID, TEXT);
DROP FUNCTION IF EXISTS get_invitation_by_space_email(UUID, TEXT);

-- 创建新函数
CREATE OR REPLACE FUNCTION get_invitation_by_space_email(p_space_id UUID, p_invitee_email TEXT)
RETURNS TABLE(id UUID, space_id UUID, inviter_id UUID, inviter_email TEXT, invitee_email TEXT, space_name TEXT, status TEXT, created_at TIMESTAMP WITH TIME ZONE, accepted_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_normalized_email TEXT := LOWER(TRIM(p_invitee_email));
BEGIN
  RETURN QUERY
  SELECT 
    hi.id,
    hi.space_id,
    hi.inviter_id,
    hi.inviter_email,
    hi.invitee_email,
    hi.space_name,
    hi.status,
    hi.created_at,
    hi.accepted_at
  FROM space_invitations hi
  WHERE hi.space_id = p_space_id
    AND LOWER(TRIM(hi.invitee_email)) = v_normalized_email
  ORDER BY hi.created_at DESC
  LIMIT 1;
END;
$$;

-- 保留旧函数作为别名（先删除再创建）
DROP FUNCTION IF EXISTS get_invitation_by_household_email(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_invitation_by_household_email(p_household_id UUID, p_invitee_email TEXT)
RETURNS TABLE(id UUID, household_id UUID, inviter_id UUID, inviter_email TEXT, invitee_email TEXT, household_name TEXT, status TEXT, created_at TIMESTAMP WITH TIME ZONE, accepted_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.space_id as household_id,
    r.inviter_id,
    r.inviter_email,
    r.invitee_email,
    r.space_name as household_name,
    r.status,
    r.created_at,
    r.accepted_at
  FROM get_invitation_by_space_email(p_household_id, p_invitee_email) r;
END;
$$;

-- ============================================
-- 验证函数更新
-- ============================================
SELECT '=== 函数更新验证 ===' as info;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name LIKE '%household%' OR routine_name LIKE '%store%' THEN 
            CASE 
                WHEN routine_name LIKE '%household%' AND routine_name NOT LIKE '%space%' THEN '❌ 需要更新（无别名）'
                WHEN routine_name LIKE '%store%' AND routine_name NOT LIKE '%supplier%' THEN '❌ 需要更新（无别名）'
                ELSE '⚠️ 已创建别名（建议使用新函数）'
            END
        ELSE '✅ 已更新'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_name LIKE '%household%' 
    OR routine_name LIKE '%store%'
    OR routine_name LIKE '%space%'
    OR routine_name LIKE '%supplier%'
)
ORDER BY routine_name;
