# 修复邀请处理页被跳过和 users 表权限错误

## 问题描述

1. **邀请处理页被跳过**：有邀请时应该跳转到 `/handle-invitations`，但实际跳转到了 `/setup-household`
2. **users 表权限错误**：`getCurrentHousehold` 函数报错 "permission denied for table users"

## 修复步骤

### 第一步：执行 SQL 脚本修复 RLS 策略

在 Supabase SQL Editor 中依次执行以下脚本：

#### 1. 修复 users 表的 SELECT 策略
执行 `fix-users-rls-select.sql`：
- 允许用户查询自己的记录（即使还没有 household）
- 允许用户查看同一家庭的成员

#### 2. 修复 households 表的 SELECT 策略（允许查看被邀请的家庭）
执行 `fix-households-select-for-invitations.sql`：
- 允许用户查看自己的家庭
- 允许用户查看收到邀请的家庭

### 第二步：代码修复（已完成）

1. **添加路由**：在 `app/_layout.tsx` 中添加了 `handle-invitations` 和 `setup-household` 路由
2. **修复跳转逻辑**：在 `app/index.tsx` 中，有邀请时跳转到 `/handle-invitations` 而不是 `/setup-household`

## 验证修复

执行 SQL 脚本后，应该：
1. 邀请处理页能正常显示
2. 家庭名称能正确显示（不再是 "Unknown Household"）
3. 不再有 users 表权限错误

## 相关文件

- `fix-users-rls-select.sql` - 修复 users 表 SELECT 策略
- `fix-households-select-for-invitations.sql` - 修复 households 表 SELECT 策略（支持查看被邀请的家庭）
- `app/_layout.tsx` - 添加了路由
- `app/index.tsx` - 修复了跳转逻辑


