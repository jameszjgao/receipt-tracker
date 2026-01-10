-- ============================================
-- 修复 household_invitations INSERT 权限问题
-- 问题：外键约束检查时访问 users 表被 RLS 阻止
-- ============================================

-- 1. 检查外键约束
SELECT 
    '=== 检查外键约束 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass
  AND confrelid = 'users'::regclass;

-- 2. 如果 inviter_id 有外键约束到 users 表，我们需要确保外键检查可以访问 users 表
-- 解决方案：修改外键约束为 DEFERRABLE，或者确保 users 表的 RLS 策略允许外键检查

-- 3. 检查当前的 users 表 SELECT 策略
SELECT 
    '=== 当前 users 表 SELECT 策略 ===' as section,
    policyname,
    cmd,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT';

-- 4. 确保 users 表的 SELECT 策略允许查看自己的记录（用于外键检查）
-- 如果策略不存在或有问题，重新创建

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "users_select" ON users;

-- 创建新的 SELECT 策略，确保可以查看自己的记录（用于外键约束检查）
CREATE POLICY "users_select" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 可以查看自己的记录（关键：用于外键约束检查）
    id = auth.uid()
    OR
    -- 可以查看同家庭的用户（通过 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households uh1
      JOIN user_households uh2 ON uh1.household_id = uh2.household_id
      WHERE uh1.user_id = auth.uid()
        AND uh2.user_id = users.id
    )
  );

-- 5. 如果外键约束导致问题，可以考虑将其设置为 DEFERRABLE
-- 但首先尝试确保 RLS 策略正确

-- 6. 验证修复
SELECT 
    '=== 验证修复 ===' as section,
    'users 表 SELECT 策略已更新，应该允许查看自己的记录用于外键检查' as status;

-- 7. 测试查询（需要替换实际值）
SELECT 
    '=== 测试说明 ===' as section,
    '请手动执行以下查询来测试插入权限：' as instruction,
    'INSERT INTO household_invitations (household_id, inviter_id, inviter_email, invitee_email, token, expires_at) VALUES (''<household_id>'', auth.uid(), ''<inviter_email>'', ''<invitee_email>'', ''test-token'', NOW() + INTERVAL ''7 days'');' as test_query;

