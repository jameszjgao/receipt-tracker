-- 验证迁移是否完整
-- 检查所有表、列、约束、索引是否已正确更新

-- ============================================
-- 1. 检查表名
-- ============================================
SELECT '=== 表名检查 ===' as info;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('spaces', 'suppliers', 'user_spaces', 'supplier_merge_history') THEN '✅ 已重命名'
        WHEN table_name IN ('households', 'stores', 'user_households', 'store_merge_history') THEN '❌ 未重命名'
        ELSE '✓ 正常'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'households', 'spaces', 
    'stores', 'suppliers', 
    'user_households', 'user_spaces',
    'store_merge_history', 'supplier_merge_history',
    'space_invitations'
)
ORDER BY table_name;

-- ============================================
-- 2. 检查列名
-- ============================================
SELECT '=== 列名检查 ===' as info;

SELECT 
    table_name,
    column_name,
    CASE 
        WHEN column_name LIKE '%household%' THEN '❌ 需要重命名'
        WHEN column_name LIKE '%store%' AND column_name NOT IN ('store_name') THEN '❌ 需要重命名'
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

-- ============================================
-- 3. 检查唯一约束
-- ============================================
SELECT '=== 唯一约束检查 ===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    CASE 
        WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN '❌ 需要更新'
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

-- ============================================
-- 4. 检查外键约束
-- ============================================
SELECT '=== 外键约束检查 ===' as info;

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    CASE 
        WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN '❌ 需要更新'
        WHEN ccu.table_name IN ('households', 'stores', 'user_households') THEN '❌ 引用旧表名'
        ELSE '✅ 已更新'
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
    OR tc.table_name IN ('users', 'user_spaces', 'categories', 'payment_accounts', 'purposes', 'receipts', 'suppliers', 'supplier_merge_history', 'space_invitations')
)
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 5. 检查索引
-- ============================================
SELECT '=== 索引检查 ===' as info;

SELECT 
    indexname,
    tablename,
    CASE 
        WHEN indexname LIKE '%household%' OR indexname LIKE '%store%' THEN '❌ 需要更新'
        ELSE '✅ 已更新'
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
-- 6. 检查函数（需要手动更新）
-- ============================================
SELECT '=== 函数检查 ===' as info;

SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name LIKE '%household%' OR routine_name LIKE '%store%' THEN 
            CASE 
                -- 检查是否有对应的新函数（别名函数）
                WHEN (routine_name LIKE '%household%' AND EXISTS (
                    SELECT 1 FROM information_schema.routines 
                    WHERE routine_schema = 'public' 
                    AND routine_name = REPLACE(REPLACE(routine_name, 'household', 'space'), 'store', 'supplier')
                )) OR (routine_name LIKE '%store%' AND EXISTS (
                    SELECT 1 FROM information_schema.routines 
                    WHERE routine_schema = 'public' 
                    AND routine_name = REPLACE(routine_name, 'store', 'supplier')
                )) THEN '⚠️ 已创建别名（建议使用新函数）'
                ELSE '❌ 需要更新（无别名）'
            END
        ELSE '✅ 已更新'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_name LIKE '%household%' 
    OR routine_name LIKE '%store%'
    OR routine_name LIKE '%space%'
    OR routine_name LIKE '%supplier%'
)
ORDER BY routine_name;

-- ============================================
-- 总结
-- ============================================
SELECT '=== 迁移总结 ===' as info;

SELECT 
    '表重命名' as item,
    COUNT(*) FILTER (WHERE table_name IN ('spaces', 'suppliers', 'user_spaces', 'supplier_merge_history')) as completed,
    COUNT(*) FILTER (WHERE table_name IN ('households', 'stores', 'user_households', 'store_merge_history')) as remaining
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('households', 'spaces', 'stores', 'suppliers', 'user_households', 'user_spaces', 'store_merge_history', 'supplier_merge_history')

UNION ALL

SELECT 
    '列重命名' as item,
    COUNT(*) FILTER (WHERE column_name IN ('space_id', 'supplier_id', 'current_space_id', 'supplier_name', 'space_name')) as completed,
    COUNT(*) FILTER (WHERE column_name LIKE '%household%' OR (column_name LIKE '%store%' AND column_name NOT IN ('store_name'))) as remaining
FROM information_schema.columns
WHERE table_schema = 'public'
AND (column_name LIKE '%household%' OR column_name LIKE '%store%' OR column_name LIKE '%space%' OR column_name LIKE '%supplier%');
