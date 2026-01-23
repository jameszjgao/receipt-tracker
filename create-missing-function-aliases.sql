-- 为缺少别名的旧函数创建别名
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：此脚本为所有旧函数创建别名，调用对应的新函数

-- ============================================
-- 1. check_household_has_admin -> check_space_has_admin
-- ============================================
-- 注意：这是一个触发器函数，不能简单地调用另一个触发器函数
-- 需要保持完整的触发器逻辑，但使用新的表名
-- 这个函数已经在 update-missing-functions-simple.sql 中更新了
-- 这里只需要确保它存在
-- 如果不存在，则创建别名（但触发器函数不能有别名，所以需要完整实现）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_household_has_admin'
  ) THEN
    -- 如果函数不存在，创建它（使用新表名）
    EXECUTE 'CREATE OR REPLACE FUNCTION check_household_has_admin()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      -- 处理 DELETE 操作
      IF (TG_OP = ''DELETE'') THEN
        IF (OLD.is_admin = TRUE) THEN
          IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND user_id != OLD.user_id) > 0 THEN
            IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND is_admin = TRUE AND user_id != OLD.user_id) = 0 THEN
              RAISE EXCEPTION ''Cannot remove the last admin of a space'';
            END IF;
          END IF;
        END IF;
        RETURN OLD;
      END IF;
      
      -- 处理 UPDATE 操作
      IF (TG_OP = ''UPDATE'') THEN
        IF (NEW.is_admin = FALSE AND OLD.is_admin = TRUE) THEN
          IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = NEW.space_id AND is_admin = TRUE AND user_id != NEW.user_id) = 0 THEN
            RAISE EXCEPTION ''Cannot remove admin status: space must have at least one admin'';
          END IF;
        END IF;
        RETURN NEW;
      END IF;
      
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;';
  END IF;
END $$;

-- ============================================
-- 2. create_household_with_user -> create_space_with_user
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
-- 3. get_household_member_users -> get_space_member_users
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
-- 4. get_household_members_with_last_signin -> get_space_members_with_last_signin
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
-- 5. insert_household_invitation -> insert_space_invitation
-- ============================================
-- 注意：这是一个触发器函数，不能简单地调用另一个触发器函数
-- 需要保持完整的触发器逻辑
-- 这个函数已经在 update-missing-functions-simple.sql 中更新了
-- 这里只需要确保它存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'insert_household_invitation'
    AND pg_get_function_arguments(p.oid) LIKE '%UUID%'
  ) THEN
    -- 如果函数不存在，创建它（作为 create_space_invitation 的别名）
    EXECUTE 'CREATE OR REPLACE FUNCTION insert_household_invitation(
      p_household_id UUID,
      p_inviter_id UUID,
      p_inviter_email TEXT,
      p_invitee_email TEXT,
      p_household_name TEXT DEFAULT NULL
    )
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''public''
    AS $func$
    BEGIN
      RETURN create_space_invitation(p_household_id, p_inviter_id, p_inviter_email, p_invitee_email, p_household_name);
    END;
    $func$;';
  END IF;
END $$;

-- ============================================
-- 6. is_admin_of_household -> is_admin_of_space
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
-- 7. is_user_household_admin -> is_user_space_admin
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
-- 8. remove_household_member -> remove_space_member
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
  PERFORM remove_space_member(p_household_id, p_user_id);
END;
$$;

-- ============================================
-- 9. update_user_current_household -> update_user_current_space
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
-- 10. user_belongs_to_household -> user_belongs_to_space
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
-- 11. users_in_same_household -> users_in_same_space
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
