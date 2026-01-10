-- ============================================
-- 正确修复：开放 users 表的权限策略
-- 允许在 RLS 策略上下文中查询 users 表
-- ============================================

-- 第一步：检查当前的 users 表 RLS 策略
SELECT 
    '=== 当前 users 表 RLS 策略 ===' as section,
    policyname,
    cmd,
    roles,
    qual as using_clause,
    with_check,
    CASE 
        WHEN cmd = 'SELECT' AND (
            qual LIKE '%auth.uid()%' OR qual LIKE '%id = auth.uid()%'
        ) THEN '✅ 允许查询自己的记录'
        WHEN cmd = 'SELECT' AND qual IS NULL THEN '❌ 没有限制（可能不安全）'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- 第二步：检查 get_user_household_id 函数（如果使用的话）
SELECT 
    '=== get_user_household_id 函数 ===' as section,
    routine_name,
    security_type,
    CASE 
        WHEN security_type = 'DEFINER' THEN '✅ 使用 SECURITY DEFINER（可以绕过 RLS）'
        ELSE '⚠️  不使用 SECURITY DEFINER（可能受 RLS 限制）'
    END as status,
    SUBSTRING(routine_definition, 1, 200) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 第三步：修复 get_user_household_id 函数（确保可以使用 SECURITY DEFINER 查询 users 表）
-- 这是关键：如果函数使用 SECURITY DEFINER，它可以在自己的权限下查询 users 表
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 可以从 users 表获取（因为使用 SECURITY DEFINER，可以绕过 RLS）
  -- 如果 users 表中有 household_id 字段，可以使用
  -- 否则从 user_households 表获取
  SELECT COALESCE(
    -- 优先从 users 表获取（如果字段存在）
    (SELECT current_household_id FROM users WHERE id = auth.uid() LIMIT 1),
    -- 否则从 user_households 表获取
    (SELECT household_id FROM user_households WHERE user_id = auth.uid() ORDER BY is_admin DESC, created_at ASC LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 第四步：确保 users 表的 SELECT 策略允许在 RLS 策略上下文中查询
-- 关键：RLS 策略在检查时，可能会以 SECURITY DEFINER 函数的权限查询 users 表
-- 但如果 users 表的 SELECT 策略限制太严格，仍然会失败
-- 解决方案：允许通过 SECURITY DEFINER 函数查询，或者在 users 表的 SELECT 策略中允许必要的查询

DO $$
DECLARE
    r RECORD;
    has_permissive_select BOOLEAN := FALSE;
BEGIN
    -- 检查是否有足够宽松的 SELECT 策略
    FOR r IN (
        SELECT policyname, qual
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename = 'users'
          AND cmd = 'SELECT'
    ) LOOP
        -- 如果策略允许查询自己的记录（id = auth.uid()），这在 RLS 上下文中应该足够
        IF r.qual LIKE '%id = auth.uid()%' OR r.qual LIKE '%auth.uid()%' THEN
            has_permissive_select := TRUE;
            RAISE NOTICE '✅ 找到允许查询的 SELECT 策略: %', r.policyname;
        END IF;
    END LOOP;
    
    -- 如果没有任何 SELECT 策略，或者策略太严格，创建一个允许查询的策略
    IF NOT has_permissive_select THEN
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
        
        -- 创建新的 SELECT 策略：允许用户查询自己的记录或同家庭的记录
        -- 这对于 RLS 策略上下文中的查询很重要
        CREATE POLICY "users_select" ON users
          FOR SELECT
          TO authenticated
          USING (
            -- 允许查询自己的记录
            id = auth.uid()
            OR
            -- 允许查询同家庭的记录（通过 get_user_household_id 函数，使用 SECURITY DEFINER）
            current_household_id = get_user_household_id()
            OR
            -- 或者允许查询同家庭的记录（通过 user_households 表）
            EXISTS (
              SELECT 1 
              FROM user_households uh1
              JOIN user_households uh2 ON uh1.household_id = uh2.household_id
              WHERE uh1.user_id = users.id
                AND uh2.user_id = auth.uid()
            )
          );
        
        RAISE NOTICE '✅ 创建了新的 SELECT 策略：允许查询自己的记录或同家庭的记录';
    END IF;
END $$;

-- 第五步：确保 household_invitations 的 INSERT 策略可以正常查询 users 表
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
    
    -- 创建新的 INSERT 策略：可以正常查询 users 表
    -- 因为 get_user_household_id() 使用 SECURITY DEFINER，它可以在自己的权限下查询 users 表
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 邀请者必须是当前用户（直接比较，不查询任何表）
        inviter_id = auth.uid()
        AND
        -- 用户必须是该家庭的管理员
        -- 可以使用 get_user_household_id() 函数（它使用 SECURITY DEFINER，可以查询 users 表）
        -- 或者直接查询 user_households 表（更直接）
        (
          -- 方法 1：使用 get_user_household_id() 函数（如果它查询 users 表，使用 SECURITY DEFINER 可以绕过 RLS）
          household_id = get_user_household_id()
          AND
          -- 确保用户是管理员
          EXISTS (
            SELECT 1 
            FROM user_households 
            WHERE user_id = auth.uid()
              AND household_id = household_invitations.household_id
              AND is_admin = TRUE
          )
        )
      );
    
    RAISE NOTICE '✅ 创建了新的 INSERT 策略：可以正常查询 users 表（通过 SECURITY DEFINER 函数）';
END $$;

-- 第六步：确保 SELECT 策略也可以正常查询 users 表
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
    
    -- 创建新的 SELECT 策略：可以正常查询 users 表
    CREATE POLICY "household_invitations_select" ON household_invitations
      FOR SELECT
      TO authenticated
      USING (
        -- 用户可以查看自己收到的邀请（使用 auth.users，不需要查询 public.users）
        invitee_email = (
          SELECT email FROM auth.users WHERE id = auth.uid()
        )
        OR
        -- 用户可以查看自己所属家庭的邀请
        household_id = get_user_household_id()
        OR
        -- 用户可以查看自己创建的邀请（直接比较，不查询任何表）
        inviter_id = auth.uid()
        OR
        -- 或者通过 user_households 表查询
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_id = auth.uid()
            AND household_id = household_invitations.household_id
        )
      );
    
    RAISE NOTICE '✅ 创建了新的 SELECT 策略：可以正常查询 users 表';
