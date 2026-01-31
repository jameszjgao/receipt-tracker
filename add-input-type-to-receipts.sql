-- ============================================
-- 添加 input_type 字段到 receipts 表
-- 用于区分小票的提交方式：image（相机）、text（文字）、audio（语音）
-- ============================================

-- 添加 input_type 列
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'image';

-- 添加注释
COMMENT ON COLUMN receipts.input_type IS '提交方式：image（相机拍照）、text（文字输入）、audio（语音输入）';

-- 为现有数据设置默认值：有图片的设为 image，没图片的设为 text
UPDATE receipts SET input_type = 'image' WHERE image_url IS NOT NULL AND input_type IS NULL;
UPDATE receipts SET input_type = 'text' WHERE image_url IS NULL AND input_type IS NULL;
