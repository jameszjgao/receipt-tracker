# 全局重命名指南

## 重命名规则

- `household` → `space`
- `store` → `supplier`

## 数据库迁移

已创建迁移脚本：`rename-household-to-space-and-store-to-supplier.sql`

**重要**：在执行代码更新之前，先执行数据库迁移脚本！

## 需要更新的文件清单

### 1. TypeScript 类型定义 ✅
- [x] `types/index.ts` - 已更新

### 2. 库文件（lib/）

#### household → space
- [ ] `lib/household-members.ts` → `lib/space-members.ts`
- [ ] `lib/household-invitations.ts` → `lib/space-invitations.ts`
- [ ] `lib/auth.ts` - 更新所有 household 相关函数和变量
- [ ] `lib/auth-cache.ts` - 更新缓存键名
- [ ] `lib/database.ts` - 更新所有 household_id 和 store_id 引用
- [ ] `lib/categories.ts` - 更新 householdId → spaceId
- [ ] `lib/purposes.ts` - 更新 householdId → spaceId
- [ ] `lib/payment-accounts.ts` - 更新 householdId → spaceId
- [ ] `lib/receipt-helpers.ts` - 更新 store 相关引用
- [ ] `lib/receipt-processor.ts` - 更新 store 相关引用
- [ ] `lib/gemini.ts` - 更新 storeInfo → supplierInfo

#### store → supplier
- [ ] `lib/stores.ts` → `lib/suppliers.ts` - 完整重写

### 3. 页面组件（app/）

#### household → space
- [ ] `app/index.tsx` - 更新所有 household 引用
- [ ] `app/household-select.tsx` → `app/space-select.tsx`
- [ ] `app/household-manage.tsx` → `app/space-manage.tsx`
- [ ] `app/household-members.tsx` → `app/space-members.tsx`
- [ ] `app/setup-household.tsx` → `app/setup-space.tsx`
- [ ] `app/management.tsx` - 更新路由和引用
- [ ] `app/receipts.tsx` - 更新所有 household 引用
- [ ] `app/receipt-details/[id].tsx` - 更新 store → supplier
- [ ] `app/manual-entry.tsx` - 更新 store → supplier
- [ ] `app/voice-input.tsx` - 更新 store → supplier
- [ ] `app/handle-invitations.tsx` - 更新 household → space
- [ ] `app/invite/[id].tsx` - 更新 household → space
- [ ] `app/invite/[token].tsx` - 更新 household → space

### 4. 路由配置
- [ ] `app/_layout.tsx` - 更新路由名称

### 5. 数据库相关 SQL 文件
- [ ] 所有 `.sql` 文件中的表名和字段名（可选，历史文件）

## 重命名模式

### 变量名
- `householdId` → `spaceId`
- `currentHouseholdId` → `currentSpaceId`
- `household` → `space`
- `households` → `spaces`
- `storeId` → `supplierId`
- `store` → `supplier`
- `stores` → `suppliers`
- `storeName` → `supplierName`（在 Receipt 接口中）

### 函数名
- `getCurrentHousehold()` → `getCurrentSpace()`
- `setCurrentHousehold()` → `setCurrentSpace()`
- `getUserHouseholds()` → `getUserSpaces()`
- `createHousehold()` → `createSpace()`
- `getHouseholdMembers()` → `getSpaceMembers()`
- `getStores()` → `getSuppliers()`
- `createStore()` → `createSupplier()`
- `findOrCreateStore()` → `findOrCreateSupplier()`

### 数据库表名
- `households` → `spaces`
- `user_households` → `user_spaces`
- `household_invitations` → `space_invitations`（可选，表名可保持不变）
- `stores` → `suppliers`
- `store_merge_history` → `supplier_merge_history`

### 数据库字段名
- `household_id` → `space_id`
- `current_household_id` → `current_space_id`
- `store_id` → `supplier_id`
- `store_name` → `supplier_name`

### 路由路径
- `/household-select` → `/space-select`
- `/household-manage` → `/space-manage`
- `/household-members` → `/space-members`
- `/setup-household` → `/setup-space`

## 执行顺序

1. ✅ 更新类型定义
2. ✅ 创建数据库迁移脚本
3. ⏳ 执行数据库迁移（在 Supabase SQL Editor 中）
4. ⏳ 更新 lib/ 文件
5. ⏳ 更新 app/ 文件
6. ⏳ 更新路由配置
7. ⏳ 测试所有功能

## 注意事项

1. **数据库迁移必须在代码更新之前执行**
2. 更新时注意保持向后兼容（如果可能）
3. 更新所有导入语句
4. 更新所有字符串字面量（如路由路径）
5. 测试所有相关功能
