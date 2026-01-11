# 验证 EAS 环境变量配置

## 你的配置检查清单

根据你展示的 Expo 环境变量配置页面，你的配置看起来**基本正确**，但需要确认以下几点：

### ✅ 已正确配置的项目

1. **变量名称正确**：
   - `EXPO_PUBLIC_GEMINI_API_KEY` ✅
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` ✅
   - `EXPO_PUBLIC_SUPABASE_URL` ✅

2. **环境范围正确**：
   - 所有变量都在 `development`, `preview`, `production` 环境中启用 ✅

3. **值已设置**：
   - 你提到值与 `.env` 文件中的值一致 ✅

### ⚠️ 需要确认的事项

#### 1. 确认变量值格式

**EXPO_PUBLIC_GEMINI_API_KEY**：
- 应该是完整的 API Key（格式类似：`AIza...`）
- 不应该包含引号或空格
- 不应该包含 `EXPO_PUBLIC_GEMINI_API_KEY=` 前缀

**EXPO_PUBLIC_SUPABASE_URL**：
- 应该是完整的 URL（格式：`https://xxx.supabase.co`）
- 不应该包含尾部斜杠 `/`

**EXPO_PUBLIC_SUPABASE_ANON_KEY**：
- 应该是完整的 Anon Key（长字符串）
- 这是 `anon` / `public` key，不是 `service_role` key

#### 2. 确认 app.config.js 正确读取

你的 `app.config.js` 中已经有：

```javascript
extra: {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
}
```

这是**正确的**。EAS Build 会在构建时自动将 EAS Secrets 中的环境变量注入到 `process.env` 中。

#### 3. 确认构建配置

检查 `eas.json` 中的构建配置是否正确。你的配置看起来是正确的。

### 🔍 验证步骤

#### 步骤 1：确认变量值

在 Expo Dashboard 中：
1. 点击每个变量右侧的"眼睛"图标（如果可见）
2. 或点击"复制"图标复制值
3. 与 `.env` 文件中的值对比，确保完全一致（包括前后空格）

#### 步骤 2：检查构建日志

重新构建应用时，检查构建日志：
- 环境变量应该会被注入（不会显示实际值）
- 不应该有关于环境变量的错误或警告

#### 步骤 3：在应用中验证

构建完成后，在应用中添加临时调试代码（仅用于测试）：

```typescript
// 在 lib/gemini.ts 中临时添加
console.log('API Key present:', !!apiKey);
console.log('API Key length:', apiKey?.length || 0);
console.log('API Key prefix:', apiKey?.substring(0, 10) + '...');
```

如果 API Key 正确加载，应该能看到：
- `API Key present: true`
- `API Key length: 39`（或类似长度）
- `API Key prefix: AIza...`（或类似）

### 🚨 常见问题

#### 问题 1：变量值包含引号

**错误示例**：
```
EXPO_PUBLIC_GEMINI_API_KEY="AIza..."
```

**正确示例**：
```
EXPO_PUBLIC_GEMINI_API_KEY=AIza...
```

#### 问题 2：变量值包含空格

**错误示例**：
```
EXPO_PUBLIC_GEMINI_API_KEY= AIza... 
```

**正确示例**：
```
EXPO_PUBLIC_GEMINI_API_KEY=AIza...
```

#### 问题 3：使用了错误的变量名

确保变量名完全匹配：
- ✅ `EXPO_PUBLIC_GEMINI_API_KEY`
- ❌ `GEMINI_API_KEY`（缺少 `EXPO_PUBLIC_` 前缀）
- ❌ `EXPO_PUBLIC_gemini_api_key`（大小写错误）

#### 问题 4：构建时未使用正确的环境

确保构建时使用了正确的环境：
```bash
# Production 环境
eas build --platform android --profile production

# Preview 环境
eas build --platform android --profile preview

# Development 环境
eas build --platform android --profile development
```

### ✅ 最终检查清单

- [ ] 所有三个环境变量都已设置
- [ ] 变量名称完全正确（包括大小写）
- [ ] 变量值格式正确（无引号、无多余空格）
- [ ] 变量在所有需要的环境中启用（development, preview, production）
- [ ] `app.config.js` 中正确读取了环境变量
- [ ] 重新构建了应用
- [ ] 构建日志中没有环境变量相关的错误

### 📝 下一步

如果配置都正确但仍然无法工作：

1. **重新构建应用**：
   ```bash
   eas build --platform android --profile production
   ```

2. **检查构建日志**：
   查看是否有环境变量相关的警告或错误

3. **在应用中添加调试日志**：
   临时添加日志以确认环境变量是否正确加载

4. **联系支持**：
   如果以上都正确但仍然无法工作，可能需要联系 Expo 支持

---

*最后更新：2024年*
