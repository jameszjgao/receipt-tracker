-- 清理旧的策略别名（向后兼容策略）
-- 这些策略是为了向后兼容而创建的，但现在代码已更新，不再需要
-- 在 Supabase SQL Editor 中执行此脚本

-- ============================================
-- 1. 删除 space_invitations 表的旧策略别名
-- ============================================
DROP POLICY IF EXISTS "household_invitations_delete_policy" ON space_invitations;
DROP POLICY IF EXISTS "household_invitations_insert_policy" ON space_invitations;
DROP POLICY IF EXISTS "household_invitations_select_policy" ON space_invitations;
DROP POLICY IF EXISTS "household_invitations_update_policy" ON space_invitations;

-- ============================================
-- 2. 删除 user_spaces 表的旧策略别名
-- ============================================
DROP POLICY IF EXISTS "user_households_delete_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_insert_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_select_policy" ON user_spaces;
DROP POLICY IF EXISTS "user_households_update_policy" ON user_spaces;

-- ============================================
-- 3. 删除 suppliers 表的旧策略别名
-- ============================================
DROP POLICY IF EXISTS "stores_manage_policy" ON suppliers;

-- ============================================
-- 4. 删除 supplier_merge_history 表的旧策略别名
-- ============================================
DROP POLICY IF EXISTS "store_merge_history_manage_policy" ON supplier_merge_history;

-- ============================================
-- 验证清理结果
-- ============================================
SELECT '=== 策略清理验证 ===' as info;

SELECT 
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN policyname LIKE '%household%' OR policyname LIKE '%store%' THEN 
            CASE 
                WHEN policyname LIKE '%household%' AND policyname NOT LIKE '%space%' THEN '❌ 仍存在（应删除）'
                WHEN policyname LIKE '%store%' AND policyname NOT LIKE '%supplier%' THEN '❌ 仍存在（应删除）'
                ELSE '⚠️ 已创建别名（建议使用新策略）'
            END
        ELSE '✅ 已更新'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
AND (
    policyname LIKE '%household%' 
    OR policyname LIKE '%store%'
    OR policyname LIKE '%space%'
    OR policyname LIKE '%supplier%'
)
ORDER BY tablename, policyname;
