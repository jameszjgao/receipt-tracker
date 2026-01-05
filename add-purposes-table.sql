-- 创建 purposes 表（商品用途，每个家庭独立）
CREATE TABLE IF NOT EXISTS purposes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_purposes_household_id ON purposes(household_id);

-- 为现有家庭创建默认用途
INSERT INTO purposes (household_id, name, color, is_default)
SELECT 
  h.id,
  'Personnel',
  '#00B894',
  TRUE
FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM purposes p WHERE p.household_id = h.id AND p.name = 'Personnel'
);

INSERT INTO purposes (household_id, name, color, is_default)
SELECT 
  h.id,
  'Business',
  '#FF9500',
  TRUE
FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM purposes p WHERE p.household_id = h.id AND p.name = 'Business'
);

-- 创建 updated_at 自动更新触发器（如果还没有创建）
CREATE TRIGGER IF NOT EXISTS update_purposes_updated_at
  BEFORE UPDATE ON purposes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE purposes ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能管理自己家庭的用途
-- 注意：get_user_household_id() 函数应该在 database.sql 中已经创建
-- 如果不存在，需要先创建：
-- CREATE OR REPLACE FUNCTION get_user_household_id()
-- RETURNS UUID AS $$
--   SELECT household_id FROM users WHERE id = auth.uid();
-- $$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can manage purposes in their household" ON purposes
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

