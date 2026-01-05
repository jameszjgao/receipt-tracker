-- 添加用户名字字段
-- 在 Supabase SQL Editor 中执行此脚本

-- 添加 name 字段到 users 表
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- 可选：为现有用户设置默认名字（使用邮箱前缀）
UPDATE users 
SET name = split_part(email, '@', 1)
WHERE name IS NULL OR name = '';

