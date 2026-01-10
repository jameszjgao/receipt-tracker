-- ============================================
-- 修复 household_invitations 表的 RLS 策略
-- 解决登录用户无法创建邀请和读取邀请记录的问题
-- 在 Supabase SQL Editor 中执行此脚本
-- 
-- 重要提示：
-- 1. 确保 user_households 表有正确的 SELECT 策略，允许用户查看自己的记录
-- 2. 如果执行后仍有问题，请运行 diagnose-household-invitations-insert.sql 进行诊断
-- ============================================

-- 第一步：创建辅助函数（使用 SECURITY DEFINER 绕过 RLS）
-- 检查用户是否是某个家庭的管理员
CREATE OR REPLACE FUNCTION is_user_household_admin(p_household_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid() 
      AND household_id = p_household_id 
      AND is_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 检查用户是否属于某个家庭（用于 RLS 策略）
CREATE OR REPLACE FUNCTION user_belongs_to_household(p_household_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid() 
      AND household_id = p_household_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 获取用户所属的所有家庭ID
CREATE OR REPLACE FUNCTION get_user_household_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT household_id 
    FROM user_households 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 授予函数执行权限
GRANT EXECUTE ON FUNCTION is_user_household_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_belongs_to_household(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_household_ids() TO authenticated;

-- 第二步：删除所有现有的 household_invitations 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

-- 第三步：创建 SELECT 策略
-- 用户可以查看：
-- 1. 自己收到的邀请（通过 email 匹配）
-- 2. 自己所属家庭的邀请（通过 household_id 匹配）
-- 注意：使用 SECURITY DEFINER 函数确保可以绕过 user_households 表的 RLS 限制
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  USING (
    -- 用户可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    -- 或者用户可以查看自己所属家庭的邀请（使用 SECURITY DEFINER 函数）
    OR user_belongs_to_household(household_id)
  );

-- 第四步：创建 INSERT 策略
-- 用户可以为自己所属的家庭创建邀请（必须是管理员）
-- 注意：如果使用 RPC 函数创建邀请，这个策略不会被检查（因为 RPC 函数使用 SECURITY DEFINER）
-- 但如果直接 INSERT，这个策略会检查
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  WITH CHECK (
    -- 邀请者必须是当前用户
    inviter_id = auth.uid()
    -- 并且用户必须是该家庭的管理员（使用 SECURITY DEFINER 函数）
    AND is_user_household_admin(household_id)
  );

-- 注意：如果使用 RPC 函数 create_household_invitation 创建邀请，
-- 由于函数使用 SECURITY DEFINER，INSERT 操作会以函数所有者的权限执行，
-- 因此不会触发这个 RLS 策略检查。

-- 第五步：创建 UPDATE 策略
-- 用户可以更新自己收到的邀请（接受或拒绝邀请）
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  USING (
    -- 只能更新自己收到的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- 更新后仍然必须是自己的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第六步：创建 DELETE 策略（可选，用于管理员撤销邀请）
-- 管理员可以删除自己家庭的邀请
CREATE POLICY "household_invitations_delete" ON household_invitations
  FOR DELETE
  USING (
    -- 管理员可以删除自己家庭的邀请
    is_user_household_admin(household_id)
    -- 或者用户可以删除自己收到的邀请
    OR invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 第七步：验证策略已创建
SELECT 
    '✅ household_invitations policies' as status,
    policyname, 
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- 第八步：验证 RLS 已启用
SELECT 
    '✅ RLS status' as status,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations';

-- 第九步：验证函数已创建
SELECT 
    '✅ Functions' as status,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_user_household_admin', 'user_belongs_to_household', 'get_user_household_ids')
ORDER BY routine_name;

-- 第十步：确保 user_households 表有正确的 SELECT 策略
-- 如果 user_households 表的 SELECT 策略不允许用户查看自己的记录，
-- SECURITY DEFINER 函数可能仍然无法正常工作
DO $$
BEGIN
  -- 检查是否存在允许用户查看自己记录的 SELECT 策略
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_households' 
      AND cmd = 'SELECT'
      AND qual LIKE '%user_id = auth.uid()%'
  ) THEN
    -- 如果不存在，创建一个
    CREATE POLICY "user_households_select_policy" ON user_households
      FOR SELECT 
      USING (user_id = auth.uid());
    
    RAISE NOTICE 'Created user_households SELECT policy';
  ELSE
    RAISE NOTICE 'user_households SELECT policy already exists';
  END IF;
END $$;

