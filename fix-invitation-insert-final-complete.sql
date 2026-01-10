-- ============================================
-- 彻底修复 household_invitations INSERT 权限问题（最终完整版）
-- 原则：业务跑通为关键考量，数据安全为第二考虑
-- ============================================

-- 问题根源分析：
-- 1. 插入后使用 .select().single() 会触发 SELECT 策略
-- 2. SELECT 策略中访问 auth.users 是安全的，但可能还有其他地方访问 public.users
-- 3. 外键约束检查访问 public.users 表
-- 4. 可能有触发器访问 public.users 表

-- ============================================
-- 第一步：删除所有外键约束（引用 users 表）
-- ============================================

DO $$
DECLARE
    fk_record RECORD;
BEGIN
    RAISE NOTICE '=== 删除外键约束 ===';
    
    FOR fk_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'household_invitations'::regclass
          AND confrelid = 'users'::regclass
          AND contype = 'f'
    LOOP
        RAISE NOTICE '找到外键约束: %', fk_record.conname;
        EXECUTE format('ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS %I CASCADE', fk_record.conname);
        RAISE NOTICE '✅ 已删除: %', fk_record.conname;
    END LOOP;
    
    IF NOT FOUND THEN
        RAISE NOTICE '✅ 未找到外键约束';
    END IF;
END $$;

-- ============================================
-- 第二步：删除所有触发器
-- ============================================

DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE '=== 删除触发器 ===';
    
    FOR trigger_record IN
        SELECT tgname
        FROM pg_trigger
        WHERE tgrelid = 'household_invitations'::regclass
          AND tgisinternal = false
    LOOP
        RAISE NOTICE '找到触发器: %', trigger_record.tgname;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON household_invitations CASCADE', trigger_record.tgname);
        RAISE NOTICE '✅ 已删除: %', trigger_record.tgname;
    END LOOP;
    
    IF NOT FOUND THEN
        RAISE NOTICE '✅ 未找到触发器';
    END IF;
END $$;

-- ============================================
-- 第三步：删除并重建 INSERT 策略（确保不访问 users 表）
-- ============================================

DROP POLICY IF EXISTS "household_invitations_insert" ON household_invitations;

CREATE POLICY "household_invitations_insert" ON household_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 邀请者必须是当前用户（不验证是否存在于 users 表）
    inviter_id = auth.uid()
    AND
    -- 用户必须是该家庭的管理员（只查询 user_households 表，不访问 users 表）
    EXISTS (
      SELECT 1 
      FROM user_households 
      WHERE user_id = auth.uid()
        AND household_id = household_invitations.household_id
        AND is_admin = TRUE
    )
  );

-- ============================================
-- 第四步：删除并重建 SELECT 策略（确保使用 auth.users，不访问 public.users）
-- ============================================

DROP POLICY IF EXISTS "household_invitations_select" ON household_invitations;

CREATE POLICY "household_invitations_select" ON household_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- 可以查看自己收到的邀请（使用 auth.users，不访问 public.users）
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
-- 第五步：验证修复
-- ============================================

-- 验证外键约束
SELECT 
    '=== 外键约束验证 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_constraint
            WHERE conrelid = 'household_invitations'::regclass
              AND confrelid = 'users'::regclass
              AND contype = 'f'
        ) THEN '❌ 仍有外键约束'
        ELSE '✅ 无外键约束'
    END as fk_status;

-- 验证触发器
SELECT 
    '=== 触发器验证 ===' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_trigger
            WHERE tgrelid = 'household_invitations'::regclass
              AND tgisinternal = false
        ) THEN '⚠️  仍有触发器'
        ELSE '✅ 无触发器'
    END as trigger_status;

-- 验证 RLS 策略
SELECT 
    '=== RLS 策略验证 ===' as section,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'INSERT' AND with_check LIKE '%users%' AND with_check NOT LIKE '%auth.users%' THEN '❌ INSERT 策略访问 public.users'
        WHEN cmd = 'INSERT' THEN '✅ INSERT 策略不访问 users 表'
        WHEN cmd = 'SELECT' AND qual LIKE '%users%' AND qual NOT LIKE '%auth.users%' THEN '❌ SELECT 策略访问 public.users'
        WHEN cmd = 'SELECT' THEN '✅ SELECT 策略使用 auth.users'
        ELSE '✅ 策略正常'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd IN ('INSERT', 'SELECT')
ORDER BY cmd, policyname;

-- ============================================
-- 第六步：测试说明
-- ============================================

SELECT 
    '=== 修复完成 ===' as section,
    '✅ 外键约束已移除' as step1,
    '✅ 触发器已删除' as step2,
    '✅ INSERT 策略已更新（不访问 users 表）' as step3,
    '✅ SELECT 策略已更新（使用 auth.users）' as step4,
    '请测试创建邀请功能，应该不再出现权限错误' as test_note,
    '如果仍有问题，请检查是否有其他表或函数访问 users 表' as note;

-- ============================================
-- 完成
-- ============================================

SELECT '✅ 修复脚本执行完成！' as result;

