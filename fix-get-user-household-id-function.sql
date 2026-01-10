-- ============================================
-- 修复 get_user_household_id() 函数
-- 适配多家庭架构：优先使用 current_household_id，如果为 NULL 则从 user_households 表获取
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 修复函数：获取用户当前家庭ID（用于 RLS）
-- 1. 优先使用 users.current_household_id
-- 2. 如果为 NULL，从 user_households 表获取第一个家庭（通常是主家庭）
CREATE OR REPLACE FUNCTION get_user_household_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    -- 优先使用 current_household_id
    (SELECT current_household_id FROM users WHERE id = auth.uid()),
    -- 如果为 NULL，从 user_households 表获取第一个家庭
    (SELECT household_id FROM user_households WHERE user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 验证函数已更新
SELECT 
    '✅ Function updated' as status,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_user_household_id';

