# SQL 文件说明

## 文件用途

### 1. `rename-household-to-space-and-store-to-supplier.sql`
**用途**：迁移脚本，用于在**已有数据**的项目中重命名表、列、函数等
**适用场景**：现有项目需要重命名
**不适用**：新项目（会报错，因为表不存在）

### 2. `create-new-project-schema.sql`（需要创建）
**用途**：完整的数据库创建脚本，已清理所有命名（household→space, store→supplier）
**适用场景**：新 Supabase 项目
**包含**：所有 CREATE TABLE、CREATE FUNCTION、CREATE INDEX 等语句

## 如何创建完整的 SQL 文件

### 步骤 1：获取原始 SQL 导出

从原 Supabase 项目导出完整结构：
1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 点击 "..." 菜单
4. 选择 "Export schema" 或使用 `pg_dump`

### 步骤 2：清理 SQL 文件

使用提供的 Python 脚本清理：

```bash
# 将导出的 SQL 文件保存为 original-schema.sql
python3 clean-schema.py < original-schema.sql > create-new-project-schema.sql
```

### 步骤 3：在新项目中执行

1. 登录新的 Supabase 项目
2. 进入 SQL Editor
3. 复制 `create-new-project-schema.sql` 的内容
4. 执行

## 如果遇到错误

### 错误：表不存在
- **原因**：使用了迁移脚本而不是创建脚本
- **解决**：使用 `create-new-project-schema.sql`（完整创建脚本）

### 错误：函数已存在
- **原因**：部分函数已创建
- **解决**：使用 `CREATE OR REPLACE FUNCTION` 或先删除再创建

### 错误：外键约束失败
- **原因**：表创建顺序不对
- **解决**：确保按依赖顺序创建表

## 验证

执行后检查：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('spaces', 'suppliers', 'user_spaces', 'space_invitations');

-- 检查函数是否存在
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%space%' OR routine_name LIKE '%supplier%';
```
