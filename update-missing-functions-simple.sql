-- 更新缺失的函数：check_household_has_admin 和 insert_household_invitation
-- 简化版本，分步执行以避免网络问题
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 步骤 1: 创建 check_space_has_admin() 函数
-- ============================================
CREATE OR REPLACE FUNCTION check_space_has_admin()
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

-- ============================================
-- 步骤 2: 更新 check_household_has_admin() 函数
-- ============================================
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

-- ============================================
-- 步骤 3: 更新触发器
-- ============================================
-- 注意：user_households 表已重命名为 user_spaces，所以只需要在 user_spaces 上操作
DROP TRIGGER IF EXISTS check_household_admin_trigger ON user_spaces;
DROP TRIGGER IF EXISTS check_space_admin_trigger ON user_spaces;

CREATE TRIGGER check_space_admin_trigger
  BEFORE UPDATE OR DELETE ON user_spaces
  FOR EACH ROW
  EXECUTE FUNCTION check_space_has_admin();

-- ============================================
-- 步骤 4: 创建 insert_space_invitation() 函数
-- ============================================
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

-- ============================================
-- 步骤 5: 创建 insert_household_invitation() 别名函数
-- ============================================
DROP FUNCTION IF EXISTS insert_household_invitation(UUID, UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS insert_household_invitation(UUID, UUID, TEXT, TEXT);

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
