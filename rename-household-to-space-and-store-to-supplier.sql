-- 全局重命名迁移脚本
-- household -> space
-- store -> supplier
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 第一部分：重命名表
-- ============================================

-- 1. 重命名主表
ALTER TABLE households RENAME TO spaces;
ALTER TABLE stores RENAME TO suppliers;

-- 2. 重命名关联表
ALTER TABLE user_households RENAME TO user_spaces;
ALTER TABLE store_merge_history RENAME TO supplier_merge_history;

-- 3. 重命名邀请表（如果存在）
-- 注意：household_invitations 表名保持不变，但字段会更新

-- ============================================
-- 第二部分：重命名字段
-- ============================================

-- 1. users 表
ALTER TABLE users RENAME COLUMN household_id TO space_id;
ALTER TABLE users RENAME COLUMN current_household_id TO current_space_id;

-- 2. user_spaces 表（原 user_households）
ALTER TABLE user_spaces RENAME COLUMN household_id TO space_id;

-- 3. categories 表
ALTER TABLE categories RENAME COLUMN household_id TO space_id;
-- 更新唯一约束
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_household_id_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_space_id_name_key UNIQUE(space_id, name);

-- 4. payment_accounts 表
ALTER TABLE payment_accounts RENAME COLUMN household_id TO space_id;
-- 更新唯一约束
ALTER TABLE payment_accounts DROP CONSTRAINT IF EXISTS payment_accounts_household_id_name_key;
ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_space_id_name_key UNIQUE(space_id, name);

-- 5. purposes 表
ALTER TABLE purposes RENAME COLUMN household_id TO space_id;
-- 更新唯一约束
ALTER TABLE purposes DROP CONSTRAINT IF EXISTS purposes_household_id_name_key;
ALTER TABLE purposes ADD CONSTRAINT purposes_space_id_name_key UNIQUE(space_id, name);

-- 6. receipts 表
ALTER TABLE receipts RENAME COLUMN household_id TO space_id;
ALTER TABLE receipts RENAME COLUMN store_id TO supplier_id;
ALTER TABLE receipts RENAME COLUMN store_name TO supplier_name;

-- 7. suppliers 表（原 stores）
ALTER TABLE suppliers RENAME COLUMN household_id TO space_id;
-- 更新唯一约束
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS stores_household_id_name_key;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_space_id_name_key UNIQUE(space_id, name);

-- 8. supplier_merge_history 表（原 store_merge_history）
ALTER TABLE supplier_merge_history RENAME COLUMN household_id TO space_id;
ALTER TABLE supplier_merge_history RENAME COLUMN source_store_name TO source_supplier_name;
ALTER TABLE supplier_merge_history RENAME COLUMN target_store_id TO target_supplier_id;

-- 9. household_invitations 表（表名保持不变，但字段更新）
ALTER TABLE household_invitations RENAME COLUMN household_id TO space_id;

-- ============================================
-- 第三部分：更新外键约束
-- ============================================

-- 注意：PostgreSQL 会自动更新外键约束名称，但我们需要确保引用正确

-- 1. 更新 users 表的外键
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_space_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_current_space_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_current_space_id_fkey FOREIGN KEY (current_space_id) REFERENCES spaces(id) ON DELETE SET NULL;

-- 2. 更新 user_spaces 表的外键
ALTER TABLE user_spaces DROP CONSTRAINT IF EXISTS user_spaces_space_id_fkey;
ALTER TABLE user_spaces ADD CONSTRAINT user_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- 3. 更新 categories 表的外键
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_space_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- 4. 更新 payment_accounts 表的外键
ALTER TABLE payment_accounts DROP CONSTRAINT IF EXISTS payment_accounts_space_id_fkey;
ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- 5. 更新 purposes 表的外键
ALTER TABLE purposes DROP CONSTRAINT IF EXISTS purposes_space_id_fkey;
ALTER TABLE purposes ADD CONSTRAINT purposes_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- 6. 更新 receipts 表的外键
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_space_id_fkey;
ALTER TABLE receipts ADD CONSTRAINT receipts_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_supplier_id_fkey;
ALTER TABLE receipts ADD CONSTRAINT receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- 7. 更新 suppliers 表的外键
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_space_id_fkey;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- 8. 更新 supplier_merge_history 表的外键
ALTER TABLE supplier_merge_history DROP CONSTRAINT IF EXISTS supplier_merge_history_space_id_fkey;
ALTER TABLE supplier_merge_history ADD CONSTRAINT supplier_merge_history_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

ALTER TABLE supplier_merge_history DROP CONSTRAINT IF EXISTS supplier_merge_history_target_supplier_id_fkey;
ALTER TABLE supplier_merge_history ADD CONSTRAINT supplier_merge_history_target_supplier_id_fkey FOREIGN KEY (target_supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- 9. 更新 household_invitations 表的外键
ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS household_invitations_space_id_fkey;
ALTER TABLE household_invitations ADD CONSTRAINT household_invitations_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- ============================================
-- 第四部分：更新索引
-- ============================================

-- 1. 重命名索引（如果存在）
DROP INDEX IF EXISTS idx_users_household_id;
CREATE INDEX IF NOT EXISTS idx_users_space_id ON users(space_id);

DROP INDEX IF EXISTS idx_users_current_household_id;
CREATE INDEX IF NOT EXISTS idx_users_current_space_id ON users(current_space_id);

DROP INDEX IF EXISTS idx_user_households_user_id;
CREATE INDEX IF NOT EXISTS idx_user_spaces_user_id ON user_spaces(user_id);

DROP INDEX IF EXISTS idx_user_households_household_id;
CREATE INDEX IF NOT EXISTS idx_user_spaces_space_id ON user_spaces(space_id);

DROP INDEX IF EXISTS idx_categories_household_id;
CREATE INDEX IF NOT EXISTS idx_categories_space_id ON categories(space_id);

DROP INDEX IF EXISTS idx_payment_accounts_household_id;
CREATE INDEX IF NOT EXISTS idx_payment_accounts_space_id ON payment_accounts(space_id);

DROP INDEX IF EXISTS idx_purposes_household_id;
CREATE INDEX IF NOT EXISTS idx_purposes_space_id ON purposes(space_id);

DROP INDEX IF EXISTS idx_receipts_household_id;
CREATE INDEX IF NOT EXISTS idx_receipts_space_id ON receipts(space_id);

DROP INDEX IF EXISTS idx_receipts_store_id;
CREATE INDEX IF NOT EXISTS idx_receipts_supplier_id ON receipts(supplier_id);

DROP INDEX IF EXISTS idx_stores_household_id;
CREATE INDEX IF NOT EXISTS idx_suppliers_space_id ON suppliers(space_id);

DROP INDEX IF EXISTS idx_store_merge_history_household_id;
CREATE INDEX IF NOT EXISTS idx_supplier_merge_history_space_id ON supplier_merge_history(space_id);

-- ============================================
-- 第五部分：更新函数和 RLS 策略
-- ============================================

-- 注意：需要手动更新所有使用 household_id 或 store_id 的函数
-- 这里只列出需要更新的函数名，具体更新需要查看函数定义

-- 需要更新的函数（示例）：
-- - get_user_household_id() -> get_user_space_id()
-- - create_household() -> create_space()
-- - 等等

-- RLS 策略会自动更新，因为它们是基于表名的

-- ============================================
-- 第六部分：验证迁移
-- ============================================

-- 检查表是否已重命名
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('spaces', 'suppliers', 'user_spaces', 'supplier_merge_history');

-- 检查字段是否已重命名
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('space_id', 'supplier_id', 'current_space_id')
ORDER BY table_name, column_name;
