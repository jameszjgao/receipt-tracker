-- ============================================
-- 重建所有 RLS 策略
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- 业务逻辑：以家庭为单位记账，家庭管理员有管理成员的权限，其他业务权限都平等
-- ============================================

-- ============================================
-- 第一部分：清理所有现有的 RLS 策略
-- ============================================

DO $$
DECLARE
    r RECORD;
    tables TEXT[] := ARRAY[
        'users',
        'user_households',
        'households',
        'household_invitations',
        'categories',
        'payment_accounts',
        'purposes',
        'receipts',
        'receipt_items',
        'payment_account_merge_history'
    ];
    table_name TEXT;
BEGIN
    RAISE NOTICE '=== 开始清理所有 RLS 策略 ===';
    
    FOREACH table_name IN ARRAY tables
    LOOP
        FOR r IN (
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = table_name
        ) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, table_name);
            RAISE NOTICE '✅ 删除了策略: %.%', table_name, r.policyname;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 所有 RLS 策略已清理完成';
END $$;

-- ============================================
-- 第二部分：确保辅助函数存在
-- ============================================

-- 获取用户家庭 ID 的函数（从 user_households 表获取，不查询 users 表）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id 
  FROM user_households 
  WHERE user_id = auth.uid() 
  ORDER BY is_admin DESC, created_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- 第三部分：创建 users 表的 RLS 策略
-- ============================================

-- SELECT: 用户可以查看自己的记录和同家庭的用户记录
CREATE POLICY "users_select" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 可以查看自己的记录
    id = auth.uid()
    OR
    -- 可以查看同家庭的用户（通过 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households uh1
      JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id = users.id
    )
  );

-- INSERT: 用户可以创建自己的记录（注册时）
CREATE POLICY "users_insert" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: 用户可以更新自己的记录
CREATE POLICY "users_update" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- 第四部分：创建 user_households 表的 RLS 策略
-- ============================================

-- SELECT: 用户可以查看自己的家庭关联记录
CREATE POLICY "user_households_select" ON user_households
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: 用户可以创建自己的家庭关联记录（接受邀请时）
CREATE POLICY "user_households_insert" ON user_households
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 用户可以更新自己的家庭关联记录
CREATE POLICY "user_households_update" ON user_households
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 第五部分：创建 households 表的 RLS 策略
-- ============================================

-- SELECT: 用户可以查看自己所属的家庭
CREATE POLICY "households_select" ON households
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: 任何已认证用户都可以创建家庭（注册时需要）
CREATE POLICY "households_insert" ON households
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: 用户可以更新自己所属的家庭（管理员权限在应用层控制）
CREATE POLICY "households_update" ON households
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第六部分：创建 household_invitations 表的 RLS 策略（关键！）
-- ============================================

-- SELECT: 用户可以查看自己收到的邀请、自己家庭的邀请、自己创建的邀请
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 可以查看自己收到的邀请（通过 email 匹配）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 可以查看自己所属家庭的邀请
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
    )
    OR
    -- 可以查看自己创建的邀请
    inviter_id = auth.uid()
  );

-- INSERT: 管理员可以为自己所属的家庭创建邀请（关键策略！）
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
    )
  );

-- UPDATE: 用户可以更新自己收到的邀请（接受/拒绝），管理员可以更新自己家庭的邀请
CREATE POLICY "household_invitations_update" ON household_invitations
  FOR UPDATE
  TO authenticated
  USING (
    -- 可以更新自己收到的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 管理员可以更新自己家庭的邀请
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
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
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
    )
  );

-- DELETE: 管理员可以删除自己家庭的邀请，用户可以删除自己收到的邀请
CREATE POLICY "household_invitations_delete" ON household_invitations
  FOR DELETE
  TO authenticated
  USING (
    -- 管理员可以删除自己家庭的邀请
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
    )
    OR
    -- 用户可以删除自己收到的邀请
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- ============================================
-- 第七部分：创建 categories 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的所有分类
CREATE POLICY "categories_manage" ON categories
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第八部分：创建 payment_accounts 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的所有支付账户
CREATE POLICY "payment_accounts_manage" ON payment_accounts
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第九部分：创建 purposes 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的所有用途
CREATE POLICY "purposes_manage" ON purposes
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第十部分：创建 receipts 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的所有小票
CREATE POLICY "receipts_manage" ON receipts
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第十一部分：创建 receipt_items 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的小票项
CREATE POLICY "receipt_items_manage" ON receipt_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM receipts
      WHERE receipts.id = receipt_items.receipt_id
        AND receipts.household_id IN (
          SELECT household_id 
          FROM user_households 
          WHERE user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM receipts
      WHERE receipts.id = receipt_items.receipt_id
        AND receipts.household_id IN (
          SELECT household_id 
          FROM user_households 
          WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================
-- 第十二部分：创建 payment_account_merge_history 表的 RLS 策略
-- ============================================

-- ALL: 用户可以管理自己所属家庭的支付账户合并历史
CREATE POLICY "payment_account_merge_history_manage" ON payment_account_merge_history
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM user_households 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 第十三部分：验证所有策略已创建
-- ============================================

SELECT 
    '=== 验证结果 ===' as section,
    tablename,
    cmd,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ 策略已创建'
        ELSE '❌ 策略未创建'
    END as status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN (
    'users',
    'user_households',
    'households',
    'household_invitations',
    'categories',
    'payment_accounts',
    'purposes',
    'receipts',
    'receipt_items',
    'payment_account_merge_history'
  )
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- ============================================
-- 第十四部分：关键策略验证（household_invitations INSERT）
-- ============================================

SELECT 
    '=== 关键验证：household_invitations INSERT 策略 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'household_invitations'
              AND cmd = 'INSERT'
              AND policyname = 'household_invitations_insert'
        ) THEN '✅✅✅ INSERT 策略已创建（关键！）'
        ELSE '❌❌❌ INSERT 策略未创建（这是问题！）'
    END as status,
    with_check as policy_definition
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT'
  AND policyname = 'household_invitations_insert';

-- 如果 INSERT 策略不存在，显示警告
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'household_invitations'
          AND cmd = 'INSERT'
    ) THEN
        RAISE EXCEPTION '❌❌❌ household_invitations INSERT 策略未创建！请检查脚本执行情况。';
    ELSE
        RAISE NOTICE '✅✅✅ 所有策略验证通过！';
    END IF;
END $$;

-- ============================================
-- 完成提示
-- ============================================

SELECT 
    '✅ 所有 RLS 策略重建完成！' as message,
    '请检查上面的验证结果，确保所有状态都是 ✅' as next_step,
    '特别注意：household_invitations INSERT 策略必须存在' as important_note;

