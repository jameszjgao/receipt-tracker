-- ============================================
-- 强制修复 receipts 表的 RLS 策略（更彻底的版本）
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 第一步：确保函数存在且正确
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
BEGIN
  -- 如果 users 表中还没有记录，返回 NULL 但不抛出错误
  RETURN (SELECT household_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 第二步：强制删除所有现有策略（包括可能隐藏的策略）
DROP POLICY IF EXISTS "receipts_select" ON receipts;
DROP POLICY IF EXISTS "receipts_insert" ON receipts;
DROP POLICY IF EXISTS "receipts_update" ON receipts;
DROP POLICY IF EXISTS "receipts_delete" ON receipts;
DROP POLICY IF EXISTS "Users can manage receipts in their household" ON receipts;
DROP POLICY IF EXISTS "receipts_manage_policy" ON receipts;

-- 使用循环删除所有 receipts 策略（确保删除干净）
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipts') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipts';
    END LOOP;
END $$;

-- 第三步：删除所有 receipt_items 策略
DROP POLICY IF EXISTS "receipt_items_select" ON receipt_items;
DROP POLICY IF EXISTS "receipt_items_insert" ON receipt_items;
DROP POLICY IF EXISTS "receipt_items_update" ON receipt_items;
DROP POLICY IF EXISTS "receipt_items_delete" ON receipt_items;
DROP POLICY IF EXISTS "Users can manage receipt items in their household" ON receipt_items;
DROP POLICY IF EXISTS "receipt_items_manage_policy" ON receipt_items;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_items') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON receipt_items';
    END LOOP;
END $$;

-- 第四步：重新创建 receipts 策略（使用更宽松的检查，避免 NULL 问题）
-- SELECT: 用户可以查看自己家庭的小票
CREATE POLICY "receipts_select" ON receipts
  FOR SELECT 
  USING (
    household_id IS NOT NULL 
    AND household_id = get_user_household_id()
  );

-- INSERT: 用户可以创建自己家庭的小票
-- 重要：使用 WITH CHECK 确保插入的 household_id 匹配用户的家庭
CREATE POLICY "receipts_insert" ON receipts
  FOR INSERT 
  WITH CHECK (
    household_id IS NOT NULL 
    AND household_id = get_user_household_id()
  );

-- UPDATE: 用户可以更新自己家庭的小票
CREATE POLICY "receipts_update" ON receipts
  FOR UPDATE 
  USING (
    household_id IS NOT NULL 
    AND household_id = get_user_household_id()
  )
  WITH CHECK (
    household_id IS NOT NULL 
    AND household_id = get_user_household_id()
  );

-- DELETE: 用户可以删除自己家庭的小票
CREATE POLICY "receipts_delete" ON receipts
  FOR DELETE 
  USING (
    household_id IS NOT NULL 
    AND household_id = get_user_household_id()
  );

-- 第五步：重新创建 receipt_items 策略
-- SELECT: 用户可以查看自己家庭小票的商品项
CREATE POLICY "receipt_items_select" ON receipt_items
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id IS NOT NULL
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
      AND receipts.household_id IS NOT NULL
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
      AND receipts.household_id IS NOT NULL
      AND receipts.household_id = get_user_household_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts 
      WHERE receipts.id = receipt_items.receipt_id 
      AND receipts.household_id IS NOT NULL
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
      AND receipts.household_id IS NOT NULL
      AND receipts.household_id = get_user_household_id()
    )
  );

-- 第六步：验证策略已创建
SELECT 
    tablename, 
    policyname, 
    cmd as operation,
    CASE 
        WHEN with_check IS NOT NULL THEN '有 WITH CHECK: ' || with_check 
        ELSE '无 WITH CHECK' 
    END as check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('receipts', 'receipt_items')
ORDER BY tablename, cmd, policyname;

