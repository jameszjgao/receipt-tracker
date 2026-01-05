-- ============================================
-- 更新默认支付账户函数：只创建 Cash
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 更新创建默认支付账户的函数，只创建 Cash
CREATE OR REPLACE FUNCTION create_default_payment_accounts(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO payment_accounts (household_id, name, is_ai_recognized) VALUES
    (p_household_id, 'Cash', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_default_payment_accounts(UUID) TO authenticated;

