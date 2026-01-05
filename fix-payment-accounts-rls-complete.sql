-- 修复 payment_accounts 表的 RLS 策略和 RPC 函数，允许新创建的家庭插入默认支付账户
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 确保 RPC 函数使用 SECURITY DEFINER 来绕过 RLS
CREATE OR REPLACE FUNCTION create_default_payment_accounts(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO payment_accounts (household_id, name, is_ai_recognized) VALUES
    (p_household_id, 'Cash', true),
    (p_household_id, 'Credit Card', true),
    (p_household_id, 'Debit Card', true),
    (p_household_id, 'Alipay', true),
    (p_household_id, 'WeChat Pay', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 同样确保 create_default_categories 使用 SECURITY DEFINER
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

-- 3. 删除现有的 payment_accounts 策略（如果存在）
DROP POLICY IF EXISTS "Users can manage payment accounts in their household" ON payment_accounts;
DROP POLICY IF EXISTS "payment_accounts_manage_policy" ON payment_accounts;

-- 4. 重新创建策略，使用 user_households 表来检查用户是否属于该家庭
CREATE POLICY "Users can manage payment accounts in their household" ON payment_accounts
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = payment_accounts.household_id
      AND user_households.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = payment_accounts.household_id
      AND user_households.user_id = auth.uid()
    )
  );

-- 5. 同样更新 categories 表的策略
DROP POLICY IF EXISTS "Users can manage categories in their household" ON categories;
DROP POLICY IF EXISTS "categories_manage_policy" ON categories;

CREATE POLICY "Users can manage categories in their household" ON categories
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = categories.household_id
      AND user_households.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = categories.household_id
      AND user_households.user_id = auth.uid()
    )
  );

-- 验证策略是否创建成功
SELECT 
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('payment_accounts', 'categories')
ORDER BY tablename, policyname;

