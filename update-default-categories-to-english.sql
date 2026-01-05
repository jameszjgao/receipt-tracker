-- ============================================
-- 更新默认分类为英文
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 更新创建默认分类的函数
CREATE OR REPLACE FUNCTION create_default_categories(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (household_id, name, color, is_default) VALUES
    (p_household_id, 'Groceries', '#FF6B6B', true),
    (p_household_id, 'Dining Out', '#4ECDC4', true),
    (p_household_id, 'Transportation', '#FFA07A', true),
    (p_household_id, 'Personal Care', '#FFD93D', true),
    (p_household_id, 'Health', '#F7DC6F', true),
    (p_household_id, 'Entertainment', '#E17055', true),
    (p_household_id, 'Education', '#BB8FCE', true),
    (p_household_id, 'Housing', '#45B7D1', true),
    (p_household_id, 'Utilities', '#74B9FF', true),
    (p_household_id, 'Clothing', '#FD79A8', true),
    (p_household_id, 'Subscriptions', '#55A3FF', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

