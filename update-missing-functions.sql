-- 更新缺失的函数：check_household_has_admin 和 insert_household_invitation
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 1. 更新 check_household_has_admin() -> check_space_has_admin()
-- ============================================

-- 创建新函数
CREATE OR REPLACE FUNCTION check_space_has_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- 处理 DELETE 操作
  IF (TG_OP = 'DELETE') THEN
    -- 如果正在删除管理员，且还有其他成员，确保至少还有一个管理员
    IF (OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND user_id != OLD.user_id) > 0 THEN
        IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND is_admin = TRUE AND user_id != OLD.user_id) = 0 THEN
          RAISE EXCEPTION 'Cannot remove the last admin of a space';
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  -- 处理 UPDATE 操作
  IF (TG_OP = 'UPDATE') THEN
    -- 如果正在移除管理员权限，确保至少还有一个管理员
    IF (NEW.is_admin = FALSE AND OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = NEW.space_id AND is_admin = TRUE AND user_id != NEW.user_id) = 0 THEN
        RAISE EXCEPTION 'Cannot remove admin status: space must have at least one admin';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 保留旧函数作为别名（触发器函数需要完整逻辑，不能直接调用）
CREATE OR REPLACE FUNCTION check_household_has_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- 处理 DELETE 操作
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND user_id != OLD.user_id) > 0 THEN
        IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = OLD.space_id AND is_admin = TRUE AND user_id != OLD.user_id) = 0 THEN
          RAISE EXCEPTION 'Cannot remove the last admin of a space';
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  -- 处理 UPDATE 操作
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.is_admin = FALSE AND OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_spaces WHERE space_id = NEW.space_id AND is_admin = TRUE AND user_id != NEW.user_id) = 0 THEN
        RAISE EXCEPTION 'Cannot remove admin status: space must have at least one admin';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新触发器（如果存在）
-- 注意：PostgreSQL 不允许在同一表上创建同名触发器，所以先删除旧的
-- 注意：user_households 表已重命名为 user_spaces，所以只需要在 user_spaces 上操作
DROP TRIGGER IF EXISTS check_household_admin_trigger ON user_spaces;
DROP TRIGGER IF EXISTS check_space_admin_trigger ON user_spaces;

-- 创建新触发器
CREATE TRIGGER check_space_admin_trigger
  BEFORE UPDATE OR DELETE ON user_spaces
  FOR EACH ROW
  EXECUTE FUNCTION check_space_has_admin();

-- ============================================
-- 2. 更新 insert_household_invitation() -> insert_space_invitation()
-- ============================================
-- 注意：这个函数可能已经被 create_space_invitation() 替代
-- 但为了向后兼容，我们创建一个别名

-- 先删除旧函数（如果存在，可能有不同的参数签名）
DROP FUNCTION IF EXISTS insert_household_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS insert_household_invitation(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS insert_space_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS insert_space_invitation(UUID, UUID, TEXT, TEXT);

-- 创建新函数（作为 create_space_invitation 的别名）
CREATE OR REPLACE FUNCTION insert_space_invitation(
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
BEGIN
  RETURN create_space_invitation(p_space_id, p_inviter_id, p_inviter_email, p_invitee_email, p_space_name);
END;
$$;

-- 保留旧函数作为别名
CREATE OR REPLACE FUNCTION insert_household_invitation(
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
-- 验证函数更新
-- ============================================
SELECT '=== 缺失函数更新验证 ===' as info;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name IN ('check_space_has_admin', 'insert_space_invitation') THEN '✅ 新函数已创建'
        WHEN routine_name IN ('check_household_has_admin', 'insert_household_invitation') THEN '⚠️ 别名已创建'
        ELSE '✓ 正常'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'check_space_has_admin', 'check_household_has_admin',
    'insert_space_invitation', 'insert_household_invitation'
)
ORDER BY routine_name;
