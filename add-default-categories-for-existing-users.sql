-- ============================================
-- 为已存在的用户添加默认分类
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 为所有已存在的家庭添加默认分类（如果不存在）
INSERT INTO categories (household_id, name, color, is_default)
SELECT 
  h.id as household_id,
  cat.name,
  cat.color,
  cat.is_default
FROM households h
CROSS JOIN (
  SELECT '食品' as name, '#FF6B6B' as color, true as is_default
  UNION ALL SELECT '外餐', '#4ECDC4', true
  UNION ALL SELECT '居家', '#45B7D1', true
  UNION ALL SELECT '交通', '#FFA07A', true
  UNION ALL SELECT '购物', '#98D8C8', true
  UNION ALL SELECT '医疗', '#F7DC6F', true
  UNION ALL SELECT '教育', '#BB8FCE', true
) cat
WHERE NOT EXISTS (
  SELECT 1 
  FROM categories c 
  WHERE c.household_id = h.id 
  AND c.name = cat.name
)
ON CONFLICT (household_id, name) DO NOTHING;

-- 验证：查看所有家庭的分类数量
SELECT 
  h.id as household_id,
  h.name as household_name,
  COUNT(c.id) as category_count,
  STRING_AGG(c.name, ', ' ORDER BY c.name) as categories
FROM households h
LEFT JOIN categories c ON c.household_id = h.id
GROUP BY h.id, h.name
ORDER BY h.created_at DESC;

