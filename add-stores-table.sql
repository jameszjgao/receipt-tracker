-- 创建商家表（stores）
-- 用于存储商家信息，包括名称、税号、电话、地址等

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_number TEXT, -- 税号
  phone TEXT, -- 电话
  address TEXT, -- 地址
  is_ai_recognized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_stores_household_id ON stores(household_id);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(household_id, name);

-- 创建 updated_at 自动更新触发器
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能访问自己家庭的商家
CREATE POLICY "Users can manage stores in their household" ON stores
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());
