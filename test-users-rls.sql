-- ============================================
-- 测试 users 表 RLS 策略
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：需要在有用户登录的情况下测试
-- ============================================

-- 测试 1：检查当前用户 ID
SELECT 
    'Test 1: Current User ID' as test_name,
    auth.uid() as user_id;

-- 测试 2：检查是否能查询自己的记录
SELECT 
    'Test 2: Query Own Record' as test_name,
    id, 
    email, 
    name, 
    current_household_id
FROM users 
WHERE id = auth.uid()
LIMIT 1;

-- 测试 3：检查是否能更新自己的记录
-- 注意：这只是一个测试查询，不会实际更新
SELECT 
    'Test 3: Test Update Query' as test_name,
    COUNT(*) as records_that_can_be_updated
FROM users 
WHERE id = auth.uid();

-- 测试 4：检查同家庭的用户查询
SELECT 
    'Test 4: Query Household Members' as test_name,
    COUNT(*) as household_members_count
FROM users
WHERE id IN (
    SELECT uh2.user_id
    FROM user_households uh1
    JOIN user_households uh2 ON uh1.household_id = uh2.household_id
    WHERE uh1.user_id = auth.uid()
      AND uh2.user_id != auth.uid()
);

-- 测试 5：检查邀请者查询
SELECT 
    'Test 5: Query Inviters' as test_name,
    COUNT(*) as inviters_count
FROM users
WHERE id IN (
    SELECT inviter_id 
    FROM household_invitations 
    WHERE invitee_email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND status = 'pending'
    AND expires_at > NOW()
);

