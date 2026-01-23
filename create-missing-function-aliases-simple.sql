-- 为缺少别名的旧函数创建别名（简化版）
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：确保只复制此 SQL 文件的内容，不要包含任何 TypeScript 代码

-- ============================================
-- 1. create_household_with_user -> create_space_with_user
-- ============================================
DROP FUNCTION IF EXISTS create_household_with_user(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_household_with_user(UUID, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION create_household_with_user(
  p_user_id UUID,
  p_household_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_space_with_user(p_user_id, p_household_name);
END;
$$;

-- ============================================
-- 2. get_household_member_users -> get_space_member_users
-- ============================================
DROP FUNCTION IF EXISTS get_household_member_users(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_household_member_users(p_household_id UUID)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  name TEXT,
  is_admin BOOLEAN,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_space_member_users(p_household_id);
END;
$$;

-- ============================================
-- 3. get_household_members_with_last_signin -> get_space_members_with_last_signin
-- ============================================
DROP FUNCTION IF EXISTS get_household_members_with_last_signin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_household_members_with_last_signin(p_household_id UUID)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  name TEXT,
  is_admin BOOLEAN,
  joined_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_space_members_with_last_signin(p_household_id);
END;
$$;

-- ============================================
-- 4. is_admin_of_household -> is_admin_of_space
-- ============================================
DROP FUNCTION IF EXISTS is_admin_of_household(UUID) CASCADE;

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
-- 5. is_user_household_admin -> is_user_space_admin
-- ============================================
DROP FUNCTION IF EXISTS is_user_household_admin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION is_user_household_admin(p_household_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN is_user_space_admin(p_household_id);
END;
$$;

-- ============================================
-- 6. remove_household_member -> remove_space_member
-- ============================================
DROP FUNCTION IF EXISTS remove_household_member(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION remove_household_member(
  p_household_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM remove_space_member(p_user_id, p_household_id);
END;
$$;

-- ============================================
-- 7. update_user_current_household -> update_user_current_space
-- ============================================
DROP FUNCTION IF EXISTS update_user_current_household(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION update_user_current_household(
  p_user_id UUID,
  p_household_id UUID
)
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
-- 8. user_belongs_to_household -> user_belongs_to_space
-- ============================================
DROP FUNCTION IF EXISTS user_belongs_to_household(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION user_belongs_to_household(
  p_user_id UUID,
  p_household_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN user_belongs_to_space(p_user_id, p_household_id);
END;
$$;

-- ============================================
-- 9. users_in_same_household -> users_in_same_space
-- ============================================
DROP FUNCTION IF EXISTS users_in_same_household(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION users_in_same_household(
  p_user_id_1 UUID,
  p_user_id_2 UUID
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN users_in_same_space(p_user_id_1, p_user_id_2);
END;
$$;

-- ============================================
-- 验证别名创建
-- ============================================
SELECT '=== 函数别名创建验证 ===' as info;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name LIKE '%household%' OR routine_name LIKE '%store%' THEN 
            CASE 
                WHEN routine_name LIKE '%household%' AND routine_name NOT LIKE '%space%' THEN 
                    CASE 
                        WHEN routine_name IN (
                            'check_household_has_admin',
                            'create_household_with_user',
                            'get_household_member_users',
                            'get_household_members_with_last_signin',
                            'insert_household_invitation',
                            'is_admin_of_household',
                            'is_user_household_admin',
                            'remove_household_member',
                            'update_user_current_household',
                            'user_belongs_to_household',
                            'users_in_same_household',
                            'get_user_household_id',
                            'get_user_household_ids',
                            'get_user_household_ids_for_rls',
                            'get_user_current_household_id',
                            'create_user_with_household',
                            'create_household_invitation',
                            'get_invitation_by_household_email',
                            'is_household_admin'
                        ) THEN '⚠️ 已创建别名（向后兼容）'
                        ELSE '❌ 需要更新（无别名）'
                    END
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
