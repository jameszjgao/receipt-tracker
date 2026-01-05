-- 添加家庭管理员支持
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 在 user_households 表中添加 is_admin 字段
ALTER TABLE user_households 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. 将创建家庭的用户设置为管理员（现有数据迁移）
-- 对于每个家庭，将最早加入的用户（created_at 最早的）设置为管理员
UPDATE user_households uh1
SET is_admin = TRUE
WHERE uh1.id IN (
  SELECT DISTINCT ON (household_id) id
  FROM user_households
  WHERE is_admin = FALSE OR is_admin IS NULL
  ORDER BY household_id, created_at ASC
);

-- 3. 如果某个家庭还没有管理员，将第一个成员设置为管理员
-- 注意：这个查询对每个家庭分别处理，而不是只处理一个
DO $$
DECLARE
  h_id UUID;
  first_member_id UUID;
BEGIN
  FOR h_id IN SELECT DISTINCT household_id FROM user_households LOOP
    -- 检查该家庭是否已有管理员
    IF NOT EXISTS (SELECT 1 FROM user_households WHERE household_id = h_id AND is_admin = TRUE) THEN
      -- 获取该家庭的第一个成员（created_at 最早的）
      SELECT id INTO first_member_id
      FROM user_households
      WHERE household_id = h_id
      ORDER BY created_at ASC
      LIMIT 1;
      
      -- 将该成员设置为管理员
      IF first_member_id IS NOT NULL THEN
        UPDATE user_households
        SET is_admin = TRUE
        WHERE id = first_member_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 4. 确保每个家庭至少有一个管理员（约束检查，通过触发器实现）
CREATE OR REPLACE FUNCTION check_household_has_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- 处理 DELETE 操作
  IF (TG_OP = 'DELETE') THEN
    -- 如果正在删除管理员，且还有其他成员，确保至少还有一个管理员
    IF (OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_households WHERE household_id = OLD.household_id AND user_id != OLD.user_id) > 0 THEN
        IF (SELECT COUNT(*) FROM user_households WHERE household_id = OLD.household_id AND is_admin = TRUE AND user_id != OLD.user_id) = 0 THEN
          RAISE EXCEPTION 'Cannot remove the last admin of a household';
        END IF;
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  
  -- 处理 UPDATE 操作
  IF (TG_OP = 'UPDATE') THEN
    -- 如果正在移除管理员权限，确保至少还有一个管理员
    IF (NEW.is_admin = FALSE AND OLD.is_admin = TRUE) THEN
      IF (SELECT COUNT(*) FROM user_households WHERE household_id = NEW.household_id AND is_admin = TRUE AND user_id != NEW.user_id) = 0 THEN
        RAISE EXCEPTION 'Cannot remove admin status: household must have at least one admin';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_household_admin_trigger ON user_households;
CREATE TRIGGER check_household_admin_trigger
  BEFORE UPDATE OR DELETE ON user_households
  FOR EACH ROW
  EXECUTE FUNCTION check_household_has_admin();

