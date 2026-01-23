# SQL 文件清理指南

## 使用方法

### 方法 1：使用 Python 脚本（推荐）

1. 将原始 SQL 导出文件保存为 `original-schema.sql`
2. 运行清理脚本：

```bash
python3 clean-schema.py < original-schema.sql > create-new-project-schema.sql
```

### 方法 2：手动处理

如果 Python 脚本无法处理所有情况，可以手动执行以下替换：

#### 表名替换
- `households` → `spaces`
- `stores` → `suppliers`
- `user_households` → `user_spaces`
- `store_merge_history` → `supplier_merge_history`
- `household_invitations` → `space_invitations`

#### 列名替换
- `household_id` → `space_id`
- `current_household_id` → `current_space_id`
- `store_id` → `supplier_id`
- `store_name` → `supplier_name`
- `household_name` → `space_name`
- `source_store_name` → `source_supplier_name`
- `target_store_id` → `target_supplier_id`

#### 函数名替换
- `check_household_has_admin` → `check_space_has_admin`
- `create_household_invitation` → `create_space_invitation`
- `create_household_with_user` → `create_space_with_user`
- `create_user_with_household` → `create_user_with_space`
- `get_household_member_users` → `get_space_member_users`
- `get_household_members_with_last_signin` → `get_space_members_with_last_signin`
- `get_invitation_by_household_email` → `get_invitation_by_space_email`
- `get_user_household_id` → `get_user_space_id`
- `get_user_household_ids` → `get_user_space_ids`
- `get_user_household_ids_for_rls` → `get_user_space_ids_for_rls`
- `get_user_current_household_id` → `get_user_current_space_id`
- `insert_household_invitation` → `insert_space_invitation`
- `is_admin_of_household` → `is_admin_of_space`
- `is_household_admin` → `is_space_admin`
- `is_user_household_admin` → `is_user_space_admin`
- `remove_household_member` → `remove_space_member`
- `update_user_current_household` → `update_user_current_space`
- `user_belongs_to_household` → `user_belongs_to_space`
- `users_in_same_household` → `users_in_same_space`

#### 函数参数替换
- `p_household_id` → `p_space_id`
- `p_household_name` → `p_space_name`
- `p_household_address` → `p_space_address`

#### 索引名替换
- `idx_household_*` → `idx_space_*`
- `idx_store_*` → `idx_supplier_*`
- `idx_user_households_*` → `idx_user_spaces_*`
- `idx_store_merge_history_*` → `idx_supplier_merge_history_*`
- `idx_household_invitations_*` → `idx_space_invitations_*`

#### 约束名替换
- `households_pkey` → `spaces_pkey`
- `stores_pkey` → `suppliers_pkey`
- `user_households_pkey` → `user_spaces_pkey`
- `store_merge_history_pkey` → `supplier_merge_history_pkey`
- `household_invitations_pkey` → `space_invitations_pkey`
- `stores_household_id_name_key` → `suppliers_space_id_name_key`
- `household_invitations_unique_email` → `space_invitations_unique_email`

#### 外键约束名替换
- `*_household_id_fkey` → `*_space_id_fkey`
- `*_store_id_fkey` → `*_supplier_id_fkey`
- `*_target_store_id_fkey` → `*_target_supplier_id_fkey`

#### 触发器名替换
- `update_households_updated_at` → `update_spaces_updated_at`
- `update_stores_updated_at` → `update_suppliers_updated_at`

#### RLS 策略名替换
- `household_invitations_*` → `space_invitations_*`
- `households_*` → `spaces_*`
- `user_households_*` → `user_spaces_*`
- `store_merge_history_*` → `supplier_merge_history_*`
- `stores_*` → `suppliers_*`

## 验证

清理后，检查以下内容：

1. 所有表名已更新
2. 所有列名已更新
3. 所有函数名已更新
4. 所有索引名已更新
5. 所有约束名已更新
6. 所有外键引用已更新
7. 所有 RLS 策略已更新

## 执行顺序

1. 在新 Supabase 项目中执行清理后的 SQL 文件
2. 验证所有表、函数、索引都已创建
3. 测试基本功能
