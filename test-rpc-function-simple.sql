-- ============================================
-- 测试 RPC 函数是否能正常工作
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查函数是否存在
SELECT 
    'Function Status' as check_type,
    routine_name,
    routine_type,
    security_type,
    routine_owner
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_household_invitation';

-- 2. 检查当前用户
SELECT 
    'Current User' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as user_email;

-- 3. 检查用户所属的家庭和管理员状态
SELECT 
    'User Households' as check_type,
    household_id,
    is_admin,
    created_at
FROM user_households
WHERE user_id = auth.uid();

-- 4. 测试直接查询 user_households 表（在函数外部）
-- 这应该可以工作，因为 user_households 表的 SELECT 策略允许用户查看自己的记录
SELECT 
    'Test user_households query' as check_type,
    COUNT(*) as count
FROM user_households
WHERE user_id = auth.uid();

-- 5. 测试函数内部逻辑（模拟）
-- 注意：这个查询可能会失败，取决于 RLS 策略
DO $$
DECLARE
  v_user_id UUID;
  v_household_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  -- 获取用户的第一个家庭ID
  SELECT household_id INTO v_household_id
  FROM user_households
  WHERE user_id = v_user_id
  LIMIT 1;
  
  IF v_household_id IS NULL THEN
    RAISE NOTICE 'No household found for user';
    RETURN;
  END IF;
  
  -- 检查是否是管理员
  SELECT EXISTS (
    SELECT 1 
    FROM user_households 
    WHERE user_id = v_user_id 
      AND household_id = v_household_id 
      AND is_admin = TRUE
  ) INTO v_is_admin;
  
  RAISE NOTICE 'User ID: %, Household ID: %, Is Admin: %', v_user_id, v_household_id, v_is_admin;
END $$;

