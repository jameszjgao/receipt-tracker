# 测试指南 - v2.0.0

本文档提供了完整的测试步骤，确保所有功能正常工作。

## 📋 测试前准备

### 1. 数据库配置验证

在 Supabase SQL Editor 中执行验证脚本：

```sql
-- 执行 verify-supabase-config.sql
```

**检查项**：
- ✅ 所有表名应为新命名（`spaces`, `suppliers`, `space_invitations` 等）
- ✅ 不应存在旧表名（`households`, `stores`, `household_invitations` 等）
- ✅ 所有列名应为新命名（`space_id`, `supplier_id`, `supplier_name` 等）
- ✅ 所有 RPC 函数应存在（`get_user_space_id`, `create_space_with_user` 等）
- ✅ RLS 策略应使用新命名

### 2. 环境变量检查

确认以下环境变量已配置：

```bash
# 在 .env 文件或 EAS Secrets 中
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key (可选，用于 AI 识别)
```

**验证方法**：
```bash
# 在项目根目录运行
npx expo config --type public | grep SUPABASE
```

### 3. Storage Bucket 检查

在 Supabase Dashboard > Storage 中：
- ✅ 确认 `receipts` bucket 存在
- ✅ 确认访问策略已配置（建议设置为 Public）

## 🧪 功能测试清单

### 测试 1: 用户注册和登录

**步骤**：
1. 打开应用
2. 点击 "Sign Up"
3. 输入邮箱和密码（至少 6 位）
4. 确认邮箱
5. 登录

**预期结果**：
- ✅ 注册成功
- ✅ 收到确认邮件
- ✅ 登录后跳转到空间设置页面（新用户）

**检查点**：
- 控制台无错误
- 数据库 `users` 表中有新记录
- `current_space_id` 为 `null`（新用户）

### 测试 2: 空间创建

**步骤**：
1. 登录后（新用户）
2. 在设置页面输入空间名称
3. 可选输入地址
4. 点击 "Create Space"

**预期结果**：
- ✅ 空间创建成功
- ✅ 自动跳转到首页
- ✅ 默认分类、用途、支付账户已创建

**检查点**：
- 数据库 `spaces` 表中有新记录
- `user_spaces` 表中有关联记录，`is_admin = true`
- `users.current_space_id` 已设置
- `categories` 表中有 11 个默认分类
- `purposes` 表中有 3 个默认用途
- `payment_accounts` 表中有 1 个默认账户（Cash）

### 测试 3: 空间切换

**步骤**：
1. 如果用户有多个空间，在首页点击空间名称
2. 选择另一个空间
3. 确认切换成功

**预期结果**：
- ✅ 空间列表显示所有空间
- ✅ 切换后首页数据更新
- ✅ `users.current_space_id` 已更新

**检查点**：
- 控制台无错误
- 缓存已更新

### 测试 4: 小票拍摄和识别

**步骤**：
1. 在首页点击相机图标
2. 选择 "Scan Document" 或 "Pick from Gallery"
3. 选择/拍摄小票图片
4. 等待 AI 识别

**预期结果**：
- ✅ 图片上传成功
- ✅ AI 识别成功（如果有 Gemini API Key）
- ✅ 小票数据正确提取（供应商名称、日期、金额、商品项等）
- ✅ 状态为 `pending` 或 `confirmed`

**检查点**：
- Storage bucket 中有图片文件
- `receipts` 表中有新记录
- `receipt_items` 表中有商品项记录
- `suppliers` 表中供应商已创建或找到
- `supplier_name` 字段正确（不是 `store_name`）

### 测试 5: 小票编辑

**步骤**：
1. 在小票列表中点击一个小票
2. 点击编辑按钮
3. 修改供应商名称、日期、金额等
4. 修改商品项的分类、用途、价格
5. 保存

**预期结果**：
- ✅ 编辑界面正常显示
- ✅ 修改保存成功
- ✅ 数据正确更新

**检查点**：
- `receipts` 表数据已更新
- `receipt_items` 表数据已更新
- `supplier_name` 字段正确（不是 `store_name`）

### 测试 6: 分类管理

**步骤**：
1. 进入 Management > Categories
2. 创建新分类
3. 编辑分类名称和颜色
4. 删除分类

**预期结果**：
- ✅ 分类列表正常显示
- ✅ 创建/编辑/删除成功

**检查点**：
- `categories` 表数据正确
- `space_id` 字段正确（不是 `household_id`）

### 测试 7: 用途管理

**步骤**：
1. 进入 Management > Purposes
2. 创建新用途
3. 编辑用途名称和颜色
4. 删除用途

**预期结果**：
- ✅ 用途列表正常显示
- ✅ 创建/编辑/删除成功

**检查点**：
- `purposes` 表数据正确
- `space_id` 字段正确

