-- ============================================
-- 修复 Supabase Storage RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 重要：Supabase Storage 也有 RLS 策略！
-- Storage 的策略存储在 storage.policies 表中，需要通过 Storage API 或 Dashboard 配置
-- 但也可以通过 SQL 直接操作 storage.objects 表（需要特殊权限）

-- 方法 1：通过 Dashboard 配置（推荐）
-- 1. 打开 Supabase Dashboard
-- 2. 进入 Storage
-- 3. 选择 "receipts" bucket
-- 4. 点击 "Policies" 标签
-- 5. 创建以下策略：

-- 策略 1：允许已认证用户上传文件
-- Policy Name: Allow authenticated users to upload files
-- Allowed operation: INSERT
-- Policy definition:
-- (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)

-- 策略 2：允许已认证用户查看文件
-- Policy Name: Allow authenticated users to view files
-- Allowed operation: SELECT
-- Policy definition:
-- (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)

-- 策略 3：允许已认证用户更新自己的文件
-- Policy Name: Allow authenticated users to update files
-- Allowed operation: UPDATE
-- Policy definition:
-- (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)

-- 策略 4：允许已认证用户删除自己的文件
-- Policy Name: Allow authenticated users to delete files
-- Allowed operation: DELETE
-- Policy definition:
-- (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)

-- ============================================
-- 方法 2：通过 SQL 直接配置（如果方法 1 不行）
-- ============================================

-- 注意：这需要超级用户权限，通常只能在 Supabase 内部使用
-- 如果上面的 Dashboard 方法不行，尝试下面的 SQL

-- 首先检查 bucket 是否存在
SELECT * FROM storage.buckets WHERE name = 'receipts';

-- 如果 bucket 不存在，创建它（但通常应该已经存在）
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('receipts', 'receipts', true)
-- ON CONFLICT (id) DO NOTHING;

-- 检查现有的 Storage 策略
SELECT 
    policyname,
    bucketname,
    operation,
    definition,
    check_expression
FROM storage.policies
WHERE bucketname = 'receipts';

-- 删除现有的策略（如果有）
DELETE FROM storage.policies WHERE bucketname = 'receipts';

-- 创建新的策略（注意：这些 SQL 可能需要调整权限）
-- 策略：允许已认证用户上传
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES (
--     'Allow authenticated uploads',
--     'receipts',
--     'INSERT',
--     'auth.role() = ''authenticated'''
-- );

-- 策略：允许已认证用户查看
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES (
--     'Allow authenticated select',
--     'receipts',
--     'SELECT',
--     'auth.role() = ''authenticated'''
-- );

-- 策略：允许已认证用户更新
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES (
--     'Allow authenticated update',
--     'receipts',
--     'UPDATE',
--     'auth.role() = ''authenticated'''
-- );

-- 策略：允许已认证用户删除
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES (
--     'Allow authenticated delete',
--     'receipts',
--     'DELETE',
--     'auth.role() = ''authenticated'''
-- );

-- ============================================
-- 推荐的配置步骤（使用 Dashboard）
-- ============================================
-- 1. 打开 Supabase Dashboard
-- 2. 点击左侧菜单的 "Storage"
-- 3. 找到 "receipts" bucket
-- 4. 点击 bucket 名称进入详情
-- 5. 点击 "Policies" 标签
-- 6. 点击 "New Policy"
-- 7. 选择 "For full customization" 或 "Create a policy from scratch"
-- 8. 为每个操作（INSERT, SELECT, UPDATE, DELETE）创建策略
-- 9. 策略表达式使用：bucket_id = 'receipts' AND auth.role() = 'authenticated'

