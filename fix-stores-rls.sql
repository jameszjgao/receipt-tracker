-- 修复 stores 表的 RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本

-- 确保 get_user_household_id() 函数存在
-- 注意：使用 current_household_id（多家庭支持迁移后，household_id 字段可能已删除）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT current_household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- Stores 策略
-- ============================================
-- 先删除所有现有策略（如果存在）
DROP POLICY IF EXISTS "Users can manage stores in their household" ON stores;
DROP POLICY IF EXISTS "stores_manage_policy" ON stores;
DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;

-- 确保 RLS 已启用
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 创建统一的策略（参考 payment_accounts 的模式）
CREATE POLICY "stores_manage_policy" ON stores
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- Store Merge History 策略
-- ============================================
-- 先删除所有现有策略（如果存在）
DROP POLICY IF EXISTS "Users can manage store merge history in their household" ON store_merge_history;
DROP POLICY IF EXISTS "store_merge_history_manage_policy" ON store_merge_history;

-- 确保 RLS 已启用
ALTER TABLE store_merge_history ENABLE ROW LEVEL SECURITY;

-- 创建统一的策略
CREATE POLICY "store_merge_history_manage_policy" ON store_merge_history
  FOR ALL 
  USING (household_id = get_user_household_id())
  WITH CHECK (household_id = get_user_household_id());

-- ============================================
-- 验证策略
-- ============================================
-- 运行以下查询检查策略是否正确创建：
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('stores', 'store_merge_history')
-- ORDER BY tablename, policyname;
