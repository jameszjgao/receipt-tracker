-- 修改 users.household_id 为可空，以支持多家庭系统
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：此脚本需要在 multi-household-migration.sql 之后执行

-- 1. 将 household_id 字段改为可空
ALTER TABLE users ALTER COLUMN household_id DROP NOT NULL;

-- 2. 移除外键约束（如果需要）
-- 注意：由于我们保留了 household_id 用于向后兼容，我们保留外键约束
-- 但如果需要允许 NULL 值，我们可以将外键约束改为 ON DELETE SET NULL
-- 这里我们保持原样，因为即使字段可空，外键约束仍然可以存在（只要值存在时就验证）

-- 3. 确认修改
-- 可以运行以下查询来确认字段现在可以为 NULL：
-- SELECT column_name, is_nullable, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'household_id';

