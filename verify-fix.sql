-- ============================================
-- 验证修复是否完整
-- 执行此脚本确认所有修复都已生效
-- ============================================

-- 验证 1: get_user_household_id 函数是否已修复
SELECT 
    '=== 验证 1: get_user_household_id 函数 ===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%' THEN '❌ 仍然查询 users 表（未修复！）'
        WHEN routine_definition LIKE '%FROM user_households%' THEN '✅ 只查询 user_households 表（已修复）'
        ELSE '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 验证 2: INSERT 策略是否正确
SELECT 
    '=== 验证 2: INSERT 策略 ===' as section,
    policyname,
    CASE 
        WHEN with_check LIKE '%users%' THEN '❌ 仍然查询 users 表'
        WHEN with_check LIKE '%get_user_household_id%' THEN '⚠️  使用 get_user_household_id 函数（需要确认函数已修复）'
        WHEN with_check LIKE '%user_households%' THEN '✅ 只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查'
    END as status,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 验证 3: 外键约束确认已移除
SELECT 
    '=== 验证 3: 外键约束 ===' as section,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 没有 inviter_id 的外键约束（正确）'
        ELSE '❌ 仍有外键约束存在'
    END as status,
    COUNT(*) as constraint_count
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';

-- 总结
SELECT 
    '=== 修复总结 ===' as section,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'get_user_household_id'
              AND routine_definition NOT LIKE '%FROM users%'
              AND routine_definition NOT LIKE '%JOIN users%'
        ) > 0
        AND (
            SELECT COUNT(*) 
            FROM pg_policies
            WHERE schemaname = 'public' 
              AND tablename = 'household_invitations'
              AND cmd = 'INSERT'
              AND with_check NOT LIKE '%users%'
        ) > 0
        AND (
            SELECT COUNT(*) 
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = 'household_invitations'
              AND kcu.column_name = 'inviter_id'
        ) = 0
        THEN '✅ 所有修复都已完成！可以测试了'
        ELSE '⚠️  可能还有问题，请检查上述验证结果'
    END as final_status;

