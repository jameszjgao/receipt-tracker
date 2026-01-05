-- 启用 receipts 表的 Realtime 功能
-- 在 Supabase SQL Editor 中执行此脚本

-- 将 receipts 表添加到 Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE receipts;

-- 验证是否已启用（可选，用于检查）
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' AND tablename = 'receipts';

