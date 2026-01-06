-- 修复 user_households 表的 RLS SELECT 策略
-- 允许同一家庭的用户查看其他成员的关联记录
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 创建函数：获取用户所在的家庭ID列表（使用 SECURITY DEFINER 避免递归）
CREATE OR REPLACE FUNCTION get_user_household_ids_for_rls()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT household_id 
    FROM user_households 
    WHERE user_id = auth.uid()
  );
$$;

-- 2. 删除现有的 SELECT 策略
DROP POLICY IF EXISTS "Users can view their household associations" ON user_households;

-- 3. 创建新的 SELECT 策略：
-- 用户可以看到同一家庭中所有成员的关联记录
-- 使用函数避免递归问题
CREATE POLICY "Users can view their household associations" ON user_households
  FOR SELECT USING (
    -- 用户可以看到自己所在的家庭中所有成员的关联记录
    household_id = ANY(get_user_household_ids_for_rls())
  );

-- 4. 验证策略已创建
SELECT 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_households'
  AND policyname = 'Users can view their household associations';

