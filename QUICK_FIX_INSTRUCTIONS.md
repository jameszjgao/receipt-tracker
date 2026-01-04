# 快速修复 RLS 策略 - 执行步骤

## 问题
注册时出现错误：`new row violates row-level security policy for table "households"`

## 解决方案

### 步骤 1: 打开 Supabase Dashboard
1. 访问 https://supabase.com/dashboard
2. 登录你的账户
3. 选择你的项目

### 步骤 2: 打开 SQL Editor
1. 点击左侧菜单的 **"SQL Editor"**
2. 点击 **"New query"** 按钮

### 步骤 3: 执行修复脚本
1. 打开文件 `quick-fix-households.sql`
2. **复制全部内容**（包括所有注释）
3. 粘贴到 SQL Editor
4. 点击右上角的 **"Run"** 按钮（或按 Cmd/Ctrl + Enter）

### 步骤 4: 验证执行成功
执行后应该看到：
- 消息显示 "Success"
- 底部会显示一个表格，列出 households 表的 3 个策略：
  - `households_select`
  - `households_insert` ✅ **这是关键！必须有这个**
  - `households_update`

### 步骤 5: 重新尝试注册
1. 在手机上刷新应用
2. 重新尝试注册
3. 应该可以成功了！

## 如果还是失败

如果执行脚本后仍然失败，请检查：

1. **确认策略已创建**：
   在 SQL Editor 中运行以下查询：
   ```sql
   SELECT policyname, cmd, with_check
   FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'households';
   ```
   应该看到 `households_insert` 策略，且 `cmd` 为 `INSERT`

2. **检查 RLS 是否启用**：
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'households';
   ```
   `rowsecurity` 应该是 `true`

3. **检查用户是否已认证**：
   注册时，用户应该已经通过 `supabase.auth.signUp()` 创建了认证用户。如果这一步失败，也会导致后续失败。

## 常见错误

### 错误：权限不足
- 确保你使用的是项目的管理员账户
- 在 Supabase Dashboard 中，确保你是项目的 owner

### 错误：策略已存在
- 脚本会自动删除旧的策略，这应该不会发生
- 如果遇到，可以先手动删除：
  ```sql
  DROP POLICY IF EXISTS "households_insert" ON households;
  ```
  然后重新执行脚本

