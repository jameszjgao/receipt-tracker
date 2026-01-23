-- 更新 RLS 策略：household -> space, store -> supplier
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：此脚本会更新所有相关 RLS 策略

-- ============================================
-- 0. 先创建必要的新函数（策略需要这些函数）
-- ============================================

-- 创建 is_admin_of_space() 函数
CREATE OR REPLACE FUNCTION is_admin_of_space(p_space_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_spaces 
    WHERE user_id = auth.uid()
      AND space_id = p_space_id
      AND is_admin = TRUE
  );
END;
$$;

-- 创建 get_user_space_id() 函数
CREATE OR REPLACE FUNCTION get_user_space_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT current_space_id FROM users WHERE id = auth.uid();
$$;

-- 创建 get_user_space_ids() 函数
CREATE OR REPLACE FUNCTION get_user_space_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ARRAY(
    SELECT space_id 
    FROM user_spaces 
    WHERE user_id = auth.uid()
  );
$$;

-- ============================================
-- 1. 更新 user_spaces 表的策略
-- ============================================

-- 删除所有旧的策略（包括所有可能的变体和新策略，确保干净）
DROP POLICY IF EXISTS "user_households_delete_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_select_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_insert_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_update_policy" ON user_spaces;
DROP POLICY IF EXISTS "Users can view their household memberships" ON user_spaces;
DROP POLICY IF EXISTS "Users can manage their household memberships" ON user_spaces;
DROP POLICY IF EXISTS "user_households_select" ON user_spaces;
DROP POLICY IF EXISTS "user_households_insert" ON user_spaces;
DROP POLICY IF EXISTS "user_households_update" ON user_spaces;
DROP POLICY IF EXISTS "user_households_delete" ON user_spaces;
DROP POLICY IF EXISTS "user_households_select_same_household" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_delete_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_select_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_insert_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_spaces_update_policy" ON user_spaces;

-- 创建新策略（先删除确保干净）
CREATE POLICY "user_spaces_delete_policy" ON user_spaces
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

CREATE POLICY "user_spaces_select_policy" ON user_spaces
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
  );

CREATE POLICY "user_spaces_insert_policy" ON user_spaces
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

CREATE POLICY "user_spaces_update_policy" ON user_spaces
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

-- 保留旧策略名称作为别名（向后兼容）
CREATE POLICY "user_households_delete_policy" ON user_spaces
  FOR DELETE
  USING (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

CREATE POLICY "user_households_select_policy" ON user_spaces
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
  );

CREATE POLICY "user_households_insert_policy" ON user_spaces
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

CREATE POLICY "user_households_update_policy" ON user_spaces
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR is_admin_of_space(space_id)
  );

-- ============================================
-- 2. 更新 spaces 表的策略
-- ============================================

-- 删除所有旧的策略（包括所有可能的变体和新策略，确保干净）
DROP POLICY IF EXISTS "Users can view their households" ON spaces;
DROP POLICY IF EXISTS "Users can manage their households" ON spaces;
DROP POLICY IF EXISTS "spaces_select_policy" ON spaces;
DROP POLICY IF EXISTS "spaces_insert_policy" ON spaces;
DROP POLICY IF EXISTS "spaces_update_policy" ON spaces;
DROP POLICY IF EXISTS "spaces_delete_policy" ON spaces;
DROP POLICY IF EXISTS "households_select" ON spaces;
DROP POLICY IF EXISTS "households_insert" ON spaces;
DROP POLICY IF EXISTS "households_update" ON spaces;
DROP POLICY IF EXISTS "households_delete" ON spaces;

-- 创建新策略（已在上面的 DROP 语句中删除，现在重新创建）
CREATE POLICY "spaces_select_policy" ON spaces
  FOR SELECT
  USING (
    id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
  );

CREATE POLICY "spaces_insert_policy" ON spaces
  FOR INSERT
  WITH CHECK (true); -- 允许插入，由函数处理权限

