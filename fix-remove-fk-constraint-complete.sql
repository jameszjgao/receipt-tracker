-- ============================================
-- 彻底修复：移除 household_invitations.inviter_id 外键约束
-- 这是最彻底的修复方案，确保所有可能的问题都被解决
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：显示当前状态
SELECT '=== 修复前状态 ===' as info;

-- 检查外键约束
SELECT 
    '外键约束' as check_type,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 第二步：彻底移除外键约束（使用多种方法确保移除）
DO $$
DECLARE
    constraint_record RECORD;
    removed_count INTEGER := 0;
BEGIN
    -- 方法1：通过 information_schema 查找并移除
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
            EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.constraint_name);
            removed_count := removed_count + 1;
            RAISE NOTICE 'Removed foreign key constraint: %', constraint_record.constraint_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to remove constraint %: %', constraint_record.constraint_name, SQLERRM;
        END;
    END LOOP;
    
    -- 方法2：尝试常见的约束名称
    DECLARE
        common_names TEXT[] := ARRAY[
            'household_invitations_inviter_id_fkey',
            'household_invitations_inviter_id_users_id_fkey',
            'inviter_id_fkey',
            'fk_inviter_id',
            'fk_household_invitations_inviter_id'
        ];
        constraint_name TEXT;
    BEGIN
        FOREACH constraint_name IN ARRAY common_names
        LOOP
            BEGIN
                EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_name);
                IF FOUND THEN
                    removed_count := removed_count + 1;
                    RAISE NOTICE 'Removed constraint by common name: %', constraint_name;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- 忽略错误，继续尝试下一个
                NULL;
            END;
        END LOOP;
    END;
    
    IF removed_count = 0 THEN
        RAISE NOTICE 'No foreign key constraint found on inviter_id (may already be removed)';
    ELSE
        RAISE NOTICE 'Total removed: % foreign key constraint(s)', removed_count;
    END IF;
END $$;

-- 第三步：移除所有可能查询 users 表的触发器
DROP TRIGGER IF EXISTS validate_inviter_id_trigger ON household_invitations CASCADE;
DROP FUNCTION IF EXISTS validate_inviter_id() CASCADE;

-- 第四步：删除并重新创建 INSERT 策略（确保不查询 users 表）
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
    
    -- 创建简单的 INSERT 策略（完全不查询 users 表）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 邀请者必须是当前用户（直接比较，不查询 users 表）
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

-- 第五步：验证修复结果
SELECT '=== 修复后状态 ===' as info;

-- 验证外键约束已移除
SELECT 
    '外键约束检查' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 外键约束已移除'
        ELSE '❌ 仍有外键约束存在'
    END as status,
    COUNT(*) as remaining_count,
    STRING_AGG(tc.constraint_name, ', ') as constraint_names
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 验证触发器已移除
SELECT 
    '触发器检查' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 没有 INSERT 触发器'
        ELSE '⚠️  仍有 INSERT 触发器存在'
    END as status,
    COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations'
  AND event_manipulation = 'INSERT';

-- 验证 INSERT 策略
SELECT 
    'INSERT 策略检查' as check_type,
    policyname,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表'
        ELSE '⚠️  需要检查策略内容'
    END as status,
    with_check as policy_content
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 最终总结
SELECT 
    '=== 修复总结 ===' as info,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = 'household_invitations'
              AND kcu.column_name = 'inviter_id'
        ) = 0 
        AND (
            SELECT COUNT(*) 
            FROM pg_policies
            WHERE schemaname = 'public' 
              AND tablename = 'household_invitations'
              AND cmd = 'INSERT'
              AND with_check NOT LIKE '%users%'
        ) > 0
        THEN '✅ 修复完成！可以尝试创建邀请了'
        ELSE '⚠️  请检查上述诊断信息'
    END as final_status;

