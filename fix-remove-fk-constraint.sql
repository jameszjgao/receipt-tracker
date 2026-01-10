-- ============================================
-- 移除 household_invitations.inviter_id 外键约束
-- 解决 RLS 与外键约束检查冲突问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：检查当前的外键约束
SELECT 
    '当前外键约束' as info,
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 第二步：移除外键约束（彻底移除所有相关的外键约束）
-- 注意：外键约束名称可能不同，需要查找所有相关约束
DO $$
DECLARE
    constraint_record RECORD;
    removed_count INTEGER := 0;
BEGIN
    -- 查找所有 inviter_id 相关的外键约束
    FOR constraint_record IN
        SELECT DISTINCT tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'household_invitations'
          AND kcu.column_name = 'inviter_id'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
            removed_count := removed_count + 1;
            RAISE NOTICE 'Removed foreign key constraint: %', constraint_record.constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to remove constraint %: %', constraint_record.constraint_name, SQLERRM;
        END;
    END LOOP;
    
    IF removed_count = 0 THEN
        RAISE NOTICE 'No foreign key constraint found on inviter_id';
    ELSE
        RAISE NOTICE 'Removed % foreign key constraint(s)', removed_count;
    END IF;
END $$;

-- 第三步：验证外键约束已移除
SELECT 
    '验证：外键约束已移除' as info,
    COUNT(*) as remaining_fk_constraints
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 第四步：移除所有可能查询 users 表的触发器
-- 注意：业务逻辑上 inviter_id 总是等于 auth.uid()，不需要触发器验证
DROP TRIGGER IF EXISTS validate_inviter_id_trigger ON household_invitations;
DROP FUNCTION IF EXISTS validate_inviter_id();

-- 验证触发器已移除
SELECT 
    '✅ 触发器检查' as status,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 没有 INSERT 触发器（正确）'
        ELSE '⚠️  仍有 INSERT 触发器存在'
    END as result,
    COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'household_invitations'
  AND event_manipulation = 'INSERT';

-- 第六步：简化 household_invitations 的 INSERT 策略
-- 现在不需要外键约束检查，策略可以更简单
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有现有的 household_invitations INSERT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
    END LOOP;
    
    -- 创建简单的 INSERT 策略（不查询 users 表）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 邀请者必须是当前用户
        inviter_id = auth.uid()
        AND
        -- 用户必须是该家庭的管理员（只查询 user_households 表）
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE 'Created simplified household_invitations INSERT policy';
END $$;

-- 第七步：验证策略已创建
SELECT 
    '✅ household_invitations INSERT policy' as status,
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第八步：最终诊断 - 检查所有可能的问题
SELECT 
    '🔍 诊断信息' as section,
    '外键约束检查' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 外键约束已移除'
        ELSE '❌ 仍有外键约束存在'
    END as status,
    COUNT(*) as constraint_count
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

SELECT 
    '🔍 诊断信息' as section,
    'INSERT 策略检查' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ INSERT 策略已创建'
        ELSE '❌ 没有 INSERT 策略'
    END as status,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

SELECT 
    '🔍 诊断信息' as section,
    'INSERT 策略内容检查' as check_type,
    CASE 
        WHEN with_check LIKE '%users%' THEN '⚠️  策略中包含 users 表查询（可能有问题）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查策略内容'
    END as status,
    with_check as policy_content
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
LIMIT 1;

