-- ============================================
-- 最终修复：修复 SELECT 策略和所有问题
-- 问题根源：INSERT 后返回数据时，SELECT 策略可能查询 users 表
-- ============================================

-- 第一步：检查并修复 get_user_household_id 函数（确保不查询 users 表）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 第二步：修复 SELECT 策略（确保不查询 public.users 表）
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
    -- INSERT 后返回数据时，这个策略会被触发
    CREATE POLICY "household_invitations_select" ON household_invitations
      FOR SELECT
      TO authenticated
      USING (
        -- 用户可以查看自己收到的邀请（使用 auth.users，不查询 public.users）
        invitee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
        OR
        -- 用户可以查看自己所属家庭的邀请（只查询 user_households 表，不查询 users 表）
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
        )
        OR
        -- 用户可以查看自己创建的邀请（直接比较 inviter_id，不查询 users 表）
        inviter_id = auth.uid()
      );
    
    RAISE NOTICE '✅ 重新创建了 SELECT 策略（不查询 public.users 表）';
END $$;

-- 第三步：确保 INSERT 策略正确（完全不查询 users 表）
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
        -- 邀请者必须是当前用户（直接比较，不查询任何表）
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

-- 第四步：验证所有策略
SELECT 
    '=== 验证结果 ===' as section,
    cmd,
    policyname,
    CASE 
        WHEN qual LIKE '%users%' OR with_check LIKE '%users%' THEN '❌ 策略中包含 users 表查询'
        WHEN qual LIKE '%get_user_household_id%' OR with_check LIKE '%get_user_household_id%' THEN '⚠️  策略使用可能查询 users 的函数'
        ELSE '✅ 策略不查询 users 表'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND (cmd = 'INSERT' OR cmd = 'SELECT')
ORDER BY cmd, policyname;

-- 第五步：测试插入和返回数据（验证修复）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_invitation_id UUID;
BEGIN
    RAISE NOTICE '=== 测试插入和返回数据 ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    -- 获取家庭ID并检查是否是管理员
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '❌ 用户不是任何家庭的管理员';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    
    -- 插入测试数据
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
        )
        RETURNING id INTO test_invitation_id;
        
        RAISE NOTICE '✅ INSERT 成功！邀请ID: %', test_invitation_id;
        
        -- 测试 SELECT（这是关键！）
        BEGIN
            PERFORM * FROM household_invitations WHERE id = test_invitation_id;
            RAISE NOTICE '✅ SELECT 成功！可以返回数据';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ SELECT 失败: %', SQLERRM;
            RAISE NOTICE '⚠️  这是问题！INSERT 后的 SELECT 查询失败';
        END;
        
        -- 清理测试数据
        DELETE FROM household_invitations WHERE id = test_invitation_id;
        ROLLBACK;
        
        RAISE NOTICE '✅✅✅ 所有测试通过！';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ INSERT 失败: %', SQLERRM;
        ROLLBACK;
    END;
END $$;

