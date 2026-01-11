# 网络连接问题修复指南

## 问题描述

构建的应用安装在手机上后，登录和注册功能无法使用，提示"连不上网"。

## 根本原因

最可能的原因是：**Supabase 环境变量在构建时没有正确注入到应用中**。

在 `app.config.js` 中，代码使用了：
```javascript
supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
```

如果这些环境变量在构建时为空，应用会使用空字符串，导致 Supabase 客户端无法连接。

## 解决方案

### 方案 1：使用 EAS Secrets（推荐）

1. **登录 Expo Dashboard**：https://expo.dev
2. **进入项目设置**：选择你的项目 → Settings → Secrets
3. **添加以下 Secrets**：
   - `EXPO_PUBLIC_SUPABASE_URL` - 你的 Supabase 项目 URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - 你的 Supabase Anon Key
   - `EXPO_PUBLIC_GEMINI_API_KEY` - Gemini API Key（如果需要）

4. **重新构建应用**：
   ```bash
   eas build --platform android --profile production
   ```

### 方案 2：在本地构建时设置环境变量

如果你使用本地构建：

```bash
# 设置环境变量
export EXPO_PUBLIC_SUPABASE_URL="your_supabase_url"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

# 然后构建
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### 方案 3：使用 .env 文件（仅适用于开发环境）

对于开发环境，可以在项目根目录创建 `.env` 文件：

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

**注意**：`.env` 文件在构建时不会被包含，只适用于开发环境。

## 验证配置

### 1. 检查构建日志

在 EAS Build 的构建日志中，检查环境变量是否正确注入。可以临时添加日志输出：

```javascript
// 在 app.config.js 中临时添加（仅用于调试）
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
console.log('Supabase Key:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing');
```

### 2. 在应用中添加调试代码

在应用中临时添加代码检查配置（构建后可以移除）：

```typescript
// 在 app/_layout.tsx 或 app/index.tsx 中
import Constants from 'expo-constants';

useEffect(() => {
  console.log('Supabase Config:', {
    url: Constants.expoConfig?.extra?.supabaseUrl ? 'Set' : 'Missing',
    key: Constants.expoConfig?.extra?.supabaseAnonKey ? 'Set' : 'Missing',
  });
}, []);
```

### 3. 使用 adb logcat 查看日志

在手机上安装应用后，使用 adb 查看日志：

```bash
adb logcat | grep -i "supabase\|network\|error"
```

## 常见错误

### 错误 1：环境变量未设置

**症状**：应用启动正常，但无法连接 Supabase

**解决**：
- 检查 EAS Secrets 是否已设置
- 确保变量名正确（必须是 `EXPO_PUBLIC_` 前缀）
- 重新构建应用

### 错误 2：环境变量值不正确

**症状**：应用尝试连接但失败

**解决**：
- 验证 Supabase URL 和 Key 是否正确
- 检查 Supabase 项目是否正常运行
- 确认 URL 格式正确（应该是 `https://xxx.supabase.co`）

### 错误 3：网络权限问题

**症状**：应用显示"无网络连接"

**解决**：
- 确认 Android 权限已配置（已在 `app.config.js` 中配置）
- 检查手机网络连接
- 验证应用的网络权限是否被系统禁用

## 调试步骤

1. **检查 EAS Secrets**：
   - 登录 Expo Dashboard
   - 检查 Secrets 是否正确设置

2. **验证 Supabase 配置**：
   - 登录 Supabase Dashboard
   - 确认项目 URL 和 Anon Key

3. **重新构建**：
   ```bash
   eas build --platform android --profile production
   ```

4. **测试连接**：
   - 安装构建的应用
   - 尝试登录/注册
   - 使用 adb logcat 查看详细错误

## 预防措施

1. **使用 EAS Secrets**：不要将敏感信息硬编码在代码中
2. **验证构建**：每次构建后验证环境变量是否正确注入
3. **添加错误处理**：在代码中添加友好的错误提示，帮助用户理解问题

---

*最后更新：2024年*
