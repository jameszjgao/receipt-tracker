-- ============================================
-- 诊断 household_invitations 插入权限问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：检查外键约束
SELECT 
    '🔍 外键约束检查' as section,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 外键约束已移除'
        ELSE '❌ 仍有外键约束存在（这是问题根源！）'
    END as status,
    COUNT(*) as constraint_count,
    STRING_AGG(tc.constraint_name, ', ') as constraint_names
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 第二步：检查触发器
SELECT 
    '🔍 触发器检查' as section,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'household_invitations'
  AND event_manipulation = 'INSERT'
ORDER BY trigger_name;

-- 第三步：检查 INSERT 策略
SELECT 
    '🔍 INSERT 策略检查' as section,
    policyname,
    cmd,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询（有问题！）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 策略只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查策略内容'
    END as status,
    with_check as policy_content
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第四步：检查 users 表的 SELECT 策略
SELECT 
    '🔍 users 表 SELECT 策略检查' as section,
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT';

-- 第五步：显示所有可能查询 users 表的地方
SELECT 
    '🔍 所有可能查询 users 表的地方' as section,
    'household_invitations INSERT 策略' as source,
    with_check as query_content
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
  AND with_check LIKE '%users%'
UNION ALL
SELECT 
    '🔍 所有可能查询 users 表的地方' as section,
    '触发器函数: ' || trigger_name as source,
    action_statement as query_content
FROM information_schema.triggers
WHERE event_object_table = 'household_invitations'
  AND action_statement LIKE '%users%';

