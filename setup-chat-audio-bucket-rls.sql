-- ============================================
-- 设置 chat-audio bucket 的 RLS 策略
-- 允许已认证用户上传和读取音频文件
-- ============================================

-- 允许已认证用户上传文件
CREATE POLICY "Allow authenticated users to upload audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-audio');

-- 允许已认证用户读取文件
CREATE POLICY "Allow authenticated users to read audio"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-audio');

-- 允许公开读取（用于播放）
CREATE POLICY "Allow public to read audio"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-audio');

-- 允许用户删除自己上传的文件（可选）
CREATE POLICY "Allow users to delete own audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
