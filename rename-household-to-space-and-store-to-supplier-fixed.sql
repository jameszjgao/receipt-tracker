-- 全局重命名迁移脚本（修复版）
-- household -> space
-- store -> supplier
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：请在执行前备份数据库！

-- ============================================
-- 第一部分：禁用触发器（避免冲突）
-- ============================================
-- 暂时禁用可能影响迁移的触发器
-- 迁移完成后会自动恢复

-- ============================================
-- 第二部分：重命名表
-- ============================================

-- 1. 重命名主表
ALTER TABLE IF EXISTS households RENAME TO spaces;
ALTER TABLE IF EXISTS stores RENAME TO suppliers;

-- 2. 重命名关联表
ALTER TABLE IF EXISTS user_households RENAME TO user_spaces;
ALTER TABLE IF EXISTS store_merge_history RENAME TO supplier_merge_history;

-- 注意：household_invitations 表名保持不变，但字段会更新

-- ============================================
-- 第三部分：重命名字段
-- ============================================

-- 1. users 表
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'household_id') THEN
        ALTER TABLE users RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_household_id') THEN
        ALTER TABLE users RENAME COLUMN current_household_id TO current_space_id;
    END IF;
END $$;

-- 2. user_spaces 表（原 user_households）
DO $$ 
BEGIN
    -- 检查表是否存在（可能是 user_households 或 user_spaces）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_spaces') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_spaces' AND column_name = 'household_id') THEN
            ALTER TABLE user_spaces RENAME COLUMN household_id TO space_id;
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_households') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_households' AND column_name = 'household_id') THEN
            ALTER TABLE user_households RENAME COLUMN household_id TO space_id;
        END IF;
    END IF;
END $$;

-- 3. categories 表
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'household_id') THEN
        ALTER TABLE categories RENAME COLUMN household_id TO space_id;
    END IF;
    
    -- 更新唯一约束
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_household_id_name_key') THEN
        ALTER TABLE categories DROP CONSTRAINT categories_household_id_name_key;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_space_id_name_key') THEN
        ALTER TABLE categories ADD CONSTRAINT categories_space_id_name_key UNIQUE(space_id, name);
    END IF;
END $$;

-- 4. payment_accounts 表
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_accounts' AND column_name = 'household_id') THEN
        ALTER TABLE payment_accounts RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payment_accounts_household_id_name_key') THEN
        ALTER TABLE payment_accounts DROP CONSTRAINT payment_accounts_household_id_name_key;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payment_accounts_space_id_name_key') THEN
        ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_space_id_name_key UNIQUE(space_id, name);
    END IF;
END $$;

-- 5. purposes 表
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purposes' AND column_name = 'household_id') THEN
        ALTER TABLE purposes RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'purposes_household_id_name_key') THEN
        ALTER TABLE purposes DROP CONSTRAINT purposes_household_id_name_key;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'purposes_space_id_name_key') THEN
        ALTER TABLE purposes ADD CONSTRAINT purposes_space_id_name_key UNIQUE(space_id, name);
    END IF;
END $$;

-- 6. receipts 表
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'household_id') THEN
        ALTER TABLE receipts RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'store_id') THEN
        ALTER TABLE receipts RENAME COLUMN store_id TO supplier_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'store_name') THEN
        ALTER TABLE receipts RENAME COLUMN store_name TO supplier_name;
    END IF;
END $$;

-- 7. suppliers 表（原 stores）
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'household_id') THEN
        ALTER TABLE suppliers RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stores_household_id_name_key') THEN
        ALTER TABLE suppliers DROP CONSTRAINT stores_household_id_name_key;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'suppliers_space_id_name_key') THEN
        ALTER TABLE suppliers ADD CONSTRAINT suppliers_space_id_name_key UNIQUE(space_id, name);
    END IF;
END $$;

-- 8. supplier_merge_history 表（原 store_merge_history）
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'household_id') THEN
        ALTER TABLE supplier_merge_history RENAME COLUMN household_id TO space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'source_store_name') THEN
        ALTER TABLE supplier_merge_history RENAME COLUMN source_store_name TO source_supplier_name;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'target_store_id') THEN
        ALTER TABLE supplier_merge_history RENAME COLUMN target_store_id TO target_supplier_id;
    END IF;
END $$;

-- 9. household_invitations 表（表名保持不变，但字段更新）
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'household_invitations' AND column_name = 'household_id') THEN
        ALTER TABLE household_invitations RENAME COLUMN household_id TO space_id;
    END IF;
    
    -- 如果存在 household_name 字段，重命名为 space_name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'household_invitations' AND column_name = 'household_name') THEN
        ALTER TABLE household_invitations RENAME COLUMN household_name TO space_name;
    END IF;
END $$;

-- ============================================
-- 第四部分：更新外键约束
-- ============================================

-- PostgreSQL 在重命名表/列时会自动更新外键约束，但我们需要确保约束名称正确

