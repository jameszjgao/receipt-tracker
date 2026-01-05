-- 创建支付账户合并历史记录表
-- 用于记录用户手动合并的账户，以便后续AI识别时自动归并

CREATE TABLE IF NOT EXISTS payment_account_merge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_account_name TEXT NOT NULL, -- 被合并的账户名称（原始名称）
  target_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
  merged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_household_id ON payment_account_merge_history(household_id);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_source_name ON payment_account_merge_history(household_id, source_account_name);
CREATE INDEX IF NOT EXISTS idx_payment_account_merge_history_target_id ON payment_account_merge_history(target_account_id);

-- 启用 Row Level Security (RLS)
ALTER TABLE payment_account_merge_history ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能访问自己家庭的合并历史
CREATE POLICY "Users can manage merge history in their household" ON payment_account_merge_history
  FOR ALL USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

