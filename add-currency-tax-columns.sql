-- 添加 currency 和 tax 字段到 receipts 表
-- 在 Supabase SQL Editor 中执行此脚本

-- 添加 currency 字段（币种，如：CNY、USD）
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS currency TEXT;

-- 添加 tax 字段（税费）
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2);

-- 添加注释
COMMENT ON COLUMN receipts.currency IS '币种，如：CNY、USD';
COMMENT ON COLUMN receipts.tax IS '税费金额';

