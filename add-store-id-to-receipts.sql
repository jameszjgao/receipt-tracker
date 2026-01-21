-- 在 receipts 表中添加 store_id 字段
-- 用于关联商家信息

-- 添加 store_id 字段（允许为空，以便兼容现有数据）
ALTER TABLE receipts 
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_receipts_store_id ON receipts(store_id);
