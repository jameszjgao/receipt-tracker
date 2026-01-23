-- 修复剩余的列重命名
-- 用于处理那些可能被遗漏的列

-- ============================================
-- 查找并修复剩余的列
-- ============================================

-- 1. 检查 household_invitations 表的 household_name 字段
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_invitations' 
        AND column_name = 'household_name'
    ) THEN
        ALTER TABLE household_invitations RENAME COLUMN household_name TO space_name;
        RAISE NOTICE 'Renamed household_invitations.household_name to space_name';
    END IF;
END $$;

-- 2. 检查 receipts 表是否还有 store_name（应该已经是 supplier_name）
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'receipts' 
        AND column_name = 'store_name'
    ) THEN
        ALTER TABLE receipts RENAME COLUMN store_name TO supplier_name;
        RAISE NOTICE 'Renamed receipts.store_name to supplier_name';
    END IF;
END $$;

-- 3. 检查 users 表是否还有 space_id（如果之前没有重命名 household_id）
DO $$ 
BEGIN
    -- 如果还有 household_id，重命名它
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'household_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN household_id TO space_id;
        RAISE NOTICE 'Renamed users.household_id to space_id';
    END IF;
    
    -- 如果还有 current_household_id，重命名它
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'current_household_id'
    ) THEN
        ALTER TABLE users RENAME COLUMN current_household_id TO current_space_id;
        RAISE NOTICE 'Renamed users.current_household_id to current_space_id';
    END IF;
END $$;

-- 4. 检查其他可能遗漏的表
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 查找所有包含 household 或 store 的列名
    FOR r IN (
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND (
            (column_name LIKE '%household%' AND column_name NOT LIKE '%space%')
            OR (column_name LIKE '%store%' AND column_name NOT LIKE '%supplier%' AND column_name != 'store_name')
        )
    ) LOOP
        -- 根据列名决定新的列名
        IF r.column_name LIKE '%household%' THEN
            EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', 
                r.table_name, 
                r.column_name, 
                replace(r.column_name, 'household', 'space'));
            RAISE NOTICE 'Renamed %.%', r.table_name, r.column_name;
        ELSIF r.column_name LIKE '%store%' AND r.column_name != 'store_name' THEN
            EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', 
                r.table_name, 
                r.column_name, 
                replace(r.column_name, 'store', 'supplier'));
            RAISE NOTICE 'Renamed %.%', r.table_name, r.column_name;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 验证修复结果
-- ============================================
SELECT '=== 修复后的列检查 ===' as info;

SELECT 
    table_name,
    column_name,
    CASE 
        WHEN column_name LIKE '%household%' THEN '❌ 仍需要重命名'
        WHEN column_name LIKE '%store%' AND column_name NOT IN ('store_name', 'supplier_name') THEN '❌ 仍需要重命名'
        WHEN column_name IN ('space_id', 'supplier_id', 'current_space_id', 'supplier_name', 'space_name') THEN '✅ 已重命名'
        ELSE '✓ 正常'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
    column_name LIKE '%household%' 
    OR column_name LIKE '%store%'
    OR column_name LIKE '%space%'
    OR column_name LIKE '%supplier%'
)
ORDER BY table_name, column_name;