### 测试 8: 支付账户管理

**步骤**：
1. 进入 Management > Accounts
2. 创建新支付账户
3. 合并支付账户
4. 删除支付账户

**预期结果**：
- ✅ 支付账户列表正常显示
- ✅ 创建/合并/删除成功

**检查点**：
- `payment_accounts` 表数据正确
- `space_id` 字段正确

### 测试 9: 空间成员管理

**步骤**：
1. 进入 Management > Members
2. 查看成员列表
3. 发送邀请（管理员）
4. 移除成员（管理员）

**预期结果**：
- ✅ 成员列表正常显示
- ✅ 邀请发送成功
- ✅ 成员移除成功

**检查点**：
- `user_spaces` 表数据正确
- `space_invitations` 表中有邀请记录
- `space_id` 字段正确（不是 `household_id`）

### 测试 10: 邀请接受流程

**步骤**：
1. 使用另一个账号登录
2. 如果有待处理邀请，应该显示邀请处理页面
3. 接受邀请
4. 确认已加入空间

**预期结果**：
- ✅ 邀请处理页面正常显示
- ✅ 接受邀请成功
- ✅ 自动加入空间
- ✅ 跳转到首页

**检查点**：
- `space_invitations` 表状态更新为 `accepted`
- `user_spaces` 表中有新记录
- `users.current_space_id` 已设置

### 测试 11: 搜索和筛选

**步骤**：
1. 在小票列表页面
2. 使用搜索功能（按供应商名称搜索）
3. 使用筛选功能（按月份、支付账户等）

**预期结果**：
- ✅ 搜索功能正常
- ✅ 筛选功能正常
- ✅ 结果正确

**检查点**：
- 搜索使用 `supplier_name` 字段（不是 `store_name`）
- 筛选使用 `space_id` 字段（不是 `household_id`）

### 测试 12: 数据一致性

**步骤**：
1. 创建小票
2. 切换空间
3. 确认小票只显示在当前空间
4. 切换回原空间
5. 确认小票仍然存在

**预期结果**：
- ✅ 数据隔离正确
- ✅ 切换空间后数据正确过滤

**检查点**：
- 所有查询都使用 `space_id` 过滤
- 没有数据泄露到其他空间

## 🔍 代码层面验证

### 1. TypeScript 编译检查

```bash
npx tsc --noEmit --skipLibCheck
```

**预期结果**：无错误（除了已知的 Expo Router 配置问题）

### 2. Linter 检查

```bash
# 如果有配置 linter
npm run lint
```

**预期结果**：无错误

### 3. 导入路径检查

确认所有导入路径使用新文件名：

```bash
# 检查是否还有旧文件引用
grep -r "household-invitations\|household-members" --include="*.ts" --include="*.tsx" app lib
```

**预期结果**：应该没有旧文件引用

## 🐛 常见问题排查

### 问题 1: "relation does not exist"

**原因**：表名未更新

**解决**：
1. 检查 Supabase 中表是否存在
2. 执行表重命名脚本

### 问题 2: "column does not exist"

**原因**：列名未更新

**解决**：
1. 检查表结构
2. 执行列重命名脚本

### 问题 3: "function does not exist"

**原因**：RPC 函数未创建

**解决**：
1. 执行 `update-database-functions.sql`
2. 执行 `create-missing-function-aliases-simple.sql`

### 问题 4: 权限错误（RLS 策略）

**原因**：RLS 策略未更新

**解决**：
1. 执行 `update-rls-policies-fixed.sql`
2. 检查策略是否正确

### 问题 5: 数据不显示

**原因**：查询使用了错误的列名

**解决**：
1. 检查控制台错误
2. 确认查询使用 `space_id` 而不是 `household_id`

## 📊 测试报告模板

测试完成后，记录以下信息：

```
测试日期: [日期]
测试人员: [姓名]
应用版本: 2.0.0

测试结果:
- [ ] 用户注册和登录
- [ ] 空间创建
- [ ] 空间切换
- [ ] 小票拍摄和识别
- [ ] 小票编辑
- [ ] 分类管理
- [ ] 用途管理
- [ ] 支付账户管理
- [ ] 空间成员管理
- [ ] 邀请接受流程
- [ ] 搜索和筛选
- [ ] 数据一致性

发现的问题:
1. [问题描述]
2. [问题描述]

修复状态:
- [ ] 所有问题已修复
- [ ] 部分问题待修复
```

## ✅ 测试完成标准

所有以下项目都通过：
- ✅ 数据库配置验证通过
- ✅ 所有功能测试通过
- ✅ TypeScript 编译无错误
- ✅ 无控制台错误
- ✅ 数据正确存储和查询
- ✅ 所有重命名已完成（表名、列名、函数名、文件名、路由名）

完成以上测试后，应用可以发布 v2.0.0 版本。
