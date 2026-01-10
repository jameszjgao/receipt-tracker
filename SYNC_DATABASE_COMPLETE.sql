-- ============================================
-- 完整同步数据库脚本 - 确保 Supabase 数据库与本地代码一致
-- 基于本地代码库的所有修复，生成完整的、幂等的 SQL 脚本
-- 可以直接在 Supabase SQL Editor 中执行
-- ============================================

-- ============================================
-- 第一部分：确保表结构正确
-- ============================================

-- 确保 household_invitations 表存在且结构正确
-- 注意：根据本地代码，表包含 inviter_email 字段
CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL, -- 移除外键约束以避免 RLS 问题
  inviter_email TEXT NOT NULL, -- 添加 inviter_email 字段（根据本地代码）
  invitee_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- 如果表已存在但缺少 inviter_email 字段，添加它
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'household_invitations' 
          AND column_name = 'inviter_email'
    ) THEN
        ALTER TABLE household_invitations ADD COLUMN inviter_email TEXT;
        -- 为现有记录设置默认值（从 users 表获取，仅用于迁移）
        UPDATE household_invitations 
        SET inviter_email = COALESCE(
            (SELECT email FROM users WHERE id = household_invitations.inviter_id LIMIT 1),
            'unknown@example.com'
        )
        WHERE inviter_email IS NULL;
        -- 设置 NOT NULL 约束
        ALTER TABLE household_invitations ALTER COLUMN inviter_email SET NOT NULL;
        RAISE NOTICE '✅ 添加了 inviter_email 字段';
    END IF;
END $$;

-- 移除 inviter_id 的外键约束（如果存在）- 这是关键修复！
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.constraint_name
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
          AND kcu.column_name = 'inviter_id'
          AND ccu.table_name = 'users'
    ) LOOP
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
        RAISE NOTICE '✅ 移除了外键约束: %', r.constraint_name;
    END LOOP;
END $$;

-- 创建必要的索引
CREATE INDEX IF NOT EXISTS idx_household_invitations_token ON household_invitations(token);
CREATE INDEX IF NOT EXISTS idx_household_invitations_email ON household_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id ON household_invitations(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_status ON household_invitations(status);
CREATE INDEX IF NOT EXISTS idx_household_invitations_inviter_id ON household_invitations(inviter_id);

-- 启用 RLS（如果尚未启用）
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 第二部分：修复 get_user_household_id() 函数
-- ============================================

-- 确保 get_user_household_id() 函数存在且不查询 users 表
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  -- 只从 user_households 表获取，完全不查询 users 表
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- 第三部分：放开 users 表的 SELECT 策略（允许在 RLS 策略上下文中查询）
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== 删除所有现有的 users SELECT 策略 ===';
    
    -- 删除所有现有的 users SELECT 策略
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
    
    RAISE NOTICE '=== 创建宽松的 users SELECT 策略（允许在 RLS 上下文中查询） ===';
    
    -- 创建宽松的 SELECT 策略：允许用户查看自己的记录（这是最基本的）
    CREATE POLICY "users_select_own" ON users
      FOR SELECT 
      TO authenticated
      USING (id = auth.uid());
    
    -- 创建宽松的 SELECT 策略：允许用户查看同家庭的用户（通过 user_households 表）
    -- 这个策略允许在 RLS 策略上下文中查询同家庭的用户
    CREATE POLICY "users_select_same_household" ON users
      FOR SELECT 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 
          FROM user_households uh1
          INNER JOIN user_households uh2 ON uh1.household_id = uh2.household_id
          WHERE uh1.user_id = auth.uid()
            AND uh2.user_id = users.id
            AND users.id != auth.uid()
        )
      );
    
    -- 关键：创建额外的宽松策略，允许在 RLS 策略上下文中查询 users 表
    -- 这对于在 RLS 策略的 WITH CHECK 子句中查询 users 表很重要
    -- 允许查询当前用户的记录（即使是在 RLS 策略上下文中）
    CREATE POLICY "users_select_for_rls" ON users
      FOR SELECT 
      TO authenticated
      USING (
        -- 允许查询自己的记录（最基本）
        id = auth.uid()
        OR
        -- 允许查询同家庭的记录（通过 get_user_household_id 函数）
        current_household_id = get_user_household_id()
        OR
        -- 允许通过 user_households 表查询同家庭的记录
        EXISTS (
          SELECT 1 
          FROM user_households uh1
          JOIN user_households uh2 ON uh1.household_id = uh2.household_id
          WHERE uh1.user_id = auth.uid()
            AND uh2.user_id = users.id
        )
        OR
        -- 最关键：允许查询任何与当前用户在同一家庭的用户记录
        -- 这确保了在 RLS 策略上下文中可以查询 users 表
        EXISTS (
          SELECT 1 
          FROM user_households
          WHERE user_households.user_id = auth.uid()
            AND EXISTS (
              SELECT 1 
              FROM user_households uh2
              WHERE uh2.user_id = users.id
                AND uh2.household_id = user_households.household_id
            )
        )
      );
    
    RAISE NOTICE '✅ 创建了宽松的 users SELECT 策略（允许在 RLS 上下文中查询）';
END $$;

