-- ============================================
-- 修复 household_invitations INSERT 权限问题（最终方案）
-- 问题根源：外键约束检查时访问 users 表被 RLS 阻止
-- ============================================

-- 问题分析：
-- 1. household_invitations.inviter_id 有外键约束 REFERENCES users(id)
-- 2. 插入时 PostgreSQL 需要验证 inviter_id 是否存在于 users 表
-- 3. 由于 RLS，如果 users 表的 SELECT 策略不允许访问，外键检查会失败
-- 4. 解决方案：确保 users 表的 SELECT 策略允许查看自己的记录（id = auth.uid()）

-- ============================================
-- 第一步：检查当前 users 表的 SELECT 策略
-- ============================================

SELECT 
    '=== 当前 users 表 SELECT 策略 ===' as section,
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT';

-- ============================================
-- 第二步：确保 users 表的 SELECT 策略允许查看自己的记录
-- ============================================

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "users_select" ON users;

-- 创建新的 SELECT 策略，确保可以查看自己的记录（用于外键约束检查）
-- 关键：必须包含 id = auth.uid() 条件，这样外键检查才能通过
CREATE POLICY "users_select" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 关键：可以查看自己的记录（用于外键约束检查）
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

-- ============================================
-- 第三步：验证修复
-- ============================================

SELECT 
    '=== 验证修复 ===' as section,
    'users 表 SELECT 策略已更新' as status,
    policyname,
    cmd,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND cmd = 'SELECT'
  AND policyname = 'users_select';

-- ============================================
-- 第四步：检查外键约束
-- ============================================

SELECT 
    '=== 外键约束检查 ===' as section,
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    a.attname as column_name,
    af.attname as referenced_column,
    CASE 
        WHEN condeferrable THEN 'DEFERRABLE'
        ELSE 'NOT DEFERRABLE'
    END as deferrable_status
FROM pg_constraint con
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
WHERE con.contype = 'f'
  AND con.conrelid = 'household_invitations'::regclass
  AND confrelid = 'users'::regclass;

-- ============================================
-- 第五步：测试说明
-- ============================================

SELECT 
    '=== 测试说明 ===' as section,
    '修复完成后，请测试创建邀请功能' as instruction,
    '如果仍然失败，可能需要检查 household_invitations 表的 INSERT 策略' as note;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 修复脚本执行完成！请测试创建邀请功能。' as result;

