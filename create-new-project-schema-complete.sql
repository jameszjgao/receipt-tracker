-- ============================================
-- Snap Receipt 完整数据库重置脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- 警告：此脚本会删除所有现有数据和策略，请谨慎使用
-- ============================================

-- ============================================
-- 第一步：删除所有现有的 RLS 策略
-- ============================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有表的策略
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============================================
-- 第二步：删除所有现有的表（如果需要完全重置）
-- 注意：如果只想重置策略，可以注释掉这部分
-- ============================================
-- 删除表（按依赖顺序）
DROP TABLE IF EXISTS receipt_items CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS payment_account_merge_history CASCADE;
DROP TABLE IF EXISTS space_invitations CASCADE;
DROP TABLE IF EXISTS user_spaces CASCADE;
DROP TABLE IF EXISTS purposes CASCADE;
DROP TABLE IF EXISTS payment_accounts CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;

-- ============================================
-- 第三步：创建所有表结构
-- ============================================

-- 创建 spaces 表（家庭账户）
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 users 表（用户表，使用 Supabase Auth）
-- 注意：space_id 和 current_space_id 可以为 NULL（支持两步注册）
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL, -- 可空，向后兼容
  current_space_id UUID REFERENCES spaces(id) ON DELETE SET NULL, -- 当前活动的家庭
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 user_spaces 表（用户-家庭多对多关系）
CREATE TABLE user_spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, space_id)
);

