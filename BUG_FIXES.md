# Bug 修复说明

## 修复的问题

### 1. ✅ Gemini API Key 无法访问问题

**问题描述**：
- 如果将 `GEMINI_API_KEY` 设置为 EAS Secrets（非 `EXPO_PUBLIC_` 前缀），客户端无法访问，导致 AI 识别功能无法使用。

**根本原因**：
- `lib/gemini.ts` 和 `lib/gemini-helper.ts` 在模块加载时如果没有 API Key 会抛出错误，导致应用崩溃。
- EAS Secrets 中应该使用 `EXPO_PUBLIC_GEMINI_API_KEY` 而不是 `GEMINI_API_KEY`，因为客户端代码需要访问这个值。

**修复内容**：
1. **`lib/gemini.ts`**：
   - 修改为安全初始化，使用占位符避免启动时崩溃
   - 在实际使用时（`recognizeReceipt` 函数）检查 API Key 并抛出友好的错误信息

2. **`lib/gemini-helper.ts`**：
   - 修改为安全初始化，使用占位符避免启动时崩溃
   - 在 `listAvailableModels` 函数中检查 API Key

**配置说明**：
- 在 EAS Secrets 中设置：`EXPO_PUBLIC_GEMINI_API_KEY`（不是 `GEMINI_API_KEY`）
- 或者在构建时通过环境变量设置：`EXPO_PUBLIC_GEMINI_API_KEY`

### 2. ✅ 管理页面返回时应用退出问题

**问题描述**：
- 分类、用途、账户、成员管理页面点击返回按钮时，应用会整体退出。

**根本原因**：
- 在 `app/_layout.tsx` 中，这些管理页面的配置缺少 `headerBackButtonVisible: true` 和 `headerBackTitle` 配置，导致返回按钮行为异常。

**修复内容**：
- **`app/_layout.tsx`**：
  - 为 `categories-manage`、`purposes-manage`、`payment-accounts-manage`、`household-members` 页面添加了：
    ```typescript
    headerBackTitle: 'Back',
    headerBackButtonVisible: true,
    ```

### 3. ✅ 登录状态不保持问题

**问题描述**：
- 应用退出再打开时，登录状态被清空，用户需要重新登录。

**根本原因**：
- Supabase Auth 已经配置了 `persistSession: true`，应该会自动持久化 session。
- 但登录页面没有检查已有 session，导致即使有持久化的 session，也会显示登录页面。

**修复内容**：
- **`app/login.tsx`**：
  - 添加了 `checkExistingSession` 函数，在组件加载时检查是否已有登录 session
  - 如果已有 session，自动跳转到首页（首页会处理后续逻辑）

**验证**：
- Supabase Auth 的 `persistSession: true` 配置在 `lib/supabase.ts` 中已正确设置
- `isAuthenticated()` 函数使用 `getSession()` 会自动从持久化存储中恢复 session

## 重新构建说明

### 1. 更新 EAS Secrets

在 [Expo Dashboard](https://expo.dev) 的项目设置中：

1. 进入 "Secrets" 页面
2. 确保设置了以下环境变量：
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GEMINI_API_KEY` ⚠️ **注意：必须是 `EXPO_PUBLIC_` 前缀**

### 2. 重新构建应用

```bash
# 使用 EAS Build
eas build --platform android --profile production

# 或本地构建
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

## 测试清单

### Gemini API Key 测试
- [ ] 重新构建应用后，AI 识别功能可以正常工作
- [ ] 如果未设置 API Key，会显示友好的错误提示

### 返回按钮测试
- [ ] 分类管理页面点击返回按钮正常返回到上一页
- [ ] 用途管理页面点击返回按钮正常返回到上一页
- [ ] 账户管理页面点击返回按钮正常返回到上一页
- [ ] 成员管理页面点击返回按钮正常返回到上一页
- [ ] 应用不会退出

### 登录状态保持测试
- [ ] 登录后退出应用（完全关闭）
- [ ] 重新打开应用
- [ ] 应该自动保持登录状态，无需重新登录
- [ ] 如果 session 已过期，应该跳转到登录页面

## 相关文件

- `lib/gemini.ts` - Gemini API 客户端初始化
- `lib/gemini-helper.ts` - Gemini API 辅助函数
- `app/_layout.tsx` - 应用路由配置
- `app/login.tsx` - 登录页面（添加 session 检查）
- `lib/supabase.ts` - Supabase 客户端配置（`persistSession: true`）

---

*最后更新：2024年*
