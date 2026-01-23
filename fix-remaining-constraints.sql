-- 修复剩余的唯一约束
-- 用于更新那些列已重命名但约束仍使用旧列名的情况
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 更新唯一约束
-- ============================================

-- 1. categories 表
DO $$ 
BEGIN
    -- 检查旧约束是否存在（即使列已重命名，约束名可能还在）
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_household_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'categories'
    ) THEN
        -- 删除旧约束（PostgreSQL 会自动处理列名变化）
        ALTER TABLE categories DROP CONSTRAINT categories_household_id_name_key;
        RAISE NOTICE 'Dropped old categories constraint';
    END IF;
    
    -- 检查新约束是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_space_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'categories'
    ) THEN
        -- 检查列是否存在
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'categories' 
            AND column_name = 'space_id'
        ) THEN
            ALTER TABLE categories ADD CONSTRAINT categories_space_id_name_key UNIQUE(space_id, name);
            RAISE NOTICE 'Created new categories constraint';
        END IF;
    END IF;
END $$;

-- 2. payment_accounts 表
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_accounts_household_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'payment_accounts'
    ) THEN
        ALTER TABLE payment_accounts DROP CONSTRAINT payment_accounts_household_id_name_key;
        RAISE NOTICE 'Dropped old payment_accounts constraint';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_accounts_space_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'payment_accounts'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'payment_accounts' 
            AND column_name = 'space_id'
        ) THEN
            ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_space_id_name_key UNIQUE(space_id, name);
            RAISE NOTICE 'Created new payment_accounts constraint';
        END IF;
    END IF;
END $$;

-- 3. purposes 表
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'purposes_household_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'purposes'
    ) THEN
        ALTER TABLE purposes DROP CONSTRAINT purposes_household_id_name_key;
        RAISE NOTICE 'Dropped old purposes constraint';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'purposes_space_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'purposes'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'purposes' 
            AND column_name = 'space_id'
        ) THEN
            ALTER TABLE purposes ADD CONSTRAINT purposes_space_id_name_key UNIQUE(space_id, name);
            RAISE NOTICE 'Created new purposes constraint';
        END IF;
    END IF;
END $$;

-- 4. suppliers 表（原 stores）
DO $$ 
BEGIN
    -- 检查旧约束（可能表名还是 stores 或已经是 suppliers）
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stores_household_id_name_key'
        AND table_schema = 'public'
        AND table_name IN ('stores', 'suppliers')
    ) THEN
        -- 根据实际表名删除约束
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
            ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS stores_household_id_name_key;
            RAISE NOTICE 'Dropped old suppliers constraint';
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
            ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_household_id_name_key;
            RAISE NOTICE 'Dropped old stores constraint (table not renamed yet)';
        END IF;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'suppliers_space_id_name_key'
        AND table_schema = 'public'
        AND table_name = 'suppliers'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'suppliers' 
            AND column_name = 'space_id'
        ) THEN
            ALTER TABLE suppliers ADD CONSTRAINT suppliers_space_id_name_key UNIQUE(space_id, name);
            RAISE NOTICE 'Created new suppliers constraint';
        END IF;
    END IF;
END $$;

-- 5. user_spaces 表（原 user_households）
DO $$ 
BEGIN
    -- 检查旧约束（可能表名还是 user_households 或已经是 user_spaces）
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_households_user_id_household_id_key'
        AND table_schema = 'public'
        AND table_name IN ('user_households', 'user_spaces')
    ) THEN
        -- 根据实际表名删除约束
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_spaces') THEN
            ALTER TABLE user_spaces DROP CONSTRAINT IF EXISTS user_households_user_id_household_id_key;
            RAISE NOTICE 'Dropped old user_spaces constraint';
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_households') THEN
            ALTER TABLE user_households DROP CONSTRAINT IF EXISTS user_households_user_id_household_id_key;
            RAISE NOTICE 'Dropped old user_households constraint (table not renamed yet)';
        END IF;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_spaces_user_id_space_id_key'
        AND table_schema = 'public'
        AND table_name = 'user_spaces'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_spaces' 
            AND column_name = 'space_id'
        ) THEN
            ALTER TABLE user_spaces ADD CONSTRAINT user_spaces_user_id_space_id_key UNIQUE(user_id, space_id);
            RAISE NOTICE 'Created new user_spaces constraint';
        END IF;
    END IF;
END $$;

-- ============================================
-- 验证修复结果
-- ============================================
SELECT '=== 唯一约束检查（修复后）===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    CASE 
        WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN '❌ 仍需要更新'
        ELSE '✅ 已更新'
    END as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
AND tc.table_schema = 'public'
AND (
    tc.constraint_name LIKE '%household%' 
    OR tc.constraint_name LIKE '%store%'
    OR tc.table_name IN ('categories', 'payment_accounts', 'purposes', 'suppliers', 'user_spaces')
)
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;
