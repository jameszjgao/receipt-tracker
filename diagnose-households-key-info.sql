-- ============================================
-- 关键诊断信息 - 检查 households 插入问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查当前用户身份和角色（最关键！）
SELECT 
    'Current User Info' as check_type,
    current_user,
    session_user,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role,
    CASE 
        WHEN auth.role() = 'authenticated' THEN '✓ Role is authenticated'
        WHEN auth.role() = 'anon' THEN '✗ Role is anon (not authenticated!)'
        WHEN auth.role() = 'service_role' THEN '✓ Role is service_role (bypasses RLS)'
        ELSE '? Unknown role: ' || auth.role()
    END as role_status;

-- 2. 检查 households 表的所有 RLS 策略（详细）
SELECT 
    'RLS Policies Detail' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check,
    CASE 
        WHEN cmd = 'INSERT' AND 'public' = ANY(roles) AND with_check = 'true' THEN '✓ INSERT allows public'
        WHEN cmd = 'INSERT' AND 'authenticated' = ANY(roles) AND with_check = 'true' THEN '✓ INSERT allows authenticated'
        WHEN cmd = 'INSERT' AND with_check IS NULL THEN '✗ INSERT missing WITH CHECK'
        WHEN cmd = 'INSERT' AND with_check != 'true' THEN '✗ INSERT WITH CHECK is not true'
        ELSE 'Check manually'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- 3. 检查 RLS 是否启用
SELECT 
    'RLS Enabled' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✓ RLS is enabled'
        ELSE '✗ RLS is disabled'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 4. 尝试测试插入（模拟应用的行为）
-- 这会告诉我们策略是否真的工作
DO $$
DECLARE
    test_id UUID;
    test_result TEXT;
BEGIN
    -- 尝试插入
    BEGIN
        INSERT INTO households (name, address)
        VALUES ('Diagnostic Test Household', 'Test Address')
        RETURNING id INTO test_id;
        
        test_result := '✓ INSERT SUCCESSFUL - Household ID: ' || test_id::TEXT;
        
        -- 删除测试数据
        DELETE FROM households WHERE id = test_id;
        test_result := test_result || ' (test record deleted)';
        
        RAISE NOTICE '%', test_result;
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE '✗ INSERT FAILED: Insufficient privilege (RLS policy blocked)';
            RAISE NOTICE '   Error Code: 42501';
            RAISE NOTICE '   This means the RLS policy is blocking the insert.';
            RAISE NOTICE '   Check: 1) Is auth.role() = authenticated? 2) Does policy allow your role?';
        WHEN OTHERS THEN
            RAISE NOTICE '✗ INSERT FAILED: %', SQLERRM;
            RAISE NOTICE '   Error Code: %', SQLSTATE;
    END;
END $$;

-- 5. 检查是否有触发器可能阻止插入
SELECT 
    'Triggers' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'households';

-- 6. 检查表结构（确保没有缺失的必填字段）
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' AND column_default IS NULL THEN '⚠ Required field (no default)'
        WHEN is_nullable = 'NO' AND column_default IS NOT NULL THEN '✓ Required field (has default)'
        ELSE '✓ Optional field'
    END as field_status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'households'
ORDER BY ordinal_position;



