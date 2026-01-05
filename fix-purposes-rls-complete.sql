-- ============================================
-- 修复 purposes 表的 RLS 策略和 RPC 函数，允许新创建的家庭插入默认用途
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 确保 RPC 函数使用 SECURITY DEFINER 来绕过 RLS
CREATE OR REPLACE FUNCTION create_default_purposes(p_household_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO purposes (household_id, name, color, is_default) VALUES
    (p_household_id, 'Home', '#00B894', true),
    (p_household_id, 'Gifts', '#E84393', true),
    (p_household_id, 'Business', '#FF9500', true)
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 删除现有的 purposes 策略（如果存在）
DROP POLICY IF EXISTS "Users can manage purposes in their household" ON purposes;
DROP POLICY IF EXISTS "purposes_manage_policy" ON purposes;

-- 3. 更新 purposes 表的策略以支持多家庭系统
CREATE POLICY "Users can manage purposes in their household" ON purposes
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = purposes.household_id
      AND user_households.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_households
      WHERE user_households.household_id = purposes.household_id
      AND user_households.user_id = auth.uid()
    )
  );

-- 4. 授予权限：允许已认证用户调用此函数
GRANT EXECUTE ON FUNCTION create_default_purposes(UUID) TO authenticated;

-- 验证策略是否创建成功
SELECT 
    tablename, 
    policyname, 
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'purposes'
ORDER BY tablename, policyname;

