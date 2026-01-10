-- ============================================
-- 在 household_invitations 表中添加 household_name 字段
-- 用于简化数据库查询，避免关联查询 households 表
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：添加 household_name 字段
ALTER TABLE household_invitations
ADD COLUMN IF NOT EXISTS household_name TEXT;

-- 第二步：为现有记录填充 household_name（如果有的话）
UPDATE household_invitations hi
SET household_name = (
  SELECT h.name 
  FROM households h 
  WHERE h.id = hi.household_id
)
WHERE household_name IS NULL
  AND EXISTS (
    SELECT 1 FROM households h WHERE h.id = hi.household_id
  );

-- 第三步：创建索引以提高查询性能（如果需要按家庭名称查询）
CREATE INDEX IF NOT EXISTS idx_household_invitations_household_name 
ON household_invitations(household_name);

-- 第四步：验证字段已添加
SELECT 
    '✅ Column added' as status,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'household_invitations'
  AND column_name = 'household_name';

-- 第五步：验证数据填充情况
SELECT 
    '✅ Data check' as status,
    COUNT(*) as total_invitations,
    COUNT(household_name) as invitations_with_name,
    COUNT(*) - COUNT(household_name) as invitations_without_name
FROM household_invitations;

