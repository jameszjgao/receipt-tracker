-- ============================================
-- 彻底修复：确保 INSERT 策略完全不查询 users 表
-- 移除所有可能查询 users 表的来源
-- ============================================

-- 第一步：完全移除所有外键约束指向 users 表（如果存在）
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== 检查并移除外键约束 ===';
    
    FOR r IN (
        SELECT 
            tc.constraint_name,
            tc.table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'household_invitations'
          AND ccu.table_name = 'users'
    ) LOOP
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
        RAISE NOTICE '✅ 删除了外键约束: %', r.constraint_name;
    END LOOP;
    
    RAISE NOTICE '✅ 外键约束检查完成';
END $$;

-- 第二步：确保 get_user_household_id 函数不查询 users 表（完全避免）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 第三步：完全删除并重新创建 INSERT 策略（确保不查询 users 表）
DO $$
DECLARE
    r RECORD;
    policy_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== 删除所有现有的 INSERT 策略 ===';
    
    -- 删除所有现有的 household_invitations INSERT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
          AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
        RAISE NOTICE '✅ 删除了策略: %', r.policyname;
        policy_count := policy_count + 1;
    END LOOP;
    
    IF policy_count = 0 THEN
        RAISE NOTICE '⚠️  没有找到现有的 INSERT 策略';
    END IF;
    
    RAISE NOTICE '=== 创建新的 INSERT 策略（完全不查询 users 表） ===';
    
    -- 创建新的 INSERT 策略：只查询 user_households 表，不查询 users 表
    -- 完全不使用 get_user_household_id() 函数（避免任何可能的 users 表查询）
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 条件 1：邀请者必须是当前用户（直接比较，不查询任何表）
        inviter_id = auth.uid()
        AND
        -- 条件 2：用户必须是该家庭的管理员（只查询 user_households 表，不查询 users 表）
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE '✅ 创建了新的 INSERT 策略（只查询 user_households 表）';
    
    -- 验证策略确实创建了
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'household_invitations'
      AND cmd = 'INSERT';
    
    IF policy_count > 0 THEN
        RAISE NOTICE '✅ 验证：INSERT 策略已成功创建';
    ELSE
        RAISE EXCEPTION '❌ 验证失败：INSERT 策略未创建';
    END IF;
END $$;

-- 第四步：确保 users 表的 SELECT 策略允许查询（以防万一）
DO $$
DECLARE
    r RECORD;
    has_select_policy BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '=== 确保 users 表的 SELECT 策略允许查询 ===';
    
    -- 检查是否有允许查询的 SELECT 策略
    FOR r IN (
        SELECT policyname, qual
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'SELECT'
    ) LOOP
        IF r.qual LIKE '%id = auth.uid()%' OR r.qual LIKE '%auth.uid()%' THEN
            has_select_policy := TRUE;
            RAISE NOTICE '✅ 找到允许查询的 SELECT 策略: %', r.policyname;
            EXIT;
        END IF;
    END LOOP;
    
    -- 如果没有合适的 SELECT 策略，创建一个
    IF NOT has_select_policy THEN
        -- 删除所有现有的 SELECT 策略
        FOR r IN (
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'users'
              AND cmd = 'SELECT'
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
            RAISE NOTICE '✅ 删除了旧策略: %', r.policyname;
        END LOOP;
        
        -- 创建新的 SELECT 策略
        CREATE POLICY "users_select" ON users
          FOR SELECT
          TO authenticated
          USING (id = auth.uid());
        
        RAISE NOTICE '✅ 创建了新的 users SELECT 策略';
    END IF;
END $$;

-- 第五步：验证 INSERT 策略完全不查询 users 表
SELECT 
    '=== 验证 INSERT 策略 ===' as section,
    policyname,
    with_check,
    CASE 
        WHEN with_check LIKE '%users%' 
          OR with_check LIKE '%FROM users%' 
          OR with_check LIKE '%JOIN users%'
          OR with_check LIKE '%public.users%'
          OR with_check LIKE '%get_user_household_id%' THEN 
            '❌ 策略中包含可能查询 users 表的内容'
        WHEN with_check LIKE '%user_households%' THEN 
            '✅ 策略只查询 user_households 表（正确）'
        ELSE 
            '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- 第六步：测试 INSERT（实际执行）
DO $$
DECLARE
    test_user_id UUID;
    test_household_id UUID;
    test_invitation_id UUID;
    test_email TEXT;
    test_token TEXT;
BEGIN
    RAISE NOTICE '=== 测试 INSERT ===';
    
    test_user_id := auth.uid();
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ 没有认证用户';
        RETURN;
    END IF;
    
    RAISE NOTICE '当前用户 ID: %', test_user_id;
    
    -- 获取 email（从 auth.users，不是 public.users）
    SELECT email INTO test_email
    FROM auth.users
    WHERE id = test_user_id;
    
    IF test_email IS NULL THEN
        RAISE NOTICE '❌ 无法获取 email';
        RETURN;
    END IF;
    
    -- 获取家庭 ID（从 user_households，不查询 users）
    SELECT household_id INTO test_household_id
    FROM user_households
    WHERE user_id = test_user_id
      AND is_admin = TRUE
    LIMIT 1;
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '⚠️  用户不是管理员，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    
    test_token := 'test-token-' || gen_random_uuid()::text;
    
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
            test_email,
            'test@example.com',
            test_token,
            NOW() + INTERVAL '7 days'
        )
        RETURNING id INTO test_invitation_id;
        
        RAISE NOTICE '✅✅✅ INSERT 成功！邀请 ID: %', test_invitation_id;
        
        -- 清理
        DELETE FROM household_invitations WHERE id = test_invitation_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌❌❌ INSERT 失败！';
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RAISE NOTICE 'SQLERRM: %', SQLERRM;
        
        IF SQLSTATE = '42501' THEN
            RAISE NOTICE '❌❌❌ 权限错误！说明仍然在查询 users 表';
            RAISE NOTICE '请检查：';
            RAISE NOTICE '1. 是否有外键约束指向 users 表';
            RAISE NOTICE '2. 是否有触发器查询 users 表';
            RAISE NOTICE '3. INSERT 策略的 WITH CHECK 子句是否查询 users 表';
        END IF;
    END;
END $$;
