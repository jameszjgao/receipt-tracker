-- ============================================
-- 修复 receipts 表的 RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 确保 get_user_household_id() 函数存在
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 删除所有现有的 receipts 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipts') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipts';
    END LOOP;
END $$;

-- 删除所有现有的 receipt_items 表策略
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_items') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipt_items';
    END LOOP;
END $$;

-- ============================================
-- Receipts 策略
-- ============================================
-- SELECT: 用户可以查看自己家庭的小票
CREATE POLICY "receipts_select" ON receipts
  FOR SELECT 
  USING (household_id = get_user_household_id());

-- INSERT: 用户可以创建自己家庭的小票
CREATE POLICY "receipts_insert" ON receipts
  FOR INSERT 
  WITH CHECK (household_id = get_user_household_id());

-- UPDATE: 用户可以更新自己家庭的小票
CREATE POLICY "receipts_update" ON receipts
  FOR UPDATE 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- DELETE: 用户可以删除自己家庭的小票
CREATE POLICY "receipts_delete" ON receipts
  FOR DELETE 
  USING (household_id = get_user_household_id());

-- ============================================
-- Receipt Items 策略
-- ============================================
-- SELECT: 用户可以查看自己家庭小票的商品项
CREATE POLICY "receipt_items_select" ON receipt_items
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  );

-- INSERT: 用户可以为自己家庭的小票添加商品项
CREATE POLICY "receipt_items_insert" ON receipt_items
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  );

-- UPDATE: 用户可以更新自己家庭小票的商品项
CREATE POLICY "receipt_items_update" ON receipt_items
  FOR UPDATE 
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

-- DELETE: 用户可以删除自己家庭小票的商品项
CREATE POLICY "receipt_items_delete" ON receipt_items
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id = get_user_household_id()
    )
  );

-- ============================================
-- 验证策略
-- ============================================
-- 检查 receipts 表策略
SELECT 
    tablename, 
    policyname, 
    cmd,
    CASE WHEN with_check IS NOT NULL THEN '有 WITH CHECK' ELSE '无 WITH CHECK' END as has_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('receipts', 'receipt_items')
ORDER BY tablename, policyname;

