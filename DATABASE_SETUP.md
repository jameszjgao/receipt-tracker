# 数据库设置指南

本指南提供了完整的 Supabase 数据库设置步骤，适用于首次安装或全新数据库。

## 前置要求

1. 已创建 Supabase 项目
2. 已获取 Supabase URL 和 Anon Key
3. 已登录 Supabase Dashboard

## 执行步骤

### 步骤 1: 基础表结构

执行 `database.sql` 文件中的 SQL 语句，创建所有基础表结构。

### 步骤 2: 多家庭系统支持

执行 `multi-household-migration.sql` 文件，创建多家庭系统所需的表结构和迁移。

### 步骤 3: 用户创建函数

执行 `update-create-user-function.sql` 文件，创建或更新用户注册时的数据库函数。

**注意**：如果之前已执行过 `create-user-function.sql`，请使用 `update-create-user-function.sql` 进行更新。

### 步骤 4: 用途表

执行 `add-purposes-table.sql` 文件，创建用途（purposes）表。

### 步骤 5: 用户名字段

执行 `add-user-name-field.sql` 文件，为 users 表添加 name 字段。

### 步骤 6: 管理员支持

执行 `add-household-admin-support.sql` 文件，为家庭添加管理员支持。

### 步骤 7: RLS 策略修复

按顺序执行以下 SQL 脚本：

1. **家庭表策略**
   - 执行 `fix-households-insert-policy.sql` 或 `fix-households-rls-policy.sql`

2. **支付账户策略**
   - 执行 `fix-payment-accounts-rls-complete.sql`
   - 此脚本同时更新了默认分类和支付账户的创建函数

3. **用途策略**
   - 执行 `fix-purposes-rls-complete.sql`

4. **用户家庭关联策略**
   - 执行 `update-user-households-rls-for-admin.sql`

### 步骤 8: 默认数据函数

1. **更新默认分类**
   - 执行 `update-default-categories-to-english.sql`
   - 将默认分类更新为英文版本（11个分类）

2. **创建默认用途函数**
   - 执行 `create-default-purposes-function.sql`
   - 创建默认用途（Home, Gifts, Business）的数据库函数

### 步骤 9: Storage 设置

1. 在 Supabase Dashboard > Storage 中创建 Bucket
2. 命名为 `receipts`
3. 设置为 **Public**（或根据需要配置访问策略）
4. 参考 `STORAGE_RLS_SETUP.md`（如存在）进行详细配置

### 步骤 10: 验证

执行以下 SQL 查询验证设置是否正确：

```sql
-- 检查表结构
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 检查函数是否存在
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 检查策略
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## SQL 脚本执行顺序总结

1. `database.sql` - 基础表结构
2. `multi-household-migration.sql` - 多家庭系统
3. `update-create-user-function.sql` - 用户创建函数
4. `add-purposes-table.sql` - 用途表
5. `add-user-name-field.sql` - 用户名字段
6. `add-household-admin-support.sql` - 管理员支持
7. `fix-households-insert-policy.sql` - 家庭插入策略
8. `fix-payment-accounts-rls-complete.sql` - 支付账户 RLS
9. `fix-purposes-rls-complete.sql` - 用途 RLS
10. `update-user-households-rls-for-admin.sql` - 管理员权限
11. `update-default-categories-to-english.sql` - 默认分类（英文）
12. `create-default-purposes-function.sql` - 默认用途函数

## 重要提示

1. **执行顺序很重要**：请按照上述顺序执行 SQL 脚本，因为某些脚本依赖前面脚本创建的结构。

2. **备份数据**：如果数据库已有数据，请在执行迁移脚本前进行备份。

3. **测试环境**：建议先在测试环境中执行所有脚本，验证无误后再在生产环境执行。

4. **错误处理**：如果执行脚本时出现错误，请：
   - 检查错误信息
   - 查看相关文档（如 `QUICK_FIX_INSTRUCTIONS.md`）
   - 确认前置条件是否满足

## 常见问题

### Q: 执行脚本时提示"函数已存在"
A: 这通常不是错误，`CREATE OR REPLACE FUNCTION` 会更新现有函数。如果仍有问题，可以先 `DROP FUNCTION` 再执行。

### Q: 提示"策略已存在"
A: 脚本中通常包含 `DROP POLICY IF EXISTS`，会自动处理。如果手动删除策略后仍有问题，请检查策略名称是否正确。

### Q: 注册新用户时失败
A: 检查：
- 是否执行了所有必要的 RLS 策略脚本
- `create_user_with_household` 函数是否存在
- Storage Bucket 是否已创建

## 下一步

设置完成后，请：
1. 测试用户注册功能
2. 测试家庭创建功能
3. 测试小票拍摄和识别功能
4. 验证默认分类、用途、支付账户是否正确创建

