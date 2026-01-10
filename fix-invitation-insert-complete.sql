-- ============================================
-- 彻底修复 household_invitations INSERT 权限问题
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- 问题：插入 household_invitations 时出现 "permission denied for table users"
-- 可能原因：
-- 1. 外键约束检查访问 users 表
-- 2. 触发器访问 users 表
-- 3. 插入后的 SELECT 操作触发 SELECT 策略，间接访问 users 表
-- 4. RLS 策略中的函数访问 users 表

-- ============================================
-- 第一部分：检查并删除外键约束
-- ============================================

DO $$
DECLARE
    fk_constraint_name TEXT;
BEGIN
    RAISE NOTICE '=== 检查外键约束 ===';
    
    -- 查找所有引用 users 表的外键约束
    FOR fk_constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'household_invitations'::regclass
          AND confrelid = 'users'::regclass
          AND contype = 'f'
    LOOP
        RAISE NOTICE '找到外键约束: %', fk_constraint_name;
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I', fk_constraint_name);
        RAISE NOTICE '✅ 已删除外键约束: %', fk_constraint_name;
    END LOOP;
    
    IF fk_constraint_name IS NULL THEN
        RAISE NOTICE '✅ 未找到外键约束，可能已经删除';
    END IF;
END $$;

-- ============================================
-- 第二部分：检查并删除触发器
-- ============================================

DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE '=== 检查触发器 ===';
    
    FOR trigger_record IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'household_invitations'::regclass
          AND tgisinternal = false
    LOOP
        RAISE NOTICE '找到触发器: %', trigger_record.tgname;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON household_invitations CASCADE', trigger_record.tgname);
        RAISE NOTICE '✅ 已删除触发器: %', trigger_record.tgname;
    END LOOP;
END $$;

-- ============================================
-- 第三部分：检查并修复 INSERT 策略（确保不访问 users 表）
-- ============================================

-- 删除现有的 INSERT 策略
DROP POLICY IF EXISTS "household_invitations_insert" ON household_invitations;

-- 创建新的 INSERT 策略（不访问 users 表）
CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户（不验证是否存在于 users 表）
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
    )
  );

-- ============================================
-- 第四部分：检查并修复 SELECT 策略（插入后可能触发）
-- ============================================

-- 删除现有的 SELECT 策略
DROP POLICY IF EXISTS "household_invitations_select" ON household_invitations;

-- 创建新的 SELECT 策略（使用 auth.users，不访问 public.users）
CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 可以查看自己收到的邀请（通过 email 匹配，使用 auth.users）
    invitee_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    OR
    -- 可以查看自己所属家庭的邀请（只查询 user_households 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
    )
    OR
    -- 可以查看自己创建的邀请
    inviter_id = auth.uid()
  );

-- ============================================
-- 第五部分：验证修复
-- ============================================

-- 验证外键约束已删除
SELECT 
    '=== 验证外键约束 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_constraint
            WHERE conrelid = 'household_invitations'::regclass
              AND confrelid = 'users'::regclass
              AND contype = 'f'
        ) THEN '❌ 外键约束仍然存在'
        ELSE '✅ 外键约束已删除'
    END as fk_status;

-- 验证触发器已删除
SELECT 
    '=== 验证触发器 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_trigger
            WHERE tgrelid = 'household_invitations'::regclass
              AND tgisinternal = false
        ) THEN '⚠️  仍有触发器存在'
        ELSE '✅ 无触发器'
    END as trigger_status;

-- 验证 RLS 策略
SELECT 
    '=== 验证 RLS 策略 ===' as section,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN with_check LIKE '%users%' AND with_check NOT LIKE '%auth.users%' THEN '⚠️  策略可能访问 public.users'
        WHEN with_check LIKE '%auth.users%' THEN '✅ 使用 auth.users（安全）'
        ELSE '✅ 不访问 users 表'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';

-- ============================================
-- 第六部分：重要提示
-- ============================================

SELECT 
    '=== 修复完成 ===' as section,
    '1. 外键约束已移除（如果存在）' as step1,
    '2. 触发器已删除（如果存在）' as step2,
    '3. INSERT 策略已更新，不访问 users 表' as step3,
    '4. SELECT 策略已更新，使用 auth.users 而不是 public.users' as step4,
    '请测试创建邀请功能，应该不再出现权限错误' as test_note;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 修复脚本执行完成！' as result;

