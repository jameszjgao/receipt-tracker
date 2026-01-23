# 代码更新进度

## ✅ 已完成

### lib/ 目录
- ✅ `categories.ts` - 已更新为使用 `spaceId`
- ✅ `purposes.ts` - 已更新为使用 `spaceId`
- ✅ `payment-accounts.ts` - 已更新为使用 `spaceId`
- ✅ `chat-logs.ts` - 已更新为使用 `spaceId`
- ✅ `auth-helper.ts` - 已更新为使用 `spaceId`
- ✅ `auth.ts` - 大部分已更新（函数名、变量名、数据库查询）
- ✅ `database.ts` - 已更新为使用 `supplierName` 和 `spaceId`
- ✅ `receipt-helpers.ts` - 已使用 `findOrCreateSupplier`
- ✅ `household-invitations.ts` - 大部分已更新
- ✅ `household-members.ts` - 已更新为 `SpaceMember`

### types/ 目录
- ✅ `index.ts` - `Receipt` 接口已更新为 `supplierName`（保留 `storeName` 作为向后兼容）

### app/ 目录
- ✅ `household-select.tsx` - 已更新为使用 `Space` 和 `spaceId`
- ✅ `household-manage.tsx` - 已更新为使用 `Space` 和 `spaceId`
- 🔄 `household-members.tsx` - 大部分已更新，还有一些细节需要完善

## 🔄 进行中

### app/ 目录
- 🔄 `household-members.tsx` - 需要更新剩余的函数调用
- ⏳ `setup-household.tsx` - 需要更新
- ⏳ `handle-invitations.tsx` - 需要更新
- ⏳ `invite/[token].tsx` - 需要更新
- ⏳ `invite/[id].tsx` - 需要更新
- ⏳ 其他页面组件

## ⏳ 待处理

### 路由和配置文件
- ⏳ `app/_layout.tsx` - 可能需要更新路由
- ⏳ 其他配置文件

## 📝 注意事项

1. **数据库表名**：`household_invitations` 表在数据库中还没有重命名，所以查询时仍使用 `household_invitations`，但列名已更新为 `space_id`。

2. **向后兼容**：`Receipt` 接口中保留了 `storeName` 字段作为向后兼容，但优先使用 `supplierName`。

3. **函数别名**：数据库中的旧函数（如 `get_user_household_id`）已创建别名调用新函数，所以代码可以逐步迁移。
