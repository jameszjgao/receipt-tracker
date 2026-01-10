# 修复 household_invitations 插入权限问题 - 完整指南

## 🎯 问题根源

1. **外键约束与 RLS 冲突**：`household_invitations.inviter_id` 的外键约束在插入时需要检查 `users` 表，但 RLS 策略阻止了访问
2. **业务逻辑**：`inviter_id` 总是等于 `auth.uid()`（当前登录用户），不需要外键约束验证

## ✅ 解决方案

**移除外键约束**，因为业务上只能创建"自己"发出的邀请，应用层已经保证了 `inviter_id = auth.uid()`

## 📋 执行步骤

### 第一步：执行 SQL 修复脚本

1. 打开 **Supabase Dashboard**
2. 进入 **SQL Editor**
3. 复制并执行 `fix-remove-fk-constraint.sql` 的全部内容
4. 检查执行结果，应该看到：
   - ✅ 外键约束已移除
   - ✅ INSERT 策略已创建
   - ✅ 诊断信息显示一切正常

### 第二步：重启应用

**重要**：代码已经更新，但需要重启应用才能生效

1. **如果使用 Expo**：
   ```bash
   # 停止当前应用（Ctrl+C）
   # 清除缓存并重启
   npx expo start --clear
   ```

2. **如果使用其他方式**：
   - 完全停止应用
   - 清除缓存
   - 重新启动

### 第三步：验证修复

1. 尝试创建邀请
2. 应该不再出现 "permission denied for table users" 错误
3. 如果仍有问题，检查：
   - 应用是否已重启
   - SQL 脚本是否成功执行
   - 查看诊断信息

## 🔍 诊断信息说明

执行 SQL 脚本后，会显示以下诊断信息：

1. **外键约束检查**：
   - ✅ 外键约束已移除：正常
   - ❌ 仍有外键约束存在：需要手动移除

2. **INSERT 策略检查**：
   - ✅ INSERT 策略已创建：正常
   - ❌ 没有 INSERT 策略：需要重新创建

3. **INSERT 策略内容检查**：
   - ✅ 策略只查询 user_households 表：正确
   - ⚠️  策略中包含 users 表查询：有问题，需要修复

## ⚠️ 常见问题

### Q1: 执行 SQL 脚本后仍然报错？

**A**: 检查以下几点：
1. 应用是否已重启（代码已更新，需要重启）
2. 外键约束是否真的被移除（查看诊断信息）
3. INSERT 策略是否正确（查看诊断信息）

### Q2: 如何确认外键约束已移除？

**A**: 执行以下 SQL：
```sql
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'household_invitations'
  AND kcu.column_name = 'inviter_id';
```

如果没有结果，说明外键约束已移除。

### Q3: 如何确认 INSERT 策略正确？

**A**: 执行以下 SQL：
```sql
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'household_invitations'
  AND cmd = 'INSERT';
```

`with_check` 应该只包含 `user_households` 表的查询，不应该包含 `users` 表。

## 📝 代码变更说明

代码已经更新：
- ✅ 移除了复杂的 RPC 函数逻辑
- ✅ 直接使用简单的 INSERT 操作
- ✅ `inviter_id` 由应用层保证等于当前用户 ID

**注意**：代码已更新，但需要重启应用才能生效。

## 🎉 修复后的优势

1. **解决根本问题**：不再有外键约束与 RLS 冲突
2. **简化架构**：代码更简单，易于维护
3. **性能更好**：减少数据库检查开销
4. **业务逻辑清晰**：`inviter_id` 总是等于当前用户，不需要外键验证

