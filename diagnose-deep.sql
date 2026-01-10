-- ============================================
-- 深度诊断：找出所有可能查询 users 表的地方
-- ============================================

-- 1. 检查所有外键约束（包括可能被忽略的）
SELECT 
    '外键约束（所有）' as check_type,
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'household_invitations';

-- 2. 检查所有触发器
SELECT 
    '触发器（所有）' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'household_invitations';

-- 3. 检查所有函数（可能被触发器调用）
SELECT 
    '函数定义' as check_type,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%users%'
  AND routine_definition LIKE '%household_invitations%';

-- 4. 检查 INSERT 策略的详细内容
SELECT 
    'INSERT 策略详情' as check_type,
    policyname,
    cmd,
    qual as using_clause,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' OR qual LIKE '%users%' THEN '❌ 包含 users 表'
        ELSE '✅ 不包含 users 表'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 5. 检查表定义中的约束
SELECT 
    '表约束' as check_type,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'household_invitations'::regclass;

-- 6. 尝试直接插入测试（使用当前用户）
-- 注意：这会失败，但错误信息可能更详细
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
BEGIN
    -- 获取当前用户ID
    test_user_id := auth.uid();
    
    -- 获取用户的家庭ID
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
    LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No authenticated user';
        RETURN;
    END IF;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE 'User has no household';
        RETURN;
    END IF;
    
    -- 尝试插入（这会触发所有检查）
    BEGIN
        INSERT INTO household_invitations (
            household_id,
            inviter_id,
            inviter_email,
            invitee_email,
            token,
            expires_at
        ) VALUES (
            test_household_id,
            test_user_id,
            'test@example.com',
            'test@example.com',
            'test-token-' || gen_random_uuid()::text,
            NOW() + INTERVAL '7 days'
        );
        RAISE NOTICE '✅ 插入成功！';
        -- 回滚测试数据
        ROLLBACK;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ 插入失败: %', SQLERRM;
        RAISE NOTICE '错误代码: %', SQLSTATE;
    END;
END $$;

