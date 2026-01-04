-- 修复 RLS 策略以支持用户注册
-- 在 Supabase SQL Editor 中执行此脚本
-- 重要：执行此脚本前，请确保已删除现有的冲突策略

-- 确保 get_user_household_id() 函数存在
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- Households 策略
-- ============================================
-- 先删除所有现有策略（如果存在）
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Users can insert their household" ON households;
DROP POLICY IF EXISTS "Users can create their household" ON households;
DROP POLICY IF EXISTS "Users can update their household" ON households;
DROP POLICY IF EXISTS "Users can manage households" ON households;

-- 允许用户查看自己的家庭（通过 household_id 匹配）
CREATE POLICY "Users can view their household" ON households
  FOR SELECT USING (id = get_user_household_id());

-- 允许新用户创建家庭（注册时需要）
-- 注意：新用户还没有 household_id，所以不能用 get_user_household_id() 检查
-- 这里使用 WITH CHECK (true) 允许任何已认证用户创建家庭
CREATE POLICY "Users can insert their household" ON households
  FOR INSERT 
  WITH CHECK (true);

-- 允许用户更新自己的家庭
CREATE POLICY "Users can update their household" ON households
  FOR UPDATE 
  USING (id = get_user_household_id())
  WITH CHECK (id = get_user_household_id());

-- ============================================
-- Users 策略
-- ============================================
-- 先删除所有现有策略（如果存在）
DROP POLICY IF EXISTS "Users can view users in their household" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Users can manage users" ON users;

-- 允许用户查看同家庭的用户或自己（注册时还没有 household_id，所以需要 OR id = auth.uid()）
CREATE POLICY "Users can view users in their household" ON users
  FOR SELECT 
  USING (household_id = get_user_household_id() OR id = auth.uid());

-- 允许用户创建自己的记录（注册时需要）
-- 必须确保 id = auth.uid()，防止用户创建其他用户的记录
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 允许用户更新自己的记录
CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- Categories 策略
-- ============================================
DROP POLICY IF EXISTS "Users can manage categories in their household" ON categories;
CREATE POLICY "Users can manage categories in their household" ON categories
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Payment Accounts 策略
-- ============================================
DROP POLICY IF EXISTS "Users can manage payment accounts in their household" ON payment_accounts;
CREATE POLICY "Users can manage payment accounts in their household" ON payment_accounts
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Receipts 策略
-- ============================================
DROP POLICY IF EXISTS "Users can manage receipts in their household" ON receipts;
CREATE POLICY "Users can manage receipts in their household" ON receipts
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Receipt Items 策略
-- ============================================
DROP POLICY IF EXISTS "Users can manage receipt items in their household" ON receipt_items;
CREATE POLICY "Users can manage receipt items in their household" ON receipt_items
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
-- 验证策略是否正确创建
-- ============================================
-- 可以运行以下查询来检查策略是否已创建：
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

