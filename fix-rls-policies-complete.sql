-- ============================================
-- 完全修复 RLS 策略 - 支持用户注册
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：删除所有现有的策略（避免冲突）
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 删除 households 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'households') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON households';
    END LOOP;
    
    -- 删除 users 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
    
    -- 删除 categories 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categories') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON categories';
    END LOOP;
    
    -- 删除 payment_accounts 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_accounts') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON payment_accounts';
    END LOOP;
    
    -- 删除 receipts 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipts') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipts';
    END LOOP;
    
    -- 删除 receipt_items 表的所有策略
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_items') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipt_items';
    END LOOP;
END $$;

-- 第二步：确保 get_user_household_id() 函数存在
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 第三步：重新创建所有策略

-- ============================================
-- Households 策略
-- ============================================
-- 查看：用户只能查看自己的家庭
CREATE POLICY "households_select_policy" ON households
  FOR SELECT 
  USING (id = get_user_household_id());

-- 插入：允许任何已认证用户创建家庭（注册时需要）
-- 重要：新用户还没有 household_id，所以必须允许所有已认证用户创建
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT 
  WITH CHECK (true);

-- 更新：用户只能更新自己的家庭
CREATE POLICY "households_update_policy" ON households
  FOR UPDATE 
  USING (id = get_user_household_id())
  WITH CHECK (id = get_user_household_id());

-- ============================================
-- Users 策略
-- ============================================
-- 查看：用户可以查看同家庭的用户或自己（注册时还没有 household_id，所以需要 OR id = auth.uid()）
CREATE POLICY "users_select_policy" ON users
  FOR SELECT 
  USING (household_id = get_user_household_id() OR id = auth.uid());

-- 插入：允许用户创建自己的记录（注册时需要）
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 更新：用户只能更新自己的记录
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- Categories 策略
-- ============================================
CREATE POLICY "categories_manage_policy" ON categories
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Payment Accounts 策略
-- ============================================
CREATE POLICY "payment_accounts_manage_policy" ON payment_accounts
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Receipts 策略
-- ============================================
CREATE POLICY "receipts_manage_policy" ON receipts
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Receipt Items 策略
-- ============================================
CREATE POLICY "receipt_items_manage_policy" ON receipt_items
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  );

-- ============================================
-- 验证策略
-- ============================================
-- 运行以下查询检查策略是否正确创建：
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

