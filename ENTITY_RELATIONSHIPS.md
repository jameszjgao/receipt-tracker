# Snap Receipt 实体关系图

## 核心实体关系

### 1. User (用户) ↔ Household (家庭)
**关系类型：多对多**
- **中间表：** `user_households`
- **关系字段：**
  - `user_households.user_id` → `users.id`
  - `user_households.household_id` → `households.id`
- **额外字段：**
  - `user_households.is_admin` - 是否为管理员
- **特殊字段：**
  - `users.current_household_id` → `households.id` (可选，指向当前活动的家庭)
- **说明：**
  - 一个用户可以属于多个家庭
  - 一个家庭可以有多个用户
  - 用户有一个当前活动的家庭（`current_household_id`）
  - 支持两步注册：注册时 `current_household_id` 可以为 `NULL`

### 2. Household (家庭) → Category (分类)
**关系类型：一对多**
- **关系字段：** `categories.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有分类
- **唯一约束：** `UNIQUE(household_id, name)` - 每个家庭内分类名唯一
- **说明：**
  - 一个家庭有多个分类
  - 每个分类属于一个家庭
  - 分类是家庭级别的数据

### 3. Household (家庭) → PaymentAccount (支付账户)
**关系类型：一对多**
- **关系字段：** `payment_accounts.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有支付账户
- **唯一约束：** `UNIQUE(household_id, name)` - 每个家庭内支付账户名唯一
- **说明：**
  - 一个家庭有多个支付账户
  - 每个支付账户属于一个家庭
  - 支付账户是家庭级别的数据

### 4. Household (家庭) → Purpose (用途)
**关系类型：一对多**
- **关系字段：** `purposes.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有用途
- **唯一约束：** `UNIQUE(household_id, name)` - 每个家庭内用途名唯一
- **说明：**
  - 一个家庭有多个用途
  - 每个用途属于一个家庭
  - 用途是家庭级别的数据

### 5. Household (家庭) → Receipt (小票)
**关系类型：一对多**
- **关系字段：** `receipts.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有小票
- **说明：**
  - 一个家庭有多张小票
  - 每张小票属于一个家庭
  - 小票是家庭级别的数据

### 6. Receipt (小票) → ReceiptItem (小票商品项)
**关系类型：一对多**
- **关系字段：** `receipt_items.receipt_id` → `receipts.id`
- **约束：** `ON DELETE CASCADE` - 删除小票时删除所有商品项
- **说明：**
  - 一张小票有多个商品项
  - 每个商品项属于一张小票

### 7. ReceiptItem (小票商品项) → Category (分类)
**关系类型：多对一（必填）**
- **关系字段：** `receipt_items.category_id` → `categories.id`
- **约束：** `ON DELETE RESTRICT` - 如果商品项在使用该分类，不能删除分类
- **说明：**
  - 多个商品项可以属于同一个分类
  - 每个商品项必须有一个分类

### 8. ReceiptItem (小票商品项) → Purpose (用途)
**关系类型：多对一（可选）**
- **关系字段：** `receipt_items.purpose_id` → `purposes.id`
- **约束：** `ON DELETE SET NULL` - 删除用途时，商品项的用途设为 NULL
- **说明：**
  - 多个商品项可以属于同一个用途
  - 每个商品项可以有一个用途（可选）

### 9. Receipt (小票) → PaymentAccount (支付账户)
**关系类型：多对一（可选）**
- **关系字段：** `receipts.payment_account_id` → `payment_accounts.id`
- **约束：** `ON DELETE SET NULL` - 删除支付账户时，小票的支付账户设为 NULL
- **说明：**
  - 多张小票可以使用同一个支付账户
  - 每张小票可以有一个支付账户（可选）

### 10. Receipt (小票) → User (用户)
**关系类型：多对一（可选）**
- **关系字段：** `receipts.created_by` → `users.id`
- **约束：** `ON DELETE SET NULL` - 删除用户时，小票的创建者设为 NULL
- **说明：**
  - 多张小票可以由同一个用户创建
  - 每张小票可以有一个创建者（可选）

