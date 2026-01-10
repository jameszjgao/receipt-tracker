-- ============================================
-- 修改 household_invitations 表，让三个字段可以为 NULL
-- 这样可以在插入时不提供这些字段，然后通过 UPDATE 更新
-- ============================================

-- 修改 inviter_email 字段：允许 NULL
ALTER TABLE household_invitations 
  ALTER COLUMN inviter_email DROP NOT NULL;

-- 修改 expires_at 字段：允许 NULL，并设置默认值
ALTER TABLE household_invitations 
  ALTER COLUMN expires_at DROP NOT NULL;

-- 修改 token 字段：允许 NULL（但保持 UNIQUE 约束）
-- 注意：token 需要保持 UNIQUE，但可以为 NULL（多个 NULL 值不违反 UNIQUE 约束）
ALTER TABLE household_invitations 
  ALTER COLUMN token DROP NOT NULL;

-- 验证修改
SELECT 
    '=== 验证字段修改 ===' as section,
    column_name,
    is_nullable,
    column_default,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'household_invitations'
  AND column_name IN ('inviter_email', 'expires_at', 'token')
ORDER BY column_name;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 字段已修改为允许 NULL' as result;