-- 1. users 表的外键
DO $$ 
BEGIN
    -- 删除旧的外键约束（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_household_id_fkey') THEN
        ALTER TABLE users DROP CONSTRAINT users_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_current_household_id_fkey') THEN
        ALTER TABLE users DROP CONSTRAINT users_current_household_id_fkey;
    END IF;
    
    -- 添加新的外键约束（如果列存在且约束不存在）
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_space_id_fkey') THEN
            ALTER TABLE users ADD CONSTRAINT users_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_current_space_id_fkey') THEN
            ALTER TABLE users ADD CONSTRAINT users_current_space_id_fkey FOREIGN KEY (current_space_id) REFERENCES spaces(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 2. user_spaces 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_households_household_id_fkey') THEN
        ALTER TABLE user_spaces DROP CONSTRAINT user_households_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_spaces' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_spaces_space_id_fkey') THEN
            ALTER TABLE user_spaces ADD CONSTRAINT user_spaces_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 3. categories 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_household_id_fkey') THEN
        ALTER TABLE categories DROP CONSTRAINT categories_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_space_id_fkey') THEN
            ALTER TABLE categories ADD CONSTRAINT categories_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 4. payment_accounts 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payment_accounts_household_id_fkey') THEN
        ALTER TABLE payment_accounts DROP CONSTRAINT payment_accounts_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_accounts' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'payment_accounts_space_id_fkey') THEN
            ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 5. purposes 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'purposes_household_id_fkey') THEN
        ALTER TABLE purposes DROP CONSTRAINT purposes_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purposes' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'purposes_space_id_fkey') THEN
            ALTER TABLE purposes ADD CONSTRAINT purposes_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 6. receipts 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receipts_household_id_fkey') THEN
        ALTER TABLE receipts DROP CONSTRAINT receipts_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receipts_store_id_fkey') THEN
        ALTER TABLE receipts DROP CONSTRAINT receipts_store_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receipts_space_id_fkey') THEN
            ALTER TABLE receipts ADD CONSTRAINT receipts_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'supplier_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'receipts_supplier_id_fkey') THEN
            ALTER TABLE receipts ADD CONSTRAINT receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 7. suppliers 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stores_household_id_fkey') THEN
        ALTER TABLE suppliers DROP CONSTRAINT stores_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'suppliers_space_id_fkey') THEN
            ALTER TABLE suppliers ADD CONSTRAINT suppliers_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 8. supplier_merge_history 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'store_merge_history_household_id_fkey') THEN
        ALTER TABLE supplier_merge_history DROP CONSTRAINT store_merge_history_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'store_merge_history_target_store_id_fkey') THEN
        ALTER TABLE supplier_merge_history DROP CONSTRAINT store_merge_history_target_store_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'supplier_merge_history_space_id_fkey') THEN
            ALTER TABLE supplier_merge_history ADD CONSTRAINT supplier_merge_history_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'target_supplier_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'supplier_merge_history_target_supplier_id_fkey') THEN
            ALTER TABLE supplier_merge_history ADD CONSTRAINT supplier_merge_history_target_supplier_id_fkey FOREIGN KEY (target_supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 9. household_invitations 表的外键
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'household_invitations_household_id_fkey') THEN
        ALTER TABLE household_invitations DROP CONSTRAINT household_invitations_household_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'household_invitations' AND column_name = 'space_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'household_invitations_space_id_fkey') THEN
            ALTER TABLE household_invitations ADD CONSTRAINT household_invitations_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- ============================================
-- 第五部分：更新索引
-- ============================================

-- 删除旧索引并创建新索引
-- 注意：只有在列存在时才创建索引

DROP INDEX IF EXISTS idx_users_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_space_id ON users(space_id) WHERE space_id IS NOT NULL';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_users_current_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_current_space_id ON users(current_space_id) WHERE current_space_id IS NOT NULL';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_user_households_user_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_spaces') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_spaces_user_id ON user_spaces(user_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_user_households_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_spaces' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_spaces_space_id ON user_spaces(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_categories_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_categories_space_id ON categories(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_payment_accounts_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_accounts' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payment_accounts_space_id ON payment_accounts(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_purposes_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purposes' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purposes_space_id ON purposes(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_receipts_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipts_space_id ON receipts(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_receipts_store_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'supplier_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_receipts_supplier_id ON receipts(supplier_id) WHERE supplier_id IS NOT NULL';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_stores_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suppliers_space_id ON suppliers(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_store_merge_history_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_merge_history' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_supplier_merge_history_space_id ON supplier_merge_history(space_id)';
    END IF;
END $$;

DROP INDEX IF EXISTS idx_household_invitations_household_id;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'household_invitations' AND column_name = 'space_id') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_household_invitations_space_id ON household_invitations(space_id)';
    END IF;
END $$;

-- ============================================
-- 第六部分：验证迁移
-- ============================================

-- 检查表是否已重命名
SELECT 'Tables check:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('spaces', 'suppliers', 'user_spaces', 'supplier_merge_history')
ORDER BY table_name;

-- 检查字段是否已重命名
SELECT 'Columns check:' as info;
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('space_id', 'supplier_id', 'current_space_id', 'supplier_name')
ORDER BY table_name, column_name;

-- ============================================
-- 注意：函数和 RLS 策略需要单独更新
-- ============================================
-- 由于函数和 RLS 策略可能引用旧的表名/列名，需要手动更新
-- 建议使用 clean-schema.py 脚本处理函数定义