### 11. Household (家庭) → HouseholdInvitation (家庭邀请)
**关系类型：一对多**
- **关系字段：** `household_invitations.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有邀请
- **说明：**
  - 一个家庭有多个邀请
  - 每个邀请属于一个家庭

### 12. HouseholdInvitation (家庭邀请) → User (用户)
**关系类型：多对一（必填）**
- **关系字段：** `household_invitations.inviter_id` → `users.id`
- **约束：** `ON DELETE CASCADE` - 删除用户时删除所有邀请
- **说明：**
  - 多个邀请可以由同一个用户创建
  - 每个邀请必须有一个创建者（邀请人）

### 13. PaymentAccountMergeHistory (支付账户合并历史) → Household (家庭)
**关系类型：多对一（必填）**
- **关系字段：** `payment_account_merge_history.household_id` → `households.id`
- **约束：** `ON DELETE CASCADE` - 删除家庭时删除所有合并历史
- **说明：**
  - 多个合并历史记录属于同一个家庭
  - 每个合并历史记录属于一个家庭

### 14. PaymentAccountMergeHistory (支付账户合并历史) → PaymentAccount (支付账户)
**关系类型：多对一（必填）**
- **关系字段：** `payment_account_merge_history.target_account_id` → `payment_accounts.id`
- **约束：** `ON DELETE CASCADE` - 删除支付账户时删除相关合并历史
- **说明：**
  - 多个合并历史记录可以指向同一个目标账户
  - 每个合并历史记录必须有一个目标账户
  - 用于记录用户手动合并的账户，以便后续AI识别时自动归并

---

## 实体关系总结表

| 实体A | 关系类型 | 实体B | 中间表/关系字段 | 约束 |
|------|---------|------|----------------|------|
| User | 多对多 | Household | user_households | CASCADE |
| User | 多对一（可选） | Household | users.current_household_id | SET NULL |
| Household | 一对多 | Category | categories.household_id | CASCADE |
| Household | 一对多 | PaymentAccount | payment_accounts.household_id | CASCADE |
| Household | 一对多 | Purpose | purposes.household_id | CASCADE |
| Household | 一对多 | Receipt | receipts.household_id | CASCADE |
| Household | 一对多 | HouseholdInvitation | household_invitations.household_id | CASCADE |
| Receipt | 一对多 | ReceiptItem | receipt_items.receipt_id | CASCADE |
| ReceiptItem | 多对一（必填） | Category | receipt_items.category_id | RESTRICT |
| ReceiptItem | 多对一（可选） | Purpose | receipt_items.purpose_id | SET NULL |
| Receipt | 多对一（可选） | PaymentAccount | receipts.payment_account_id | SET NULL |
| Receipt | 多对一（可选） | User | receipts.created_by | SET NULL |
| HouseholdInvitation | 多对一（必填） | User | household_invitations.inviter_id | CASCADE |
| PaymentAccountMergeHistory | 多对一（必填） | Household | payment_account_merge_history.household_id | CASCADE |
| PaymentAccountMergeHistory | 多对一（必填） | PaymentAccount | payment_account_merge_history.target_account_id | CASCADE |

---

## 关键设计点

### 1. 多家庭支持
- 使用 `user_households` 表实现用户-家庭多对多关系
- `users.current_household_id` 标识当前活动的家庭
- 所有家庭级别的数据（categories, payment_accounts, purposes, receipts）都通过 `household_id` 关联

### 2. 两步注册支持
- `users.current_household_id` 可以为 `NULL`（新用户注册时）
- `users.household_id` 也可以为 `NULL`（向后兼容，但实际已冗余）

### 3. 数据隔离
- 所有业务数据（categories, payment_accounts, purposes, receipts）都是家庭级别的
- 通过 RLS 策略确保用户只能访问自己所属家庭的数据

### 4. 软删除保护
- 使用 `ON DELETE RESTRICT` 保护分类（如果商品项在使用，不能删除）
- 使用 `ON DELETE SET NULL` 保护可选关联（删除时设为 NULL 而不是级联删除）

---

## 潜在问题检查

### ✅ 正确的关系
1. User ↔ Household (多对多) - 通过 user_households 表 ✅
2. Household → Category (一对多) - 正确 ✅
3. Household → PaymentAccount (一对多) - 正确 ✅
4. Household → Purpose (一对多) - 正确 ✅
5. Household → Receipt (一对多) - 正确 ✅
6. Receipt → ReceiptItem (一对多) - 正确 ✅
7. ReceiptItem → Category (多对一) - 正确 ✅
8. ReceiptItem → Purpose (多对一，可选) - 正确 ✅
9. Receipt → PaymentAccount (多对一，可选) - 正确 ✅
10. Receipt → User (多对一，可选) - 正确 ✅
11. Household → HouseholdInvitation (一对多) - 正确 ✅
12. HouseholdInvitation → User (多对一) - 正确 ✅

### ⚠️ 需要注意的点
1. `users.household_id` - 冗余字段，可以移除（但保留用于向后兼容）
2. `users.current_household_id` - 必需字段，标识当前活动家庭
3. 所有 RLS 策略都使用 `user_households` 表，不再依赖 `users.household_id`

