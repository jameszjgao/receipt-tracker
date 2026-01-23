# 重命名 household_invitations 表为 space_invitations

## 📋 执行步骤

### 1. 执行数据库迁移脚本
在 Supabase SQL Editor 中执行：
```sql
-- rename-household-invitations-table.sql
```

这个脚本会：
- ✅ 重命名表：`household_invitations` → `space_invitations`
- ✅ 重命名所有相关索引
- ✅ 验证重命名是否成功

### 2. 更新 RLS 策略（如果需要）
如果 RLS 策略需要更新，执行：
```sql
-- update-rls-policies.sql（已更新为使用 space_invitations）
```

### 3. 更新数据库函数（如果需要）
如果函数中有表引用，执行：
```sql
-- update-database-functions.sql（已更新为使用 space_invitations）
```

## ✅ 已更新的代码文件

### lib/ 目录
- ✅ `lib/household-invitations.ts` - 所有 `.from('household_invitations')` 已更新为 `.from('space_invitations')`

### app/ 目录
- ✅ `app/household-members.tsx` - 所有 `.from('household_invitations')` 已更新为 `.from('space_invitations')`

### SQL 脚本
- ✅ `update-database-functions.sql` - 所有 `household_invitations` 表引用已更新为 `space_invitations`
- ✅ `update-rls-policies.sql` - 所有策略已更新为使用 `space_invitations` 表名
- ✅ `verify-migration-complete.sql` - 验证脚本已更新

## 📝 注意事项

1. **表名已完全更新**：所有代码中的 `household_invitations` 已更新为 `space_invitations`
2. **列名已更新**：表中的列名（如 `space_id`, `space_name`）已在之前的迁移中更新
3. **RLS 策略**：策略名称已更新为 `space_invitations_*_policy`
4. **索引**：所有索引已重命名

## 🎯 执行顺序

1. 先执行 `rename-household-invitations-table.sql` 重命名表
2. 然后执行 `update-rls-policies.sql` 更新策略（如果需要）
3. 最后执行 `update-database-functions.sql` 更新函数（如果需要）

## ✅ 完成

所有代码引用已更新，可以安全地执行数据库迁移脚本。