CREATE POLICY "spaces_update_policy" ON spaces
  FOR UPDATE
  USING (
    id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "spaces_delete_policy" ON spaces
  FOR DELETE
  USING (
    id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- 3. 更新 categories 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage categories in their household" ON categories;
DROP POLICY IF EXISTS "categories_manage_policy" ON categories;

-- 创建新策略
CREATE POLICY "categories_manage_policy" ON categories
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 4. 更新 payment_accounts 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage payment accounts in their household" ON payment_accounts;
DROP POLICY IF EXISTS "payment_accounts_manage_policy" ON payment_accounts;

-- 创建新策略
CREATE POLICY "payment_accounts_manage_policy" ON payment_accounts
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 5. 更新 purposes 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage purposes in their household" ON purposes;
DROP POLICY IF EXISTS "purposes_manage_policy" ON purposes;

-- 创建新策略
CREATE POLICY "purposes_manage_policy" ON purposes
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 6. 更新 suppliers 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage stores in their household" ON suppliers;
DROP POLICY IF EXISTS "stores_manage_policy" ON suppliers;
DROP POLICY IF EXISTS "suppliers_manage_policy" ON suppliers;

-- 创建新策略
CREATE POLICY "suppliers_manage_policy" ON suppliers
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- 保留旧策略名称作为别名
CREATE POLICY "stores_manage_policy" ON suppliers
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 7. 更新 receipts 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage receipts in their household" ON receipts;
DROP POLICY IF EXISTS "receipts_manage_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_select_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_insert_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_update_policy" ON receipts;
DROP POLICY IF EXISTS "receipts_delete_policy" ON receipts;

-- 创建新策略
CREATE POLICY "receipts_select_policy" ON receipts
  FOR SELECT
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

CREATE POLICY "receipts_insert_policy" ON receipts
  FOR INSERT
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

CREATE POLICY "receipts_update_policy" ON receipts
  FOR UPDATE
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

CREATE POLICY "receipts_delete_policy" ON receipts
  FOR DELETE
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 8. 更新 space_invitations 表的策略
-- ============================================

-- 删除所有旧的策略（包括所有可能的变体）
-- 注意：先尝试删除旧表上的策略（如果表还没重命名），再删除新表上的策略
DO $$
BEGIN
  -- 尝试删除旧表上的策略（如果表还存在）
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'household_invitations') THEN
    DROP POLICY IF EXISTS "Users can view invitations for their households" ON household_invitations;
    DROP POLICY IF EXISTS "Users can manage invitations for their households" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_select_policy" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_insert_policy" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_update_policy" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_select" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_insert" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_update" ON household_invitations;
    DROP POLICY IF EXISTS "household_invitations_delete" ON household_invitations;
  END IF;
END $$;

-- 删除新表上的策略（如果已存在）
DROP POLICY IF EXISTS "space_invitations_select_policy" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_insert_policy" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_update_policy" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_delete_policy" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_select" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_insert" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_update" ON space_invitations;
DROP POLICY IF EXISTS "space_invitations_delete" ON space_invitations;

-- 创建新策略（使用新表名）
CREATE POLICY "space_invitations_select_policy" ON space_invitations
  FOR SELECT
  USING (
    space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
    OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "space_invitations_insert_policy" ON space_invitations
  FOR INSERT
  WITH CHECK (
    space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
  );

CREATE POLICY "space_invitations_update_policy" ON space_invitations
  FOR UPDATE
  USING (
    space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid())
    OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "space_invitations_delete_policy" ON space_invitations
  FOR DELETE
  USING (
    space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid() AND is_admin = true)
    OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- ============================================
-- 9. 更新 supplier_merge_history 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can manage store merge history in their household" ON supplier_merge_history;
DROP POLICY IF EXISTS "store_merge_history_manage_policy" ON supplier_merge_history;
DROP POLICY IF EXISTS "supplier_merge_history_manage_policy" ON supplier_merge_history;

-- 创建新策略
CREATE POLICY "supplier_merge_history_manage_policy" ON supplier_merge_history
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- 保留旧策略名称作为别名
CREATE POLICY "store_merge_history_manage_policy" ON supplier_merge_history
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 10. 更新 payment_account_merge_history 表的策略
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "payment_account_merge_history_manage_policy" ON payment_account_merge_history;

-- 创建新策略
CREATE POLICY "payment_account_merge_history_manage_policy" ON payment_account_merge_history
  FOR ALL
  USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
  WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()));

-- ============================================
-- 11. 更新 ai_chat_logs 表的策略（如果存在）
-- ============================================

-- 删除所有旧的策略（包括所有可能的变体）
DROP POLICY IF EXISTS "ai_chat_logs_manage_policy" ON ai_chat_logs;
DROP POLICY IF EXISTS "Users can insert their household's chat logs" ON ai_chat_logs;
DROP POLICY IF EXISTS "Users can view their household's chat logs" ON ai_chat_logs;
DROP POLICY IF EXISTS "Users can insert their space's chat logs" ON ai_chat_logs;
DROP POLICY IF EXISTS "Users can view their space's chat logs" ON ai_chat_logs;

-- 创建新策略（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_chat_logs') THEN
    -- 先删除可能已存在的策略
    DROP POLICY IF EXISTS "ai_chat_logs_manage_policy" ON ai_chat_logs;
    DROP POLICY IF EXISTS "Users can view their space's chat logs" ON ai_chat_logs;
    DROP POLICY IF EXISTS "Users can insert their space's chat logs" ON ai_chat_logs;
    
    -- 创建新的策略
    EXECUTE 'CREATE POLICY "ai_chat_logs_manage_policy" ON ai_chat_logs
      FOR ALL
      USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))
      WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))';
    
    -- 创建 SELECT 策略
    EXECUTE 'CREATE POLICY "Users can view their space''s chat logs" ON ai_chat_logs
      FOR SELECT
      USING (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))';
    
    -- 创建 INSERT 策略
    EXECUTE 'CREATE POLICY "Users can insert their space''s chat logs" ON ai_chat_logs
      FOR INSERT
      WITH CHECK (space_id IN (SELECT space_id FROM user_spaces WHERE user_id = auth.uid()))';
  END IF;
END $$;

-- ============================================
-- 验证策略更新
-- ============================================
SELECT '=== RLS 策略更新验证 ===' as info;

SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN policyname LIKE '%household%' OR policyname LIKE '%store%' THEN 
            CASE 
                WHEN policyname LIKE '%household%' AND policyname NOT LIKE '%space%' THEN '❌ 需要更新'
                WHEN policyname LIKE '%store%' AND policyname NOT LIKE '%supplier%' THEN '❌ 需要更新'
                ELSE '⚠️ 已创建别名（建议使用新策略）'
            END
        ELSE '✅ 已更新'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND (
    policyname LIKE '%household%' 
    OR policyname LIKE '%store%'
    OR policyname LIKE '%space%'
    OR policyname LIKE '%supplier%'
)
ORDER BY tablename, policyname;
