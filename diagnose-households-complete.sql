-- ============================================
-- 全面诊断 households 表创建问题
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 检查表结构
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'households'
ORDER BY ordinal_position;

-- 2. 检查 RLS 是否启用
SELECT 
    'RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'households';

-- 3. 检查所有 RLS 策略（包括所有操作类型）
SELECT 
    'All RLS Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'households'
ORDER BY cmd, policyname;

-- 4. 检查是否有触发器
SELECT 
    'Triggers' as check_type,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'households';

-- 5. 检查是否有外键约束（可能影响插入）
SELECT
    'Foreign Keys' as check_type,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'households';

-- 6. 检查是否有 CHECK 约束
SELECT
    'Check Constraints' as check_type,
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'households'
      AND constraint_type = 'CHECK'
  );

-- 7. 检查当前用户身份和角色
SELECT 
    'Current User' as check_type,
    current_user,
    session_user,
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role;

-- 8. 尝试直接插入测试（如果策略正确，应该成功）
-- 注意：这个操作会创建一个测试家庭，执行后可以删除
DO $$
DECLARE
    test_id UUID;
BEGIN
    INSERT INTO households (name, address)
    VALUES ('Diagnostic Test Household', 'Test Address')
    RETURNING id INTO test_id;
    
    RAISE NOTICE 'Test insert successful! Household ID: %', test_id;
    
    -- 删除测试数据
    DELETE FROM households WHERE id = test_id;
    RAISE NOTICE 'Test household deleted.';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test insert failed! Error: %', SQLERRM;
        RAISE NOTICE 'Error code: %', SQLSTATE;
END $$;

-- 9. 检查是否有其他表引用 households（可能影响插入）
SELECT
    'Referencing Tables' as check_type,
    tc.table_name as referencing_table,
    kcu.column_name as referencing_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'households'
  AND ccu.table_schema = 'public';

