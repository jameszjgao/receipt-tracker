#!/usr/bin/env python3
"""
清理 SQL 导出文件，将 household -> space, store -> supplier
使用方法: python3 clean-schema.py < input.sql > output.sql
"""
import sys
import re

def clean_sql(content):
    """清理 SQL 内容"""
    
    # 表名替换（必须按顺序，避免部分匹配）
    # 先替换复合名称，再替换简单名称
    content = re.sub(r'\bhousehold_invitations\b', 'space_invitations', content)
    content = re.sub(r'\buser_households\b', 'user_spaces', content)
    content = re.sub(r'\bstore_merge_history\b', 'supplier_merge_history', content)
    content = re.sub(r'\bpayment_account_merge_history\b', 'payment_account_merge_history', content)  # 保持不变
    content = re.sub(r'\bhouseholds\b', 'spaces', content)
    content = re.sub(r'\bstores\b', 'suppliers', content)
    
    # 列名替换
    content = re.sub(r'\bcurrent_household_id\b', 'current_space_id', content)
    content = re.sub(r'\bhousehold_id\b', 'space_id', content)
    content = re.sub(r'\bhousehold_name\b', 'space_name', content)
    content = re.sub(r'\btarget_store_id\b', 'target_supplier_id', content)
    content = re.sub(r'\bsource_store_name\b', 'source_supplier_name', content)
    content = re.sub(r'\bstore_id\b', 'supplier_id', content)
    content = re.sub(r'\bstore_name\b', 'supplier_name', content)
    
    # 函数参数替换
    content = re.sub(r'\bp_household_address\b', 'p_space_address', content)
    content = re.sub(r'\bp_household_name\b', 'p_space_name', content)
    content = re.sub(r'\bp_household_id\b', 'p_space_id', content)
    content = re.sub(r'\bp_store_id\b', 'p_supplier_id', content)
    
    # 函数内部变量替换
    content = re.sub(r'\bv_final_household_name\b', 'v_final_space_name', content)
    content = re.sub(r'\bv_household_name\b', 'v_space_name', content)
    content = re.sub(r'\bv_household_id\b', 'v_space_id', content)
    content = re.sub(r'\bhouseholdData\b', 'spaceData', content)
    content = re.sub(r'\bhouseholdError\b', 'spaceError', content)
    
    # 函数名替换
    replacements = [
        (r'\bcheck_household_has_admin\b', 'check_space_has_admin'),
        (r'\bcreate_household_invitation\b', 'create_space_invitation'),
        (r'\bcreate_household_with_user\b', 'create_space_with_user'),
        (r'\bcreate_user_with_household\b', 'create_user_with_space'),
        (r'\bget_household_member_users\b', 'get_space_member_users'),
        (r'\bget_household_members_with_last_signin\b', 'get_space_members_with_last_signin'),
        (r'\bget_invitation_by_household_email\b', 'get_invitation_by_space_email'),
        (r'\bget_user_household_id\b', 'get_user_space_id'),
        (r'\bget_user_household_ids\b', 'get_user_space_ids'),
        (r'\bget_user_household_ids_for_rls\b', 'get_user_space_ids_for_rls'),
        (r'\bget_user_current_household_id\b', 'get_user_current_space_id'),
        (r'\binsert_household_invitation\b', 'insert_space_invitation'),
        (r'\bis_admin_of_household\b', 'is_admin_of_space'),
        (r'\bis_household_admin\b', 'is_space_admin'),
        (r'\bis_user_household_admin\b', 'is_user_space_admin'),
        (r'\bremove_household_member\b', 'remove_space_member'),
        (r'\bupdate_user_current_household\b', 'update_user_current_space'),
        (r'\buser_belongs_to_household\b', 'user_belongs_to_space'),
        (r'\busers_in_same_household\b', 'users_in_same_space'),
    ]
    
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
    
    # 索引名替换
    content = re.sub(r'\bidx_household_invitations_', 'idx_space_invitations_', content)
    content = re.sub(r'\bidx_user_households_', 'idx_user_spaces_', content)
    content = re.sub(r'\bidx_store_merge_history_', 'idx_supplier_merge_history_', content)
    content = re.sub(r'\bidx_stores_', 'idx_suppliers_', content)
    content = re.sub(r'\bidx_receipts_store_', 'idx_receipts_supplier_', content)
    content = re.sub(r'\bidx_household_', 'idx_space_', content)
    
    # 约束名替换
    content = re.sub(r'\bhousehold_invitations_pkey\b', 'space_invitations_pkey', content)
    content = re.sub(r'\bhousehold_invitations_unique_email\b', 'space_invitations_unique_email', content)
    content = re.sub(r'\buser_households_pkey\b', 'user_spaces_pkey', content)
    content = re.sub(r'\buser_households_user_id_household_id_key\b', 'user_spaces_user_id_space_id_key', content)
    content = re.sub(r'\bstore_merge_history_pkey\b', 'supplier_merge_history_pkey', content)
    content = re.sub(r'\bstores_pkey\b', 'suppliers_pkey', content)
    content = re.sub(r'\bstores_household_id_name_key\b', 'suppliers_space_id_name_key', content)
    content = re.sub(r'\bhouseholds_pkey\b', 'spaces_pkey', content)
    
    # 外键约束名替换
    content = re.sub(r'\bhousehold_id_fkey\b', 'space_id_fkey', content)
    content = re.sub(r'\bstore_id_fkey\b', 'supplier_id_fkey', content)
    content = re.sub(r'\btarget_store_id_fkey\b', 'target_supplier_id_fkey', content)
    content = re.sub(r'\bhousehold_invitations_space_id_fkey\b', 'space_invitations_space_id_fkey', content)
    content = re.sub(r'\buser_households_space_id_fkey\b', 'user_spaces_space_id_fkey', content)
    content = re.sub(r'\bstores_space_id_fkey\b', 'suppliers_space_id_fkey', content)
    content = re.sub(r'\bstore_merge_history_space_id_fkey\b', 'supplier_merge_history_space_id_fkey', content)
    content = re.sub(r'\bstore_merge_history_target_supplier_id_fkey\b', 'supplier_merge_history_target_supplier_id_fkey', content)
    
    # 触发器名替换
    content = re.sub(r'\bupdate_households_updated_at\b', 'update_spaces_updated_at', content)
    content = re.sub(r'\bupdate_stores_updated_at\b', 'update_suppliers_updated_at', content)
    
    # RLS 策略名替换
    content = re.sub(r'\bhousehold_invitations_', 'space_invitations_', content)
    content = re.sub(r'\bhouseholds_', 'spaces_', content)
    content = re.sub(r'\buser_households_', 'user_spaces_', content)
    content = re.sub(r'\bstore_merge_history_', 'supplier_merge_history_', content)
    content = re.sub(r'\bstores_', 'suppliers_', content)
    
    # 字符串中的替换（注释、错误消息等）
    content = re.sub(r"'household'", "'space'", content, flags=re.IGNORECASE)
    content = re.sub(r'"household"', '"space"', content, flags=re.IGNORECASE)
    content = re.sub(r"'store'", "'supplier'", content, flags=re.IGNORECASE)
    content = re.sub(r'"store"', '"supplier"', content, flags=re.IGNORECASE)
    
    # 函数体中的字符串替换（需要更精确）
    content = re.sub(r"'a household'", "'a space'", content)
    content = re.sub(r"'的家庭'", "'的空间'", content)
    content = re.sub(r'Cannot remove the last admin of a household', 'Cannot remove the last admin of a space', content)
    content = re.sub(r'space must have at least one admin', 'space must have at least one admin', content)  # 已正确
    
    # 函数内部引用替换
    content = re.sub(r'FROM user_households WHERE', 'FROM user_spaces WHERE', content)
    content = re.sub(r'INTO user_households', 'INTO user_spaces', content)
    content = re.sub(r'INSERT INTO user_households', 'INSERT INTO user_spaces', content)
    content = re.sub(r'UPDATE user_households', 'UPDATE user_spaces', content)
    content = re.sub(r'DELETE FROM user_households', 'DELETE FROM user_spaces', content)
    
    # 函数中的表引用
    content = re.sub(r'FROM households WHERE', 'FROM spaces WHERE', content)
    content = re.sub(r'INTO households', 'INTO spaces', content)
    content = re.sub(r'INSERT INTO households', 'INSERT INTO spaces', content)
    content = re.sub(r'FROM stores WHERE', 'FROM suppliers WHERE', content)
    content = re.sub(r'INTO stores', 'INTO suppliers', content)
    content = re.sub(r'INSERT INTO stores', 'INSERT INTO suppliers', content)
    content = re.sub(r'FROM household_invitations', 'FROM space_invitations', content)
    content = re.sub(r'INTO household_invitations', 'INTO space_invitations', content)
    content = re.sub(r'INSERT INTO household_invitations', 'INSERT INTO space_invitations', content)
    content = re.sub(r'UPDATE household_invitations', 'UPDATE space_invitations', content)
    
    # 函数中的列引用（在 SELECT、WHERE 等子句中）
    content = re.sub(r'\.household_id\b', '.space_id', content)
    content = re.sub(r'\.store_id\b', '.supplier_id', content)
    content = re.sub(r'\.store_name\b', '.supplier_name', content)
    content = re.sub(r'\.household_name\b', '.space_name', content)
    content = re.sub(r'\.current_household_id\b', '.current_space_id', content)
    
    # 函数参数在函数定义中的替换
    content = re.sub(r'\(p_household_id', '(p_space_id', content)
    content = re.sub(r'\(p_household_name', '(p_space_name', content)
    content = re.sub(r'\(p_household_address', '(p_space_address', content)
    
    return content

if __name__ == '__main__':
    # 从标准输入读取
    content = sys.stdin.read()
    cleaned = clean_sql(content)
    print(cleaned, end='')
