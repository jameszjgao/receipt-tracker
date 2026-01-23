-- 诊断迁移状态脚本
-- 用于检查哪些表/列已经重命名，哪些还没有

-- ============================================
-- 检查表名
-- ============================================
SELECT '=== 表名检查 ===' as info;

SELECT 
    CASE 
        WHEN table_name = 'households' THEN '❌ 需要重命名: households -> spaces'
        WHEN table_name = 'spaces' THEN '✅ 已重命名: spaces'
        ELSE NULL
    END as status,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('households', 'spaces', 'stores', 'suppliers', 'user_households', 'user_spaces', 'store_merge_history', 'supplier_merge_history')
ORDER BY table_name;

-- ============================================
-- 检查列名
-- ============================================
SELECT '=== 列名检查 ===' as info;

SELECT 
    table_name,
    column_name,
    CASE 
        WHEN column_name LIKE '%household%' THEN '❌ 需要重命名'
        WHEN column_name LIKE '%store%' AND column_name != 'store_name' THEN '❌ 需要重命名'
        WHEN column_name IN ('space_id', 'supplier_id', 'current_space_id', 'supplier_name') THEN '✅ 已重命名'
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

-- ============================================
-- 检查外键约束
-- ============================================
SELECT '=== 外键约束检查 ===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN '❌ 需要更新'
        ELSE '✓ 正常'
    END as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND (
    tc.constraint_name LIKE '%household%' 
    OR tc.constraint_name LIKE '%store%'
    OR tc.table_name IN ('users', 'user_spaces', 'categories', 'payment_accounts', 'purposes', 'receipts', 'suppliers', 'supplier_merge_history', 'household_invitations')
)
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 检查索引
-- ============================================
SELECT '=== 索引检查 ===' as info;

SELECT 
    indexname,
    tablename,
    CASE 
        WHEN indexname LIKE '%household%' OR indexname LIKE '%store%' THEN '❌ 需要更新'
        ELSE '✓ 正常'
    END as status
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE '%household%' 
    OR indexname LIKE '%store%'
    OR indexname LIKE '%space%'
    OR indexname LIKE '%supplier%'
)
ORDER BY tablename, indexname;

-- ============================================
-- 检查唯一约束
-- ============================================
SELECT '=== 唯一约束检查 ===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    CASE 
        WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN '❌ 需要更新'
        ELSE '✓ 正常'
    END as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
AND tc.table_schema = 'public'
AND (
    tc.constraint_name LIKE '%household%' 
    OR tc.constraint_name LIKE '%store%'
    OR tc.table_name IN ('categories', 'payment_accounts', 'purposes', 'suppliers')
)
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;
