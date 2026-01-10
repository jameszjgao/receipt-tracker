-- ============================================
-- 修复方案：将外键约束设置为 DEFERRABLE
-- 这样外键检查会在事务结束时进行，而不是在插入时立即进行
-- ============================================

-- 问题：外键约束检查在插入时立即执行，可能被 RLS 阻止
-- 解决方案：将外键约束设置为 DEFERRABLE INITIALLY DEFERRED

-- 1. 查找外键约束名称
DO $$
DECLARE
    fk_constraint_name TEXT;
BEGIN
    -- 查找 inviter_id 的外键约束
    SELECT conname INTO fk_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'household_invitations'::regclass
      AND confrelid = 'users'::regclass
      AND contype = 'f'
      AND array_length(conkey, 1) = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = 'household_invitations'::regclass AND attnum = conkey[1]) = 'inviter_id';
    
    IF fk_constraint_name IS NOT NULL THEN
        RAISE NOTICE '找到外键约束: %', fk_constraint_name;
        
        -- 删除旧的外键约束
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT %I', fk_constraint_name);
        RAISE NOTICE '已删除旧的外键约束';
        
        -- 创建新的 DEFERRABLE 外键约束
        EXECUTE format('ALTER TABLE household_invitations ADD CONSTRAINT %I FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED', fk_constraint_name);
        RAISE NOTICE '已创建新的 DEFERRABLE 外键约束';
    ELSE
        RAISE NOTICE '未找到 inviter_id 的外键约束，可能需要手动检查';
    END IF;
END $$;

-- 2. 验证修复
SELECT 
    '=== 验证修复 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    CASE 
        WHEN condeferrable THEN '✅ DEFERRABLE'
        ELSE '❌ NOT DEFERRABLE'
    END as deferrable_status,
    CASE 
        WHEN condeferred THEN 'DEFERRED'
        ELSE 'IMMEDIATE'
    END as deferred_status
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass
  AND confrelid = 'users'::regclass
  AND contype = 'f';

-- 3. 重要提示
SELECT 
    '=== 重要提示 ===' as section,
    '外键约束已设置为 DEFERRABLE INITIALLY DEFERRED' as status,
    '这意味着外键检查会在事务结束时进行，而不是在插入时立即进行' as explanation,
    '请确保在插入 household_invitations 时使用事务，并在事务中先确保 users 记录存在' as note;