-- 创建 categories 表（消费分类，每个家庭独立）
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 payment_accounts 表（支付账户，每个家庭独立）
CREATE TABLE payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_ai_recognized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 purposes 表（商品用途，每个家庭独立）
CREATE TABLE purposes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 receipts 表
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT,
  tax DECIMAL(10, 2),
  date DATE NOT NULL,
  payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'confirmed', 'duplicate'
  image_url TEXT,
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  processed_by TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 receipt_items 表
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  purpose_id UUID REFERENCES purposes(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_asset BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 space_invitations 表（家庭邀请）
CREATE TABLE space_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- 创建 payment_account_merge_history 表（支付账户合并历史）
-- 用于记录用户手动合并的账户，以便后续AI识别时自动归并
CREATE TABLE payment_account_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_account_name TEXT NOT NULL, -- 被合并的账户名称（原始名称）
  target_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 第四步：创建索引以提高查询性能
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_household_id ON users(space_id);
CREATE INDEX IF NOT EXISTS idx_users_current_household_id ON users(current_space_id);
CREATE INDEX IF NOT EXISTS idx_user_spaces_user_id ON user_spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_spaces_household_id ON user_spaces(space_id);
CREATE INDEX IF NOT EXISTS idx_categories_household_id ON categories(space_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_household_id ON payment_accounts(space_id);
CREATE INDEX IF NOT EXISTS idx_purposes_household_id ON purposes(space_id);
CREATE INDEX IF NOT EXISTS idx_receipts_household_id ON receipts(space_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_category_id ON receipt_items(category_id);
CREATE INDEX IF NOT EXISTS idx_space_invitations_token ON space_invitations(token);
CREATE INDEX IF NOT EXISTS idx_space_invitations_email ON space_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_space_invitations_household_id ON space_invitations(space_id);
CREATE INDEX IF NOT EXISTS idx_space_invitations_status ON space_invitations(status);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_household_id ON payment_account_merge_history(space_id);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_source_name ON payment_account_merge_history(space_id, source_account_name);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_target_id ON payment_account_merge_history(target_account_id);

-- ============================================
-- 第五步：创建辅助函数
-- ============================================

-- 创建 updated_at 自动更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_accounts_updated_at BEFORE UPDATE ON payment_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purposes_updated_at BEFORE UPDATE ON purposes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数：获取用户当前家庭ID（用于 RLS）
CREATE OR REPLACE FUNCTION get_user_space_id()
RETURNS UUID AS $$
  SELECT current_space_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 创建函数：检查两个用户是否在同一家庭
CREATE OR REPLACE FUNCTION users_in_same_space(p_current_user_id UUID, p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_spaces uh1
    INNER JOIN user_spaces uh2 ON uh1.space_id = uh2.space_id
    WHERE uh1.user_id = p_current_user_id
      AND uh2.user_id = p_target_user_id
  );
$$;

-- 创建函数：为新用户创建家庭和用户记录（绕过 RLS）
CREATE OR REPLACE FUNCTION create_user_with_space(
  p_user_id UUID,
  p_email TEXT,
  p_space_name TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
  v_final_space_name TEXT;
BEGIN
  -- 生成家庭名称
  IF p_space_name IS NULL OR p_space_name = '' THEN
    v_final_space_name := split_part(p_email, '@', 1) || '的空间';
  ELSE
    v_final_space_name := p_space_name;
  END IF;

  -- 创建家庭
  INSERT INTO spaces (name)
  VALUES (v_final_space_name)
  RETURNING id INTO v_space_id;

  -- 创建用户记录（如果不存在）
  INSERT INTO users (id, email, name, space_id, current_space_id)
  VALUES (p_user_id, p_email, p_user_name, v_space_id, v_space_id)
  ON CONFLICT (id) 
  DO UPDATE SET 
    email = p_email,
    name = COALESCE(p_user_name, users.name),
    space_id = v_space_id,
    current_space_id = COALESCE(users.current_space_id, v_space_id);

  -- 创建 user_spaces 关联记录
  INSERT INTO user_spaces (user_id, space_id, is_admin)
  VALUES (p_user_id, v_space_id, TRUE)
  ON CONFLICT (user_id, space_id) DO NOTHING;

  -- 返回家庭 ID
  RETURN v_space_id;
END;
$$;

-- 创建默认分类的函数
CREATE OR REPLACE FUNCTION create_default_categories(p_space_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (space_id, name, color, is_default) VALUES
    (p_space_id, 'Groceries', '#FF6B6B', true),
    (p_space_id, 'Dining Out', '#4ECDC4', true),
    (p_space_id, 'Transportation', '#FFA07A', true),
    (p_space_id, 'Personal Care', '#FFD93D', true),
    (p_space_id, 'Health', '#F7DC6F', true),
    (p_space_id, 'Entertainment', '#E17055', true),
    (p_space_id, 'Education', '#BB8FCE', true),
    (p_space_id, 'Housing', '#45B7D1', true),
    (p_space_id, 'Utilities', '#74B9FF', true),
    (p_space_id, 'Clothing', '#FD79A8', true),
    (p_space_id, 'Subscriptions', '#55A3FF', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 创建默认支付账户的函数（只创建 Cash）
CREATE OR REPLACE FUNCTION create_default_payment_accounts(p_space_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO payment_accounts (space_id, name, is_ai_recognized) VALUES
    (p_space_id, 'Cash', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 创建默认用途的函数
CREATE OR REPLACE FUNCTION create_default_purposes(p_space_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO purposes (space_id, name, color, is_default) VALUES
    (p_space_id, 'Home', '#00B894', true),
    (p_space_id, 'Gifts', '#E84393', true),
    (p_space_id, 'Business', '#FF9500', true)
  ON CONFLICT (space_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：自动过期邀请
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE space_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 第六步：授予函数执行权限
-- ============================================
GRANT EXECUTE ON FUNCTION create_user_with_space(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_categories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_payment_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_purposes(UUID) TO authenticated;

-- ============================================
-- 第七步：启用 Row Level Security (RLS)
-- ============================================
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_account_merge_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 第八步：创建 RLS 策略
-- ============================================

-- ============================================
-- Households 策略
-- ============================================
-- 查看：用户只能查看自己所属的家庭
CREATE POLICY "spaces_select_policy" ON spaces
  FOR SELECT 
  USING (
    id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- 插入：允许任何已认证用户创建家庭（注册时需要）
-- 重要：新用户还没有 space_id，所以必须允许所有已认证用户创建
CREATE POLICY "spaces_insert_policy" ON spaces
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- 更新：用户只能更新自己所属的家庭
CREATE POLICY "spaces_update_policy" ON spaces
  FOR UPDATE 
  USING (
    id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Users 策略（关键：必须允许新用户插入自己的记录）
-- ============================================
-- 查看：用户可以查看同一家庭中所有成员的信息，或者自己的信息
CREATE POLICY "users_select_policy" ON users
  FOR SELECT 
  USING (
    -- 用户可以查看自己的记录
    id = auth.uid()
    OR
    -- 或者用户可以查看同一家庭中其他成员的记录
    users_in_same_space(auth.uid(), users.id)
  );

-- 插入：允许用户创建自己的记录（注册时需要）
-- 关键：必须确保 id = auth.uid()，防止用户创建其他用户的记录
-- 允许 space_id 和 current_space_id 为 NULL（两步注册）
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 更新：用户只能更新自己的记录
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- User Households 策略
-- ============================================
-- 查看：用户可以查看自己的家庭关联
CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT 
  USING (user_id = auth.uid());

-- 插入：用户可以插入自己的家庭关联（加入家庭）
CREATE POLICY "user_spaces_insert_policy" ON user_spaces
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- 更新：用户可以更新自己的家庭关联（例如成为管理员）
CREATE POLICY "user_spaces_update_policy" ON user_spaces
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 删除：用户可以删除自己的家庭关联（离开家庭）
CREATE POLICY "user_spaces_delete_policy" ON user_spaces
  FOR DELETE 
  USING (user_id = auth.uid());

-- ============================================
-- Categories 策略
-- ============================================
CREATE POLICY "categories_manage_policy" ON categories
  FOR ALL 
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Payment Accounts 策略
-- ============================================
CREATE POLICY "payment_accounts_manage_policy" ON payment_accounts
  FOR ALL 
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Purposes 策略
-- ============================================
CREATE POLICY "purposes_manage_policy" ON purposes
  FOR ALL 
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Receipts 策略
-- ============================================
CREATE POLICY "receipts_manage_policy" ON receipts
  FOR ALL 
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Receipt Items 策略
-- ============================================
CREATE POLICY "receipt_items_manage_policy" ON receipt_items
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.space_id IN (
        SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.space_id IN (
        SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- Household Invitations 策略
-- ============================================
-- 查看：用户可以查看自己家庭的邀请或自己收到的邀请
CREATE POLICY "space_invitations_select_policy" ON space_invitations
  FOR SELECT
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
    OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- 插入：用户可以为自己家庭创建邀请（必须是管理员）
CREATE POLICY "space_invitations_insert_policy" ON space_invitations
  FOR INSERT
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- 更新：用户可以更新自己收到的邀请（接受邀请）
CREATE POLICY "space_invitations_update_policy" ON space_invitations
  FOR UPDATE
  USING (
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- ============================================
-- Payment Account Merge History 策略
-- ============================================
-- 用户只能访问自己家庭的合并历史
CREATE POLICY "payment_account_merge_history_manage_policy" ON payment_account_merge_history
  FOR ALL
  USING (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    space_id IN (
      SELECT space_id FROM user_spaces WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 验证脚本
-- ============================================
-- 运行以下查询检查策略是否正确创建：
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- 验证 users 表的 INSERT 策略（关键）
-- SELECT policyname, cmd, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'users' 
--   AND policyname = 'users_insert_policy';

-- ============================================
-- 完成
-- ============================================
-- 脚本执行完成后，请验证：
-- 1. 所有表已创建
-- 2. 所有 RLS 策略已创建
-- 3. users_insert_policy 允许 id = auth.uid() 的插入
-- 4. 可以成功注册新用户并创建 users 表记录

