-- ============================================
-- 为 ai_chat_logs 表添加 audio_url 字段
-- 用于存储语音录入的录音文件 URL
-- ============================================

-- 添加 audio_url 字段
ALTER TABLE ai_chat_logs
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 添加注释
COMMENT ON COLUMN ai_chat_logs.audio_url IS '语音录入时的录音文件 URL（存储在 Supabase Storage）';

-- 验证字段已添加
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_chat_logs' AND column_name = 'audio_url';
