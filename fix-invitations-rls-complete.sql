-- ============================================
-- 修复 household_invitations 表的 RLS 策略
-- 确保邀请者（管理员）和被邀请者都能正确查询邀请记录
-- ============================================

-- 1. 创建辅助函数来获取用户的email（从auth.users）
-- 使用 SECURITY DEFINER 确保可以访问 auth.users 表
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- 2. 创建辅助函数来检查用户是否是家庭管理员
-- 使用 SECURITY DEFINER 避免 RLS 策略问题
CREATE OR REPLACE FUNCTION is_household_admin(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = auth.uid()
      AND household_id = p_household_id
      AND is_admin = true
  );
$$;

-- 3. 删除所有现有的 household_invitations SELECT 策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations' AND cmd = 'SELECT') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

-- 4. 创建新的 SELECT 策略
-- 允许以下情况查询邀请：
-- a) 被邀请者：invitee_email 与当前用户的 email 匹配（从 auth.users 获取）
-- b) 邀请者：inviter_id 与当前用户 id 匹配
-- c) 家庭管理员：用户是该家庭的成员且是管理员（使用辅助函数，避免 RLS 问题）

CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT 
  USING (
    -- 情况1：被邀请者可以查看自己的邀请（通过email匹配）
    -- 使用 LOWER 确保大小写不敏感匹配
    LOWER(invitee_email) = LOWER(COALESCE(get_current_user_email(), ''))
    
    OR
    
    -- 情况2：邀请者可以查看自己发出的邀请
    inviter_id = auth.uid()
    
    OR
    
    -- 情况3：家庭管理员可以查看该家庭的所有邀请
    -- 使用辅助函数，避免直接查询 user_households 表时的 RLS 问题
    is_household_admin(household_id)
  );

-- 3. 确保 UPDATE 策略允许被邀请者和家庭管理员更新
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations' AND cmd = 'UPDATE') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE 
  USING (
    -- 被邀请者可以更新自己的邀请（接受/拒绝）
    LOWER(invitee_email) = LOWER(COALESCE(get_current_user_email(), ''))
    
    OR
    
    -- 家庭管理员可以更新该家庭的邀请（取消邀请）
    is_household_admin(household_id)
  )
  WITH CHECK (
    -- 更新后的记录需要满足相同的条件
    LOWER(invitee_email) = LOWER(COALESCE(get_current_user_email(), ''))
    
    OR
    
    is_household_admin(household_id)
  );

-- 4. 确保 DELETE 策略允许家庭管理员删除邀请
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'household_invitations' AND cmd = 'DELETE') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON household_invitations';
    END LOOP;
END $$;

CREATE POLICY "household_invitations_delete" ON household_invitations
  FOR DELETE 
  USING (
    -- 家庭管理员可以删除该家庭的邀请
    is_household_admin(household_id)
    
    OR
    
    -- 被邀请者可以删除自己的邀请（拒绝时）
    LOWER(invitee_email) = LOWER(COALESCE(get_current_user_email(), ''))
  );

-- 5. 验证策略
SELECT 
    '=== household_invitations RLS 策略 ===' as section,
    tablename, 
    policyname, 
    cmd,
    CASE WHEN with_check IS NOT NULL THEN '有 WITH CHECK' ELSE '无 WITH CHECK' END as has_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'household_invitations'
ORDER BY cmd, policyname;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ household_invitations RLS 策略已修复' as result;

