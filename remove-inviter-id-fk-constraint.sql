-- ============================================
-- 移除 household_invitations.inviter_id 的外键约束
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- 问题：外键约束检查时访问 users 表被 RLS 阻止
-- 解决方案：移除外键约束，在应用层保证 inviter_id 的正确性
-- 应用层保证：inviter_id 总是等于 auth.uid()，这是可靠的

-- ============================================
-- 第一步：查找并删除外键约束
-- ============================================

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
      AND (SELECT attname FROM pg_attribute 
           WHERE attrelid = 'household_invitations'::regclass 
           AND attnum = conkey[1]) = 'inviter_id';
    
    IF fk_constraint_name IS NOT NULL THEN
        RAISE NOTICE '找到外键约束: %', fk_constraint_name;
        
        -- 删除外键约束
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT %I', fk_constraint_name);
        RAISE NOTICE '✅ 已删除外键约束: %', fk_constraint_name;
    ELSE
        RAISE NOTICE '⚠️  未找到 inviter_id 的外键约束，可能已经删除或不存在';
    END IF;
END $$;

-- ============================================
-- 第二步：验证外键约束已删除
-- ============================================

SELECT 
    '=== 验证外键约束 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_constraint
            WHERE conrelid = 'household_invitations'::regclass
              AND confrelid = 'users'::regclass
              AND contype = 'f'
              AND array_length(conkey, 1) = 1
              AND (SELECT attname FROM pg_attribute 
                   WHERE attrelid = 'household_invitations'::regclass 
                   AND attnum = conkey[1]) = 'inviter_id'
        ) THEN '❌ 外键约束仍然存在'
        ELSE '✅ 外键约束已成功删除'
    END as status;

-- ============================================
-- 第三步：显示当前的外键约束（用于确认）
-- ============================================

SELECT 
    '=== 当前 household_invitations 表的外键约束 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass;

-- ============================================
-- 第四步：重要提示
-- ============================================

SELECT 
    '=== 重要提示 ===' as section,
    '外键约束已移除，现在插入 household_invitations 时不会验证 inviter_id 是否存在于 users 表' as status,
    '应用层保证：inviter_id 总是等于 auth.uid()，这是可靠的' as note1,
    '请测试创建邀请功能，应该不再出现权限错误' as test_note;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 外键约束移除完成！' as result;

