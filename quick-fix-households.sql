-- ============================================
-- 快速修复：允许用户创建 households
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 方法 1: 先删除所有 households 表的策略，然后重新创建
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'households') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON households';
    END LOOP;
END $$;

-- 确保函数存在
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 重新创建策略
-- 1. SELECT: 用户可以查看自己的家庭
CREATE POLICY "households_select" ON households
  FOR SELECT 
  USING (id = get_user_household_id());

-- 2. INSERT: 允许任何已认证用户创建家庭（关键修复！）
CREATE POLICY "households_insert" ON households
  FOR INSERT 
  WITH CHECK (true);

-- 3. UPDATE: 用户可以更新自己的家庭
CREATE POLICY "households_update" ON households
  FOR UPDATE 
  USING (id = get_user_household_id())
  WITH CHECK (id = get_user_household_id());

-- 验证：检查策略是否创建成功
SELECT 
    tablename, 
    policyname, 
    cmd,
    CASE WHEN with_check IS NOT NULL THEN '有 WITH CHECK' ELSE '无 WITH CHECK' END as has_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'households'
ORDER BY policyname;

