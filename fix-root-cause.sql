-- ============================================
-- 修复根本原因：get_user_household_id 函数查询 users 表
-- 这是导致 "permission denied for table users" 错误的根本原因
-- ============================================

-- 第一步：检查 INSERT 策略是否使用了 get_user_household_id 函数
SELECT 
    '=== 检查 INSERT 策略是否使用 get_user_household_id ===' as section,
    policyname,
    with_check,
    CASE 
        WHEN with_check LIKE '%get_user_household_id%' THEN '❌ 使用了 get_user_household_id 函数（这是问题！）'
        ELSE '✅ 没有使用 get_user_household_id 函数'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第二步：修复 get_user_household_id 函数（完全不查询 users 表）
-- 只从 user_households 表获取，不查询 users 表
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 验证函数已修复
SELECT 
    '=== 验证函数已修复 ===' as section,
    routine_name,
    routine_definition,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%'
          OR routine_definition LIKE '%public.users%' THEN '❌ 仍然查询 users 表'
        ELSE '✅ 不查询 users 表（已修复）'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 第三步：重新创建 INSERT 策略（确保不查询 users 表）
-- 如果策略使用了 get_user_household_id 函数，现在应该可以正常工作了
-- 但为了保险，我们重新创建一个完全不依赖 users 表的策略
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
    
    -- 创建新的 INSERT 策略（完全不查询 users 表）
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
    
    RAISE NOTICE '✅ 重新创建了 INSERT 策略（不查询 users 表）';
END $$;

-- 第四步：验证策略已创建且不查询 users 表
SELECT 
    '=== 验证 INSERT 策略 ===' as section,
    policyname,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' OR with_check LIKE '%get_user_household_id%' THEN '❌ 仍然查询 users 表或使用可能查询 users 的函数'
        WHEN with_check LIKE '%user_households%' THEN '✅ 只查询 user_households 表（正确）'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第五步：测试插入（验证修复是否成功）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    admin_check BOOLEAN;
BEGIN
    RAISE NOTICE '=== 测试插入（验证修复）===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    -- 获取家庭ID并检查是否是管理员
    SELECT household_id, is_admin INTO test_household_id, admin_check
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '❌ 用户不是任何家庭的管理员';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    RAISE NOTICE '准备插入测试数据...';
    
    -- 尝试插入
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
        RAISE NOTICE '✅✅✅ 插入成功！问题已修复！';
        ROLLBACK; -- 回滚测试数据
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ 插入仍然失败: %', SQLERRM;
        RAISE NOTICE '错误代码: %', SQLSTATE;
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE '⚠️  仍然是权限错误，可能还有其他问题';
        END IF;
    END;
END $$;

