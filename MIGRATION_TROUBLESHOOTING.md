# 迁移脚本故障排除指南

## 常见错误及解决方案

### 错误 1: "relation does not exist"
**错误信息**: `ERROR: relation "households" does not exist`

**原因**: 表已经被重命名或不存在

**解决**: 
1. 运行 `diagnose-migration-status.sql` 检查当前状态
2. 如果表已经重命名，跳过该步骤
3. 使用修复版脚本：`rename-household-to-space-and-store-to-supplier-fixed.sql`

### 错误 2: "column does not exist"
**错误信息**: `ERROR: column "household_id" does not exist`

**原因**: 列已经被重命名或不存在

**解决**:
1. 检查列是否已存在：`SELECT column_name FROM information_schema.columns WHERE table_name = 'users';`
2. 使用修复版脚本，它包含存在性检查

### 错误 3: "constraint does not exist"
**错误信息**: `ERROR: constraint "categories_household_id_name_key" does not exist`

**原因**: 约束已经被删除或不存在

**解决**: 使用修复版脚本，它使用 `IF EXISTS` 和 `IF NOT EXISTS` 检查

### 错误 4: "foreign key constraint violation"
**错误信息**: `ERROR: update or delete on table "spaces" violates foreign key constraint`

**原因**: 外键约束引用问题

**解决**:
1. 先更新所有外键约束
2. 确保所有相关表都已重命名
3. 使用修复版脚本，它按正确顺序处理外键

### 错误 5: "index does not exist"
**错误信息**: `ERROR: index "idx_users_household_id" does not exist`

**原因**: 索引已经被删除或不存在

**解决**: 使用 `DROP INDEX IF EXISTS` 语句（修复版脚本已包含）

## 执行步骤

### 步骤 1: 诊断当前状态
```sql
-- 在 Supabase SQL Editor 中执行
-- 运行 diagnose-migration-status.sql
```

### 步骤 2: 备份数据库
**重要**: 在执行迁移前，请备份数据库！

### 步骤 3: 执行修复版迁移脚本
```sql
-- 使用 rename-household-to-space-and-store-to-supplier-fixed.sql
-- 这个脚本包含所有必要的检查，可以安全地多次执行
```

### 步骤 4: 验证迁移
```sql
-- 检查表
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('spaces', 'suppliers', 'user_spaces');

-- 检查列
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('space_id', 'supplier_id', 'current_space_id');
```

## 如果迁移部分完成

如果迁移脚本执行到一半出错，可以：

1. **检查当前状态**: 运行 `diagnose-migration-status.sql`
2. **继续执行**: 修复版脚本可以安全地多次执行，会自动跳过已完成的步骤
3. **手动修复**: 根据诊断结果，手动执行剩余的步骤

## 回滚方案

如果需要回滚（不推荐，除非有备份）：

1. 恢复数据库备份
2. 或者手动执行反向重命名（space -> household, supplier -> store）

## 需要帮助？

如果遇到其他错误，请提供：
1. 完整的错误信息
2. 执行到哪一步出错
3. 运行 `diagnose-migration-status.sql` 的结果
