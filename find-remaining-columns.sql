-- 找出还需要重命名的列
SELECT 
    table_name,
    column_name,
    CASE 
        WHEN column_name LIKE '%household%' THEN '需要重命名: household -> space'
        WHEN column_name LIKE '%store%' AND column_name NOT IN ('store_name', 'supplier_name') THEN '需要重命名: store -> supplier'
        ELSE '已处理'
    END as action
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
    column_name LIKE '%household%' 
    OR (column_name LIKE '%store%' AND column_name NOT IN ('store_name', 'supplier_name'))
)
AND column_name NOT IN ('space_id', 'supplier_id', 'current_space_id', 'supplier_name', 'space_name')
ORDER BY table_name, column_name;
