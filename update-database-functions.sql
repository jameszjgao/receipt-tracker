-- ============================================
-- 更新数据库函数：新的默认分类和支付账户
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 更新创建默认分类的函数
CREATE OR REPLACE FUNCTION create_default_categories(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (household_id, name, color, is_default) VALUES
    (p_household_id, '食品', '#FF6B6B', true),
    (p_household_id, '外餐', '#4ECDC4', true),
    (p_household_id, '居家', '#45B7D1', true),
    (p_household_id, '交通', '#FFA07A', true),
    (p_household_id, '购物', '#98D8C8', true),
    (p_household_id, '医疗', '#F7DC6F', true),
    (p_household_id, '教育', '#BB8FCE', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 注意：支付账户的创建仍然使用相同的函数
-- 支付账户的名称现在应该包含卡号尾号信息（如："信用卡****1234"）
-- 这个信息由 AI 识别时提取，或在创建时手动输入