-- ============================================
-- 第四部分：修复 user_households 表的 SELECT 策略
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除所有现有的 user_households SELECT 策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_households'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_households', r.policyname);
    END LOOP;
    
    -- 创建简单的 SELECT 策略（只检查 user_id，不查询 users 表）
    CREATE POLICY "user_households_select_own" ON user_households
      FOR SELECT 
      TO authenticated
      USING (user_id = auth.uid());
    
    RAISE NOTICE '✅ 创建了 user_households SELECT 策略';
END $$;

-- ============================================
-- 第五部分：完全删除并重新创建 household_invitations 的所有 RLS 策略
-- 现在 users 表的权限已放开，可以在策略中查询 users 表
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== 删除所有现有的 household_invitations 策略 ===';
    
    -- 删除所有现有的 household_invitations 表策略
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON household_invitations', r.policyname);
        RAISE NOTICE '✅ 删除了策略: %', r.policyname;
    END LOOP;
END $$;

-- SELECT 策略：用户可以查看自己收到的邀请或自己家庭的邀请
-- 现在 users 表权限已放开，可以直接查询
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 用户可以查看自己所属家庭的邀请（可以通过 user_households 或 users 表查询）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
    )
    OR
    -- 用户可以查看自己创建的邀请（直接比较 inviter_id，不查询任何表）
    inviter_id = auth.uid()
    OR
    -- 也可以通过 users 表查询（现在权限已放开）
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.id = auth.uid()
        AND users.current_household_id = household_invitations.household_id
    )
  );

-- INSERT 策略：允许用户为自己所属的家庭创建邀请（必须是管理员）
-- 关键：这个策略必须存在，否则所有 INSERT 操作都会被拒绝！
-- 现在 users 表权限已完全放开，可以直接查询 users 表
-- 优先使用 user_households 表，但如果需要也可以查询 users 表
DO $$
BEGIN
    -- 先删除可能存在的旧策略（确保不会冲突）
    DROP POLICY IF EXISTS "household_invitations_insert" ON household_invitations;
    
    -- 创建新的 INSERT 策略
    CREATE POLICY "household_invitations_insert" ON household_invitations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 邀请者必须是当前用户（直接比较，不查询任何表）
        inviter_id = auth.uid()
        AND
        -- 用户必须是该家庭的管理员
        -- 现在 users 表权限已放开，可以同时使用两种方法检查
        EXISTS (
          SELECT 1 
          FROM user_households 
          WHERE user_households.user_id = auth.uid()
            AND user_households.household_id = household_invitations.household_id
            AND user_households.is_admin = TRUE
        )
      );
    
    RAISE NOTICE '✅ 创建了 household_invitations INSERT 策略';
END $$;

-- UPDATE 策略：用户可以更新自己收到的邀请（接受或拒绝）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  TO authenticated
  USING (
    -- 只能更新自己收到的邀请（使用 auth.users，不查询 public.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 或者管理员可以更新自己家庭的邀请（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  )
  WITH CHECK (
    -- 更新后仍然必须是自己的邀请或自己家庭的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
  );

-- DELETE 策略：管理员可以删除自己家庭的邀请，或用户可以删除自己收到的邀请
CREATE POLICY "household_invitations_delete" ON household_invitations
  FOR DELETE
  TO authenticated
  USING (
    -- 管理员可以删除自己家庭的邀请（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_households.user_id = auth.uid()
        AND user_households.household_id = household_invitations.household_id
        AND user_households.is_admin = TRUE
    )
    OR
    -- 用户可以删除自己收到的邀请（使用 auth.users，不查询 public.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- ============================================
-- 第六部分：创建辅助函数（如果需要）
-- ============================================

-- 创建函数：自动过期邀请（可以通过定时任务调用）
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE household_invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 第七部分：验证所有修复
-- ============================================

SELECT 
    '=== 验证结果 ===' as section,
    'household_invitations 表结构' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'household_invitations' 
              AND column_name = 'inviter_email'
        ) THEN '✅ inviter_email 字段存在'
        ELSE '❌ inviter_email 字段不存在'
    END as status

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'household_invitations INSERT 策略' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'household_invitations'
              AND cmd = 'INSERT'
              AND policyname = 'household_invitations_insert'
        ) THEN '✅ INSERT 策略存在（关键！）'
        ELSE '❌❌❌ INSERT 策略不存在（这是问题！）'
    END as status

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    '外键约束检查' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = 'household_invitations'
              AND kcu.column_name = 'inviter_id'
              AND ccu.table_name = 'users'
        ) THEN '❌ 仍有外键约束指向 users 表'
        ELSE '✅ 已移除外键约束'
    END as status

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'INSERT 策略' as check_type,
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
  AND cmd = 'INSERT'

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'users SELECT 策略' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ 策略存在'
        ELSE '❌ 策略不存在'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'

UNION ALL

SELECT 
    '=== 验证结果 ===' as section,
    'get_user_household_id 函数' as check_type,
    CASE 
        WHEN security_type = 'DEFINER' AND routine_definition NOT LIKE '%FROM users%' THEN 
            '✅ 使用 SECURITY DEFINER 且不查询 users 表'
        WHEN routine_definition LIKE '%FROM users%' THEN 
            '❌ 函数仍然查询 users 表'
        ELSE 
            '⚠️  需要检查'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_household_id';

-- ============================================
-- 完成提示
-- ============================================

SELECT 
    '✅ 数据库同步完成！' as message,
    '请检查上面的验证结果，确保所有状态都是 ✅' as next_step;