END $$;

-- 第七步：验证所有修复
SELECT 
    '=== 验证结果 ===' as section,
    'users 表 SELECT 策略' as policy_type,
    policyname,
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✅ 策略允许查询'
        ELSE '⚠️  需要检查'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'household_invitations INSERT 策略' as policy_type,
    policyname,
    '✅ 策略已创建' as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'get_user_household_id 函数' as policy_type,
    routine_name as policyname,
    CASE 
        WHEN security_type = 'DEFINER' THEN '✅ 使用 SECURITY DEFINER（可以查询 users 表）'
        ELSE '❌ 不使用 SECURITY DEFINER（可能无法查询 users 表）'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- 第八步：测试 INSERT（实际执行测试）
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
        RAISE NOTICE '❌ 没有认证用户，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '当前用户 ID: %', test_user_id;
    
    -- 获取用户的 email（从 auth.users）
    SELECT email INTO test_email
    FROM auth.users
    WHERE id = test_user_id;
    
    IF test_email IS NULL THEN
        RAISE NOTICE '❌ 无法获取用户 email';
        RETURN;
    END IF;
    
    -- 获取用户的家庭 ID（使用 get_user_household_id 函数）
    test_household_id := get_user_household_id();
    
    IF test_household_id IS NULL THEN
        RAISE NOTICE '⚠️  用户没有家庭，无法测试';
        RETURN;
    END IF;
    
    -- 检查用户是否是管理员
    IF NOT EXISTS (
        SELECT 1 
        FROM user_households 
        WHERE user_id = test_user_id
          AND household_id = test_household_id
          AND is_admin = TRUE
    ) THEN
        RAISE NOTICE '⚠️  用户不是管理员，无法测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ 用户是家庭 % 的管理员', test_household_id;
    
    -- 生成测试 token
    test_token := 'test-token-' || gen_random_uuid()::text;
    
    -- 尝试插入（这会触发 INSERT 策略，策略会查询 users 表）
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
    END;
END $$;

