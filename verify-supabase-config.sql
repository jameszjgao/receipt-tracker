-- ============================================
-- Supabase 配置快速验证脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ============================================
-- 1. 检查表名
-- ============================================
SELECT 
  '📋 表名检查' as check_type,
  CASE 
    WHEN table_name IN ('spaces', 'user_spaces', 'suppliers', 'supplier_merge_history', 
                        'space_invitations', 'users', 'receipts', 'receipt_items',
                        'categories', 'purposes', 'payment_accounts', 
                        'payment_account_merge_history', 'ai_chat_logs') 
    THEN '✅ ' || table_name
    ELSE '❌ ' || table_name || ' (不应存在)'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'spaces', 'user_spaces', 'suppliers', 'supplier_merge_history',
    'space_invitations', 'users', 'receipts', 'receipt_items',
    'categories', 'purposes', 'payment_accounts', 
    'payment_account_merge_history', 'ai_chat_logs',
    -- 旧表名（不应存在）
    'households', 'stores', 'user_households', 'store_merge_history', 'household_invitations'
  )
ORDER BY 
  CASE WHEN table_name IN ('households', 'stores', 'user_households', 'store_merge_history', 'household_invitations') THEN 1 ELSE 0 END,
  table_name;

-- ============================================
-- 2. 检查旧列名（不应存在）
-- ============================================
SELECT 
  '📋 旧列名检查' as check_type,
  table_name,
  column_name,
  '❌ 需要重命名或删除' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('household_id', 'current_household_id', 'store_id', 'store_name')
ORDER BY table_name, column_name;

-- ============================================
-- 3. 检查新列名（必须存在）
-- ============================================
SELECT 
  '📋 新列名检查' as check_type,
  table_name,
  column_name,
  '✅ 已更新' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'users' AND column_name IN ('current_space_id', 'space_id'))
    OR (table_name IN ('spaces', 'user_spaces', 'categories', 'purposes', 'payment_accounts', 
                       'receipts', 'suppliers', 'space_invitations', 'ai_chat_logs', 
                       'payment_account_merge_history', 'supplier_merge_history') 
        AND column_name = 'space_id')
    OR (table_name = 'receipts' AND column_name IN ('supplier_id', 'supplier_name'))
  )
ORDER BY table_name, column_name;

-- ============================================
-- 4. 检查 RPC 函数（新命名）
-- ============================================
SELECT 
  '📋 RPC 函数检查（新命名）' as check_type,
  routine_name,
  CASE 
    WHEN routine_name IN (
      'get_user_space_id', 'get_user_space_ids', 'get_user_space_ids_for_rls',
      'update_user_current_space', 'create_space_with_user', 'create_user_with_space',
      'get_space_member_users', 'get_space_members_with_last_signin', 'remove_space_member',
      'is_space_admin', 'is_user_space_admin', 'is_admin_of_space',
      'create_space_invitation', 'get_invitation_by_space_email',
      'create_default_categories', 'create_default_payment_accounts', 'create_default_purposes',
      'update_user_name', 'get_user_by_id', 'update_invitations_status_batch'
    ) THEN '✅ 已创建'
    ELSE '❌ 未找到'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'get_user_space_id', 'get_user_space_ids', 'get_user_space_ids_for_rls',
    'update_user_current_space', 'create_space_with_user', 'create_user_with_space',
    'get_space_member_users', 'get_space_members_with_last_signin', 'remove_space_member',
    'is_space_admin', 'is_user_space_admin', 'is_admin_of_space',
    'create_space_invitation', 'get_invitation_by_space_email',
    'create_default_categories', 'create_default_payment_accounts', 'create_default_purposes',
    'update_user_name', 'get_user_by_id', 'update_invitations_status_batch'
  )
ORDER BY routine_name;

-- ============================================
-- 5. 检查 RLS 策略（新命名）
-- ============================================
SELECT 
  '📋 RLS 策略检查' as check_type,
  tablename,
  policyname,
  CASE 
    WHEN policyname LIKE 'space_%' OR policyname LIKE 'supplier_%' OR 
         policyname LIKE '%_space_%' OR policyname LIKE '%_supplier_%' OR
         policyname LIKE 'user_spaces_%' OR policyname LIKE 'space_invitations_%'
    THEN '✅ 已更新'
    WHEN policyname LIKE 'household_%' OR policyname LIKE 'store_%' OR
         policyname LIKE '%_household_%' OR policyname LIKE '%_store_%' OR
         policyname LIKE 'user_households_%' OR policyname LIKE 'household_invitations_%'
    THEN '❌ 需要更新（旧命名）'
    ELSE '⚠️  检查命名'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%space%' OR 
    policyname LIKE '%supplier%' OR
    policyname LIKE '%household%' OR 
    policyname LIKE '%store%'
  )
ORDER BY 
  CASE WHEN policyname LIKE '%household%' OR policyname LIKE '%store%' THEN 1 ELSE 0 END,
  tablename, 
  policyname;

-- ============================================
-- 6. 检查外键约束
-- ============================================
SELECT 
  '📋 外键约束检查' as check_type,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN ccu.table_name IN ('spaces', 'user_spaces', 'suppliers') 
         AND ccu.column_name IN ('id', 'space_id', 'supplier_id')
    THEN '✅ 已更新'
    WHEN ccu.table_name IN ('households', 'stores', 'user_households')
         OR ccu.column_name IN ('household_id', 'store_id')
    THEN '❌ 需要更新（旧命名）'
    ELSE '⚠️  检查'
  END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    ccu.table_name IN ('spaces', 'user_spaces', 'suppliers', 'households', 'stores', 'user_households')
    OR ccu.column_name IN ('space_id', 'supplier_id', 'household_id', 'store_id')
  )
ORDER BY 
  CASE WHEN ccu.table_name IN ('households', 'stores', 'user_households') 
            OR ccu.column_name IN ('household_id', 'store_id') 
       THEN 1 ELSE 0 END,
  tc.table_name,
  tc.constraint_name;

-- ============================================
-- 7. 检查唯一约束
-- ============================================
SELECT 
  '📋 唯一约束检查' as check_type,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
  CASE 
    WHEN tc.constraint_name LIKE '%space_id%' OR tc.constraint_name LIKE '%supplier_id%'
    THEN '✅ 已更新'
    WHEN tc.constraint_name LIKE '%household_id%' OR tc.constraint_name LIKE '%store_id%'
    THEN '❌ 需要更新（旧命名）'
    ELSE '⚠️  检查'
  END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND (
    tc.constraint_name LIKE '%space%' OR 
    tc.constraint_name LIKE '%supplier%' OR
    tc.constraint_name LIKE '%household%' OR 
    tc.constraint_name LIKE '%store%'
  )
GROUP BY tc.table_name, tc.constraint_name
ORDER BY 
  CASE WHEN tc.constraint_name LIKE '%household%' OR tc.constraint_name LIKE '%store%' THEN 1 ELSE 0 END,
  tc.table_name,
  tc.constraint_name;

-- ============================================
-- 8. 总结报告
-- ============================================
SELECT 
  '📊 总结报告' as check_type,
  '检查完成' as status,
  '请查看上述结果，确保所有项目都标记为 ✅' as message;
