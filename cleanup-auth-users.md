# 清理 Supabase Auth 用户记录

## 问题
注册时遇到外键约束错误：`insert or update on table "users" violates foreign key constraint "users_id_fkey"`

这是因为 `auth.users` 表中仍然存在该邮箱的用户记录，但数据库 `users` 表中的记录已被删除。

## 解决方案

### 方法 1：在 Supabase Dashboard 中删除 Auth 用户（推荐）

1. **打开 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 登录并选择你的项目

2. **进入 Authentication > Users**
   - 点击左侧菜单的 **"Authentication"**
   - 点击 **"Users"** 标签

3. **查找并删除用户**
   - 在搜索框中输入邮箱地址
   - 找到对应的用户记录
   - 点击用户记录右侧的 **"..."** 菜单
   - 选择 **"Delete user"** 或 **"删除用户"**
   - 确认删除

4. **重新尝试注册**
   - 删除后，可以重新使用该邮箱注册

### 方法 2：使用 SQL 删除（需要超级用户权限）

在 Supabase SQL Editor 中执行：

```sql
-- 注意：这需要超级用户权限，可能无法在 Supabase 免费版中执行
-- 查找用户
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- 删除用户（需要管理员权限）
DELETE FROM auth.users 
WHERE email = 'your-email@example.com';
```

### 方法 3：使用不同的邮箱注册

如果无法删除旧用户，可以使用不同的邮箱地址进行注册。

## 验证

删除 Auth 用户后：
- 可以使用该邮箱重新注册
- 不会再出现外键约束错误
- 新的注册会创建完整的用户记录

