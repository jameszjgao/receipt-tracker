-- 多家庭支持迁移脚本
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 创建 user_households 中间表（用户-家庭多对多关系）
CREATE TABLE IF NOT EXISTS user_households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, household_id)
);

-- 2. 将 household_id 字段改为可空（支持多家庭系统，用户注册时可以不关联家庭）
ALTER TABLE users ALTER COLUMN household_id DROP NOT NULL;

-- 3. 在 users 表中添加 current_household_id 字段（当前活动的家庭）
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_household_id UUID REFERENCES households(id) ON DELETE SET NULL;

-- 4. 将现有的 household_id 数据迁移到 user_households 和 current_household_id
-- 为所有现有用户创建 user_households 记录
INSERT INTO user_households (user_id, household_id)
SELECT id, household_id FROM users WHERE household_id IS NOT NULL
ON CONFLICT (user_id, household_id) DO NOTHING;

-- 将 household_id 复制到 current_household_id
UPDATE users SET current_household_id = household_id WHERE current_household_id IS NULL AND household_id IS NOT NULL;

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_households_user_id ON user_households(user_id);
CREATE INDEX IF NOT EXISTS idx_user_households_household_id ON user_households(household_id);
CREATE INDEX IF NOT EXISTS idx_users_current_household_id ON users(current_household_id);

-- 6. 启用 RLS
ALTER TABLE user_households ENABLE ROW LEVEL SECURITY;

-- 7. 创建 RLS 策略
-- 用户可以查看自己的家庭关联
CREATE POLICY "Users can view their household associations" ON user_households
  FOR SELECT USING (user_id = auth.uid());

-- 用户可以插入自己的家庭关联（加入家庭）
CREATE POLICY "Users can insert their household associations" ON user_households
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 用户可以删除自己的家庭关联（离开家庭）
CREATE POLICY "Users can delete their household associations" ON user_households
  FOR DELETE USING (user_id = auth.uid());

-- 8. 创建函数：获取用户当前家庭ID（用于 RLS）
CREATE OR REPLACE FUNCTION get_user_current_household_id()
RETURNS UUID AS $$
  SELECT current_household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. 创建函数：获取用户所有家庭ID（用于 RLS）
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT household_id FROM user_households WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 注意：household_id 字段暂时保留以保持向后兼容
-- 在确认迁移成功后，可以考虑将其标记为废弃或删除

