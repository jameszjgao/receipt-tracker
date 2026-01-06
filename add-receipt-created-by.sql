-- 添加 receipts 表的 created_by 字段
-- 在 Supabase SQL Editor 中执行此脚本

-- 添加 created_by 字段（引用 users 表的 id）
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 为现有小票设置 created_by（如果有用户信息）
-- 注意：这个更新只会为有用户信息的小票设置 created_by
-- 对于没有用户信息的历史小票，created_by 将保持为 NULL
UPDATE receipts r
SET created_by = (
  SELECT u.id 
  FROM users u 
  WHERE u.household_id = r.household_id 
  LIMIT 1
)
WHERE r.created_by IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON receipts(created_by);

-- 更新 RLS 策略以允许查询 created_by 关联的用户信息
-- 注意：RLS 策略已经通过 household_id 控制访问，created_by 字段不需要额外的策略

