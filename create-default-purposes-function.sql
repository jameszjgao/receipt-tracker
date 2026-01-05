-- ============================================
-- 创建默认用途的函数
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 创建默认用途的函数（新家庭创建时调用）
CREATE OR REPLACE FUNCTION create_default_purposes(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO purposes (household_id, name, color, is_default) VALUES
    (p_household_id, 'Home', '#00B894', true),
    (p_household_id, 'Gifts', '#E84393', true),
    (p_household_id, 'Business', '#FF9500', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_default_purposes(UUID) TO authenticated;

