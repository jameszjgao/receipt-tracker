# 数据库迁移执行顺序

## 重要提示

由于 RLS 策略依赖于数据库函数，我们需要按照特定顺序执行迁移脚本，避免依赖错误。

## 执行顺序

### 步骤 1：更新 RLS 策略（必须先执行）
**文件：`update-rls-policies.sql`**

这个脚本会：
- 更新所有 RLS 策略使用新函数（`is_admin_of_space`, `get_user_space_id` 等）
- 保留旧策略名称作为别名（向后兼容）
- 确保策略不再依赖旧函数

**为什么先执行？**
- RLS 策略可能依赖旧函数（如 `is_admin_of_household`）
- 如果先删除旧函数，会导致策略失效
- 先更新策略，让它们使用新函数或新逻辑

### 步骤 2：更新数据库函数
**文件：`update-database-functions.sql`**

这个脚本会：
- 创建所有新函数（使用 `space` 和 `supplier`）
- 更新旧函数实现（不删除，直接替换为调用新函数）
- 确保向后兼容

**为什么后执行？**
- 策略已经更新，不再依赖旧函数的特定实现
- 旧函数现在只是调用新函数的包装器
- 可以安全地更新函数实现

## 完整迁移流程

1. ✅ **表重命名** - `rename-household-to-space-and-store-to-supplier-fixed.sql`
2. ✅ **列重命名** - `fix-remaining-columns.sql`
3. ✅ **唯一约束更新** - `fix-remaining-constraints.sql`
4. ⏳ **RLS 策略更新** - `update-rls-policies.sql` ← **当前步骤**
5. ⏳ **函数更新** - `update-database-functions.sql` ← **下一步**
6. ⏳ **验证** - `verify-migration-complete.sql`

## 如果遇到依赖错误

如果执行 `update-database-functions.sql` 时仍然遇到依赖错误：

1. **检查哪些策略仍在使用旧函数**：
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE qual LIKE '%household%' 
   OR qual LIKE '%store%'
   OR with_check LIKE '%household%'
   OR with_check LIKE '%store%';
```

2. **手动更新这些策略**，让它们使用新函数或新逻辑

3. **然后重新执行函数更新脚本**

## 验证

执行完所有脚本后，运行：
```sql
-- 检查函数
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name LIKE '%household%' OR routine_name LIKE '%store%');

-- 检查策略
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND (policyname LIKE '%household%' OR policyname LIKE '%store%');
```
