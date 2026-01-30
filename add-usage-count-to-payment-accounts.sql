-- 为 payment_accounts 表添加 usage_count 字段
-- 用于根据使用频率对支付账户进行排序，提高 AI 识别匹配率

-- 1. 为 payment_accounts 表添加 usage_count 字段
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. 创建函数：统计并更新所有 payment_accounts 的 usage_count
CREATE OR REPLACE FUNCTION update_all_payment_account_usage_counts()
RETURNS void AS $$
BEGIN
  UPDATE payment_accounts pa
  SET usage_count = COALESCE(counts.cnt, 0)
  FROM (
    SELECT payment_account_id, COUNT(*) as cnt
    FROM receipts
    WHERE payment_account_id IS NOT NULL
    GROUP BY payment_account_id
  ) counts
  WHERE pa.id = counts.payment_account_id;
  
  -- 将没有使用记录的账户设为0
  UPDATE payment_accounts
  SET usage_count = 0
  WHERE id NOT IN (
    SELECT DISTINCT payment_account_id FROM receipts WHERE payment_account_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 创建函数：增加单个 payment_account 的 usage_count
CREATE OR REPLACE FUNCTION increment_payment_account_usage(account_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE payment_accounts
  SET usage_count = usage_count + 1
  WHERE id = account_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建触发器函数：在 receipts 插入或更新 payment_account_id 时自动更新 usage_count
CREATE OR REPLACE FUNCTION update_payment_account_usage_on_receipt_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果是更新操作，且 payment_account_id 改变了
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_account_id IS DISTINCT FROM NEW.payment_account_id THEN
      -- 减少旧账户的计数
      IF OLD.payment_account_id IS NOT NULL THEN
        UPDATE payment_accounts SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.payment_account_id;
      END IF;
      -- 增加新账户的计数
      IF NEW.payment_account_id IS NOT NULL THEN
        UPDATE payment_accounts SET usage_count = usage_count + 1 WHERE id = NEW.payment_account_id;
      END IF;
    END IF;
  END IF;
  
  -- 如果是插入操作
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_account_id IS NOT NULL THEN
      UPDATE payment_accounts SET usage_count = usage_count + 1 WHERE id = NEW.payment_account_id;
    END IF;
  END IF;
  
  -- 如果是删除操作
  IF TG_OP = 'DELETE' THEN
    IF OLD.payment_account_id IS NOT NULL THEN
      UPDATE payment_accounts SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.payment_account_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS trigger_update_payment_account_usage ON receipts;
CREATE TRIGGER trigger_update_payment_account_usage
  AFTER INSERT OR UPDATE OR DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_account_usage_on_receipt_change();

-- 6. 初始化现有数据的 usage_count
SELECT update_all_payment_account_usage_counts();

-- 7. 创建索引以优化排序查询
CREATE INDEX IF NOT EXISTS idx_payment_accounts_usage_count ON payment_accounts(space_id, usage_count DESC);
