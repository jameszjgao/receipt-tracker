-- ============================================
-- 修复 users 表 RLS 策略，允许外键约束检查
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- 问题：外键约束检查时访问 users 表被 RLS 阻止
-- 解决方案：放宽 users 表的 SELECT 策略，确保外键检查可以访问

-- ============================================
-- 第一步：删除所有现有的 users 表 RLS 策略
-- ============================================

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '=== 开始清理 users 表 RLS 策略 ===';
    
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
        RAISE NOTICE '✅ 删除了策略: %', r.policyname;
    END LOOP;
    
    RAISE NOTICE '✅ 所有 users 表 RLS 策略已清理完成';
END $$;

-- ============================================
-- 第二步：创建宽松的 SELECT 策略（允许外键检查）
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- SELECT: 允许查看自己的记录和同家庭的用户记录
-- 关键：必须允许查看自己的记录（id = auth.uid()），这样外键检查才能通过
-- 注意：外键约束检查时，PostgreSQL 需要能够访问被引用的表
-- 因此必须确保 id = auth.uid() 的条件存在且优先
CREATE POLICY "users_select" ON users
  FOR SELECT
  TO authenticated
  USING (
    -- 关键：可以查看自己的记录（用于外键约束检查）
    -- 这个条件必须存在，否则外键检查会失败
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
-- 第三步：创建 INSERT 策略
-- ============================================

-- INSERT: 用户可以创建自己的记录（注册时）
CREATE POLICY "users_insert" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================
-- 第四步：创建 UPDATE 策略
-- ============================================

-- UPDATE: 用户可以更新自己的记录
CREATE POLICY "users_update" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- 第五步：验证策略已创建
-- ============================================

SELECT 
    '=== 验证 users 表 RLS 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN '有 USING 条件'
        ELSE '无 USING 条件'
    END as has_using,
    CASE 
        WHEN with_check IS NOT NULL THEN '有 WITH CHECK 条件'
        ELSE '无 WITH CHECK 条件'
    END as has_with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================
-- 第六步：测试说明
-- ============================================

SELECT 
    '=== 测试说明 ===' as section,
    '策略已更新，现在应该允许：' as status,
    '1. 用户查看自己的记录（用于外键检查）' as item1,
    '2. 用户查看同家庭的用户记录' as item2,
    '3. 用户创建和更新自己的记录' as item3,
    '请测试创建邀请功能，应该不再出现权限错误' as test_note;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ users 表 RLS 策略修复完成！' as result;

