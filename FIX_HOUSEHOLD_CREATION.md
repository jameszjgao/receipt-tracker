# 修复两步注册后创建Household的问题

## 问题描述

软件初始设计为一步注册，同时注册user和household。为了支持user和household多对多，改为两步注册，即先注册user，登录后再注册和关联household。但现在出现user注册登录后，注册household不成功的问题。

## 问题原因

1. **RPC函数可能不存在**：`create_household_with_user` 函数可能未在数据库中创建
2. **RLS策略问题**：
   - `households` 表的 INSERT 策略可能不正确
   - `user_households` 表的 INSERT 策略可能不正确
   - `users` 表的 UPDATE 策略可能不允许更新 `current_household_id`
3. **错误处理不完善**：当RPC函数失败时，回退到直接插入的逻辑不够健壮

## 修复步骤

### 第一步：执行SQL修复脚本

在 Supabase SQL Editor 中执行 `fix-household-creation-two-step.sql` 脚本。这个脚本会：

1. 创建或更新 `create_household_with_user` RPC 函数
2. 修复 `households` 表的 INSERT RLS 策略
3. 修复 `user_households` 表的 INSERT RLS 策略
4. 确保 `users` 表的 UPDATE 策略允许更新 `current_household_id`
5. 验证所有策略和函数是否正确

### 第二步：代码修复

已修复 `lib/auth.ts` 中的 `createHousehold` 函数：

1. **改进RPC函数错误处理**：区分函数不存在错误和其他错误
2. **完善直接插入逻辑**：当RPC函数不可用时，直接插入household后，手动创建 `user_households` 关联和更新 `current_household_id`
3. **改进错误信息**：提供更详细的错误信息，帮助诊断问题

### 第三步：验证修复

1. **测试RPC函数**：
   ```sql
   SELECT create_household_with_user('Test Household', 'Test Address', auth.uid());
   ```

2. **测试直接插入**：
   ```sql
   -- 作为已认证用户
   INSERT INTO households (name, address) VALUES ('Test Household 2', 'Test Address 2') RETURNING id;
   ```

3. **测试user_households插入**：
   ```sql
   -- 作为已认证用户
   INSERT INTO user_households (user_id, household_id, is_admin) 
   VALUES (auth.uid(), '<household_id>', TRUE);
   ```

4. **测试应用流程**：
   - 注册新用户
   - 登录
   - 创建household
   - 验证household创建成功

## 关键修复点

### 1. RPC函数 `create_household_with_user`

这个函数使用 `SECURITY DEFINER` 绕过RLS，确保即使RLS策略有问题也能创建household。函数会：
- 创建household
- 如果users表记录不存在，自动创建
- 更新用户的 `current_household_id`
- 创建 `user_households` 关联记录

### 2. RLS策略

- **households INSERT**：允许所有已认证用户创建household（`WITH CHECK (true)`）
- **user_households INSERT**：允许用户创建自己的关联记录（`WITH CHECK (user_id = auth.uid())`）
- **users UPDATE**：允许用户更新自己的记录（包括 `current_household_id`）

### 3. 代码回退逻辑

当RPC函数不可用时，代码会：
1. 直接插入household
2. 创建 `user_households` 关联
3. 更新用户的 `current_household_id`
4. 如果任何步骤失败，尝试清理已创建的数据

## 常见问题

### Q: 执行SQL脚本后仍然失败？

A: 检查以下几点：
1. 确认脚本已完全执行（没有错误）
2. 检查RLS是否启用：`SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('households', 'user_households', 'users');`
3. 检查策略是否正确创建：`SELECT * FROM pg_policies WHERE tablename IN ('households', 'user_households', 'users') AND cmd IN ('INSERT', 'UPDATE');`
4. 检查RPC函数是否存在：`SELECT routine_name FROM information_schema.routines WHERE routine_name = 'create_household_with_user';`

### Q: RPC函数执行成功但查询不到household？

A: 可能是RLS SELECT策略问题。检查 `households` 表的 SELECT 策略是否允许用户查看自己创建的household。

### Q: user_households关联创建失败？

A: 检查 `user_households` 表的 INSERT 策略，确保允许用户创建自己的关联记录。

## 相关文件

- `fix-household-creation-two-step.sql` - SQL修复脚本
- `lib/auth.ts` - 修复后的 `createHousehold` 函数
- `create-household-function.sql` - RPC函数定义（已包含在修复脚本中）

