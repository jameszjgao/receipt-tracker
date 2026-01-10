-- ============================================
-- 正确修复 RLS 问题 - 不使用绕过方法
-- 深入分析并修复 INSERT 策略，确保不查询 users 表
-- ============================================

-- 第一步：完全检查并修复 get_user_household_id 函数
-- 确保它完全不查询 users 表
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  -- 这是关键：必须在函数级别避免查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 验证函数定义
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'get_user_household_id'
          AND routine_definition LIKE '%FROM users%'
    ) THEN
        RAISE EXCEPTION 'get_user_household_id 函数仍然查询 users 表！必须修复！';
    ELSE
        RAISE NOTICE '✅ get_user_household_id 函数已正确修复（不查询 users 表）';
    END IF;
END $$;

-- 第二步：完全删除并重新创建 INSERT 策略
-- 关键：WITH CHECK 子句中的任何查询都必须不涉及 users 表
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
        RAISE NOTICE '✅ 删除了旧策略: %', r.policyname;
    END LOOP;
    
    -- 创建新的 INSERT 策略（完全不查询 users 表）
    -- 策略逻辑：
    -- 1. inviter_id 必须是当前用户（直接比较，不查询任何表）
    -- 2. 用户必须是该家庭的管理员（只查询 user_households 表，不查询 users 表）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 第一部分：邀请者必须是当前用户（直接比较，不查询任何表）
        inviter_id = auth.uid()
        AND
        -- 第二部分：用户必须是该家庭的管理员（只查询 user_households 表）
        -- 关键：不使用 get_user_household_id() 函数，直接查询 user_households
        -- 这样可以确保不查询 users 表
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE '✅ 重新创建了 INSERT 策略（完全不查询 users 表）';
END $$;

-- 第三步：确保 SELECT 策略正确（不查询 public.users 表）
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有现有的 household_invitations SELECT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
    END LOOP;
    
    -- 创建新的 SELECT 策略（完全不查询 public.users 表）
    CREATE POLICY "household_invitations_select" ON household_invitations
      FOR SELECT
      TO authenticated
      USING (
        -- 用户可以查看自己收到的邀请（使用 auth.users，不查询 public.users）
        invitee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
        OR
        -- 用户可以查看自己所属家庭的邀请（只查询 user_households 表）
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
        )
        OR
        -- 用户可以查看自己创建的邀请（直接比较 inviter_id，不查询任何表）
        inviter_id = auth.uid()
      );
    
    RAISE NOTICE '✅ 重新创建了 SELECT 策略（不查询 public.users 表）';
END $$;

-- 第四步：验证策略定义（检查是否仍然查询 users 表）
SELECT 
    '=== INSERT 策略验证 ===' as section,
    policyname,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' 
          OR with_check LIKE '%FROM users%' 
          OR with_check LIKE '%JOIN users%'
          OR with_check LIKE '%public.users%'
          OR with_check LIKE '%get_user_household_id%' THEN 
            '❌ 策略中包含 users 表查询或使用了可能查询 users 的函数！'
        WHEN with_check LIKE '%user_households%' THEN 
            '✅ 策略只查询 user_households 表（正确）'
        ELSE 
            '⚠️  需要检查策略内容'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第五步：测试 INSERT 策略（实际执行测试）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_invitation_id UUID;
    test_email TEXT;
    test_token TEXT;
BEGIN
    RAISE NOTICE '=== 开始测试 INSERT 策略 ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '当前用户 ID: %', test_user_id;
    
    -- 获取用户的 email（从 auth.users，不是 public.users）
    SELECT email INTO test_email
    FROM auth.users
    WHERE id = test_user_id;
    
    IF test_email IS NULL THEN
        RAISE NOTICE '❌ 无法获取用户 email';
        RETURN;
    END IF;
    
    RAISE NOTICE '用户 email: %', test_email;
    
    -- 获取用户的家庭 ID（从 user_households 表）
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '⚠️  用户不是任何家庭的管理员，无法测试 INSERT';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    
    -- 生成测试 token
    test_token := 'test-token-' || gen_random_uuid()::text;
    
    -- 尝试插入（这会触发 INSERT 策略）
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
            test_email,
            'test-invitee@example.com',
            test_token,
            NOW() + INTERVAL '7 days'
        )
        RETURNING id INTO test_invitation_id;
        
        RAISE NOTICE '✅✅✅ INSERT 成功！邀请 ID: %', test_invitation_id;
        
        -- 清理测试数据
        DELETE FROM household_invitations WHERE id = test_invitation_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌❌❌ INSERT 失败！';
        RAISE NOTICE '错误代码: %', SQLSTATE;
        RAISE NOTICE '错误信息: %', SQLERRM;
        RAISE NOTICE '错误详情: %', SQLERRM;
        
        -- 如果是 permission denied 错误，说明策略仍然在查询 users 表
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%users%' THEN
            RAISE NOTICE '❌❌❌ 这是权限错误，说明 INSERT 策略仍然在查询 users 表！';
            RAISE NOTICE '需要检查策略定义，确保不查询 users 表';
        END IF;
    END;
END $$;

-- 第六步：最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    'INSERT 策略' as policy_type,
    policyname,
    '✅ 策略已创建' as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'

UNION ALL

SELECT 
    '=== 最终验证结果 ===' as section,
    'SELECT 策略' as policy_type,
    policyname,
    '✅ 策略已创建' as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'SELECT'

UNION ALL

SELECT 
    '=== 最终验证结果 ===' as section,
    'get_user_household_id 函数' as policy_type,
    routine_name as policyname,
    CASE 
        WHEN routine_definition LIKE '%FROM users%' 
          OR routine_definition LIKE '%JOIN users%' THEN 
            '❌ 函数仍然查询 users 表'
        ELSE 
            '✅ 函数不查询 users 表'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

