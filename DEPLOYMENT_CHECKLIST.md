# 发布前检查清单 - v2.0.0

## ✅ 已完成项

- [x] 代码功能实现完整
- [x] TypeScript 类型定义完整
- [x] 多家庭系统支持
- [x] 用户认证和注册
- [x] 小票拍摄和识别
- [x] 小票管理和编辑
- [x] 分类、用途、支付账户管理
- [x] 家庭成员管理
- [x] 默认数据初始化（分类、用途、支付账户）

## ⚠️ 需要补充/修正

### 1. 文档更新

#### 1.1 README.md
- [ ] 更新功能特性列表（包含多家庭、聊天录入等新功能）
- [ ] 更新数据库设置说明（引用最新的 SQL 脚本）
- [ ] 更新安装步骤（包含所有必要的 SQL 脚本）
- [ ] 更新项目结构说明

#### 1.2 SETUP.md
- [ ] 更新为完整的数据库设置指南
- [ ] 包含所有必要的 SQL 脚本执行顺序
- [ ] 添加多家庭系统相关的设置说明

#### 1.3 创建数据库安装指南
- [ ] 创建 `DATABASE_SETUP.md` 文档
- [ ] 列出所有需要执行的 SQL 脚本（按顺序）
- [ ] 说明每个脚本的作用

### 2. 环境配置

- [x] `.env.example` 文件已创建
- [ ] 确认 `.gitignore` 包含 `.env` 和 `.env.local`

### 3. SQL 脚本整理

#### 3.1 需要执行的 SQL 脚本（按顺序）
1. `database.sql` - 基础表结构
2. `multi-household-migration.sql` - 多家庭系统迁移
3. `create-user-function.sql` 或 `update-create-user-function.sql` - 用户创建函数
4. `add-purposes-table.sql` - 用途表
5. `add-user-name-field.sql` - 用户名字段
6. `add-household-admin-support.sql` - 管理员支持
7. `fix-households-insert-policy.sql` - 家庭插入策略
8. `fix-payment-accounts-rls-complete.sql` - 支付账户 RLS
9. `fix-purposes-rls-complete.sql` - 用途 RLS
10. `update-default-categories-to-english.sql` - 更新默认分类为英文
11. `create-default-purposes-function.sql` - 创建默认用途函数

#### 3.2 可选的 SQL 脚本
- `add-default-categories-for-existing-users.sql` - 仅为现有用户添加默认分类
- `update-user-households-rls-for-admin.sql` - 管理员权限更新

### 4. 功能完整性检查

#### 4.1 核心功能
- [x] 用户注册和登录
- [x] 家庭创建和切换
- [x] 小票拍摄和识别
- [x] 小票列表和详情
- [x] 小票编辑和确认
- [x] 分类管理
- [x] 用途管理
- [x] 支付账户管理
- [x] 家庭成员管理
- [x] 个人信息管理

#### 4.2 未来功能（v1.x）
- [ ] 邀请家庭成员功能（当前为 TODO）
- [ ] 统计分析功能（Analytics 按钮已预留）
- [ ] 数据导出功能

### 5. 代码质量

- [x] TypeScript 类型定义完整
- [x] 错误处理完善
- [x] 控制台日志适当
- [ ] 确认没有敏感信息泄露（API Keys 等）
- [ ] 确认所有 TODO 注释都标注为未来功能

### 6. 配置检查

- [x] `package.json` 版本号：2.0.0
- [x] `app.json` 配置完整
- [x] `tsconfig.json` 配置正确
- [ ] 确认依赖项版本稳定（非 beta/alpha）

### 7. 测试建议

- [ ] 完整测试用户注册流程
- [ ] 测试家庭创建和切换
- [ ] 测试小票拍摄和识别
- [ ] 测试小票编辑和确认
- [ ] 测试分类、用途、支付账户管理
- [ ] 测试多家庭用户登录流程
- [ ] 测试数据初始化（默认分类、用途、支付账户）

### 8. 发布准备

- [ ] 更新版本号（如需要）
- [ ] 创建 git tag（如需要）
- [ ] 更新 CHANGELOG.md（如需要）
- [ ] 准备发布说明

## 📝 建议创建的文档

### DATABASE_SETUP.md（新建）
完整的数据库设置指南，包含：
- 所有必要的 SQL 脚本列表
- 执行顺序
- 每个脚本的作用说明
- 验证步骤

### CHANGELOG.md（可选）
记录版本变更历史

## 🔍 代码审查要点

1. **安全性**
   - [ ] 确认所有 API Keys 使用环境变量
   - [ ] 确认 RLS 策略正确配置
   - [ ] 确认用户权限检查完善

2. **性能**
   - [ ] 图片上传和识别流程优化
   - [ ] 列表加载性能

3. **用户体验**
   - [ ] 错误提示清晰
   - [ ] 加载状态明确
   - [ ] 导航流程顺畅

## ⚠️ 已知问题/限制

1. **邀请家庭成员功能** - 当前显示 "Coming Soon"，计划在 v1.x 中实现
2. **统计分析功能** - Analytics 按钮已预留，但功能未实现

## 📋 发布后检查

- [ ] 确认生产环境配置正确
- [ ] 监控错误日志
- [ ] 收集用户反馈
- [ ] 准备修复补丁（如需要）

