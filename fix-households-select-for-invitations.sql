-- ============================================
-- 修复 households 表的 SELECT RLS 策略
-- 允许用户通过 invitation 查看被邀请的家庭信息
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：检查当前的 households SELECT 策略
SELECT 
    'Current Policies' as check_type,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 第二步：删除现有的 households SELECT 策略（如果有多个）
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'households'
          AND cmd = 'SELECT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON households', r.policyname);
        RAISE NOTICE 'Dropped SELECT policy: %', r.policyname;
    END LOOP;
END $$;

-- 第三步：创建新的 SELECT 策略
-- 策略1：用户可以查看自己的家庭（通过 user_households 关联）
CREATE POLICY "households_select_own" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT household_id FROM user_households WHERE user_id = auth.uid()
    )
  );

-- 策略2：用户可以查看他们收到邀请的家庭（通过 household_invitations）
-- 这是关键修复：允许用户查看被邀请的家庭信息
-- 注意：使用 COALESCE 来处理 users 表和 auth.users 表的邮箱
CREATE POLICY "households_select_invited" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (
      SELECT hi.household_id 
      FROM household_invitations hi
      WHERE hi.status = 'pending'
        AND hi.expires_at > NOW()
        AND hi.invitee_email = COALESCE(
          (SELECT email FROM users WHERE id = auth.uid()),
          (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- 第四步：验证策略已创建
SELECT 
    'Policy Verification' as check_type,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'SELECT' AND 'authenticated' = ANY(roles) THEN '✓ Correct'
        ELSE 'Check manually'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 第五步：测试查询（应该能返回结果）
-- 注意：这个查询会显示当前用户收到的邀请相关的家庭
DO $$
DECLARE
    user_email TEXT;
    household_count INTEGER;
BEGIN
    -- 获取当前用户的邮箱
    SELECT email INTO user_email 
    FROM users 
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF user_email IS NULL THEN
        SELECT email INTO user_email 
        FROM auth.users 
        WHERE id = auth.uid()
        LIMIT 1;
    END IF;
    
    IF user_email IS NOT NULL THEN
        -- 统计用户可以通过邀请查看的家庭数量
        SELECT COUNT(*) INTO household_count
        FROM households
        WHERE id IN (
            SELECT household_id 
            FROM household_invitations 
            WHERE invitee_email = user_email
            AND status = 'pending'
            AND expires_at > NOW()
        );
        
        RAISE NOTICE 'User email: %', user_email;
        RAISE NOTICE 'Households accessible via invitations: %', household_count;
    ELSE
        RAISE NOTICE 'Could not find user email';
    END IF;
END $$;

-- 第六步：显示所有 households 相关的策略（用于调试）
SELECT 
    'All Households Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

