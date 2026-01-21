-- 完整的商家功能数据库迁移脚本
-- 包括：创建商家表、合并历史表、在 receipts 表中添加 store_id 字段

-- ============================================
-- 第一部分：创建商家表（stores）
-- ============================================
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

-- ============================================
-- 第二部分：创建商家合并历史记录表
-- ============================================
CREATE TABLE IF NOT EXISTS store_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_store_name TEXT NOT NULL, -- 被合并的商家名称（原始名称）
  target_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_store_merge_history_household_id ON store_merge_history(household_id);
CREATE INDEX IF NOT EXISTS idx_store_merge_history_source_name ON store_merge_history(household_id, source_store_name);
CREATE INDEX IF NOT EXISTS idx_store_merge_history_target_id ON store_merge_history(target_store_id);

-- 启用 Row Level Security (RLS)
ALTER TABLE store_merge_history ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能访问自己家庭的合并历史
CREATE POLICY "Users can manage store merge history in their household" ON store_merge_history
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- 第三部分：在 receipts 表中添加 store_id 字段
-- ============================================
-- 添加 store_id 字段（允许为空，以便兼容现有数据）
ALTER TABLE receipts 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_receipts_store_id ON receipts(store_id);
