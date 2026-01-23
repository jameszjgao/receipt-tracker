-- ============================================
-- 完整数据库创建脚本（已清理：household->space, store->supplier）
-- 适用于新 Supabase 项目
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 注意：此脚本不包含 DROP 语句，适用于全新项目
-- 如果项目已有数据，请先备份

-- ============================================
-- 第一步：创建所有表结构
-- ============================================

-- 创建 spaces 表（空间账户，原 households）
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 users 表（用户表，使用 Supabase Auth）
-- 注意：space_id 和 current_space_id 可以为 NULL（支持两步注册）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL, -- 可空，向后兼容
  current_space_id UUID REFERENCES spaces(id) ON DELETE SET NULL, -- 当前活动的空间
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 user_spaces 表（用户-空间多对多关系，原 user_households）
CREATE TABLE IF NOT EXISTS user_spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, space_id)
);

-- 创建 categories 表（消费分类，每个空间独立）
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 payment_accounts 表（支付账户，每个空间独立）
CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_ai_recognized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 purposes 表（商品用途，每个空间独立）
CREATE TABLE IF NOT EXISTS purposes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#95A5A6',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 suppliers 表（供应商，原 stores）
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_number TEXT,
  phone TEXT,
  address TEXT,
  is_ai_recognized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, name)
);

-- 创建 receipts 表
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL, -- 原 store_name
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL, -- 原 store_id
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
CREATE TABLE IF NOT EXISTS receipt_items (
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

-- 创建 space_invitations 表（空间邀请，原 household_invitations）
CREATE TABLE IF NOT EXISTS space_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  inviter_email TEXT,
  space_name TEXT, -- 原 household_name
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'declined', 'removed'))
);

-- 创建 supplier_merge_history 表（供应商合并历史，原 store_merge_history）
CREATE TABLE IF NOT EXISTS supplier_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_supplier_name TEXT NOT NULL, -- 原 source_store_name
  target_supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, -- 原 target_store_id
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 payment_account_merge_history 表（支付账户合并历史）
CREATE TABLE IF NOT EXISTS payment_account_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_account_name TEXT NOT NULL,
  target_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 ai_chat_logs 表（AI 对话日志）
CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  model_name TEXT,
  prompt TEXT,
  response TEXT,
  request_data JSONB,
  response_data JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  confidence NUMERIC(3,2),
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 第二步：创建索引以提高查询性能
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_space_id ON users(space_id);
CREATE INDEX IF NOT EXISTS idx_users_current_space_id ON users(current_space_id);
CREATE INDEX IF NOT EXISTS idx_user_spaces_user_id ON user_spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_spaces_space_id ON user_spaces(space_id);
CREATE INDEX IF NOT EXISTS idx_categories_space_id ON categories(space_id);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_space_id ON payment_accounts(space_id);
CREATE INDEX IF NOT EXISTS idx_purposes_space_id ON purposes(space_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_space_id ON suppliers(space_id);
CREATE INDEX IF NOT EXISTS idx_receipts_space_id ON receipts(space_id);
CREATE INDEX IF NOT EXISTS idx_receipts_supplier_id ON receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_category_id ON receipt_items(category_id);
CREATE INDEX IF NOT EXISTS idx_space_invitations_space_id ON space_invitations(space_id);
CREATE INDEX IF NOT EXISTS idx_space_invitations_email ON space_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_space_invitations_status ON space_invitations(status);
CREATE INDEX IF NOT EXISTS idx_supplier_merge_history_space_id ON supplier_merge_history(space_id);
CREATE INDEX IF NOT EXISTS idx_supplier_merge_history_source_name ON supplier_merge_history(space_id, source_supplier_name);
CREATE INDEX IF NOT EXISTS idx_supplier_merge_history_target_id ON supplier_merge_history(target_supplier_id);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_space_id ON payment_account_merge_history(space_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_space_id ON ai_chat_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user_id ON ai_chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_receipt_id ON ai_chat_logs(receipt_id);

-- 创建唯一索引确保每个空间-邮箱组合只有一个待处理邀请
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_invitations_unique_email 
ON space_invitations(space_id, LOWER(TRIM(invitee_email)))
WHERE status = 'pending';

-- ============================================
-- 第三步：创建辅助函数
-- ============================================

-- 创建 updated_at 自动更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为相关表创建 updated_at 触发器
CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON spaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_accounts_updated_at BEFORE UPDATE ON payment_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purposes_updated_at BEFORE UPDATE ON purposes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 检查空间是否有至少一个管理员的触发器函数
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

-- 为 user_spaces 表创建触发器
CREATE TRIGGER check_space_has_admin_trigger
    BEFORE DELETE OR UPDATE ON user_spaces
    FOR EACH ROW EXECUTE FUNCTION check_space_has_admin();

-- ============================================
-- 注意：以下函数需要从完整的 SQL 导出文件中获取
-- 由于文件很大，建议使用 clean-schema.py 脚本处理原始导出文件
-- ============================================

-- 需要创建的函数包括：
-- - create_default_categories(p_space_id)
-- - create_default_payment_accounts(p_space_id)
-- - create_default_purposes(p_space_id)
-- - create_space_with_user(...)
-- - create_user_with_space(...)
-- - get_user_space_id()
-- - get_user_space_ids()
-- - get_space_member_users(p_space_id)
-- - create_space_invitation(...)
-- - 等等

-- 完整的函数定义请参考 create-new-project-schema-complete.sql 文件
-- 或使用 clean-schema.py 脚本处理原始 SQL 导出文件
