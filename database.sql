-- 家庭记账软件数据库表结构 (SaaS 多用户架构)
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建 households 表（家庭账户）
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 users 表（用户表，使用 Supabase Auth）
-- 注意：实际用户认证由 Supabase Auth 管理，此表存储额外信息
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 categories 表（消费分类，每个家庭独立）
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- 创建 payment_accounts 表（支付账户，每个家庭独立）
CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_ai_recognized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(household_id, name)
);

-- 创建 receipts 表（添加 household_id）
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'confirmed'
  image_url TEXT,
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  processed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 receipt_items 表（添加 category_id 引用）
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL, -- 'Personnel', 'Business'
  price DECIMAL(10, 2) NOT NULL,
  is_asset BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_household_id ON users(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_household_id ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_household_id ON payment_accounts(household_id);
CREATE INDEX IF NOT EXISTS idx_receipts_household_id ON receipts(household_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_category_id ON receipt_items(category_id);

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_accounts_updated_at BEFORE UPDATE ON payment_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能访问自己家庭的数据
-- 获取用户家庭ID的函数
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Households 策略
CREATE POLICY "Users can view their household" ON households
  FOR SELECT USING (id = get_user_household_id());

-- Users 策略
CREATE POLICY "Users can view users in their household" ON users
  FOR SELECT USING (household_id = get_user_household_id());

-- Categories 策略
CREATE POLICY "Users can manage categories in their household" ON categories
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- Payment Accounts 策略
CREATE POLICY "Users can manage payment accounts in their household" ON payment_accounts
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- Receipts 策略
CREATE POLICY "Users can manage receipts in their household" ON receipts
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- Receipt Items 策略
CREATE POLICY "Users can manage receipt items in their household" ON receipt_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  );

-- 创建默认分类的函数（新家庭创建时调用）
CREATE OR REPLACE FUNCTION create_default_categories(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (household_id, name, color, is_default) VALUES
    (p_household_id, '食品', '#FF6B6B', true),
    (p_household_id, '外餐', '#4ECDC4', true),
    (p_household_id, '居家', '#45B7D1', true),
    (p_household_id, '交通', '#FFA07A', true),
    (p_household_id, '购物', '#98D8C8', true),
    (p_household_id, '医疗', '#F7DC6F', true),
    (p_household_id, '教育', '#BB8FCE', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 创建默认支付账户的函数（新家庭创建时调用，AI识别的账户）
CREATE OR REPLACE FUNCTION create_default_payment_accounts(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO payment_accounts (household_id, name, is_ai_recognized) VALUES
    (p_household_id, 'Cash', true),
    (p_household_id, 'Credit Card', true),
    (p_household_id, 'Debit Card', true),
    (p_household_id, 'Alipay', true),
    (p_household_id, 'WeChat Pay', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 创建 Storage Bucket（需要在 Supabase Dashboard 中手动创建，或使用以下 SQL）
-- 注意：Storage 的创建通常需要在 Dashboard 中完成
-- 1. 进入 Supabase Dashboard > Storage
-- 2. 创建新 Bucket，命名为 'receipts'
-- 3. 设置为 Public 或配置适当的访问策略

