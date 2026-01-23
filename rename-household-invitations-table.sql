-- 重命名 household_invitations 表为 space_invitations
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：请在执行前备份数据库！

-- ============================================
-- 第一部分：重命名表
-- ============================================

DO $$
BEGIN
    -- 检查表是否存在
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_invitations') THEN
        -- 重命名表
        ALTER TABLE household_invitations RENAME TO space_invitations;
        RAISE NOTICE 'Table household_invitations renamed to space_invitations';
    ELSE
        RAISE NOTICE 'Table household_invitations does not exist, skipping rename';
    END IF;
END $$;

-- ============================================
-- 第二部分：重命名索引
-- ============================================

DO $$
BEGIN
    -- 重命名索引
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_household_invitations_token') THEN
        ALTER INDEX idx_household_invitations_token RENAME TO idx_space_invitations_token;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_household_invitations_email') THEN
        ALTER INDEX idx_household_invitations_email RENAME TO idx_space_invitations_email;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_household_invitations_space_id') THEN
        ALTER INDEX idx_household_invitations_space_id RENAME TO idx_space_invitations_space_id;
    ELSIF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_household_invitations_household_id') THEN
        ALTER INDEX idx_household_invitations_household_id RENAME TO idx_space_invitations_space_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_household_invitations_status') THEN
        ALTER INDEX idx_household_invitations_status RENAME TO idx_space_invitations_status;
    END IF;
END $$;

-- ============================================
-- 第三部分：更新 RLS 策略名称（如果需要）
-- ============================================
-- 注意：RLS 策略会自动跟随表名，但策略名称可以保持不变或更新
-- 这里我们保留策略名称不变，因为它们已经使用了正确的逻辑

-- ============================================
-- 第四部分：更新函数中的表引用
-- ============================================
-- 注意：函数中的表引用需要单独更新，这里只处理表重命名
-- 函数更新请参考 update-database-functions.sql

-- ============================================
-- 验证
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'space_invitations') THEN
        RAISE NOTICE '✅ Table space_invitations exists';
    ELSE
        RAISE WARNING '❌ Table space_invitations does not exist';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_invitations') THEN
        RAISE NOTICE '✅ Old table household_invitations has been renamed';
    ELSE
        RAISE WARNING '❌ Old table household_invitations still exists';
    END IF;
END $$;
