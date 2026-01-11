# 诊断构建后 Gemini API Key 问题

## 问题描述

- ✅ 构建日志显示环境变量已注入
- ✅ 登录、注册、浏览功能正常（说明 Supabase 配置正确）
- ❌ 拍照识别功能失败，提示检查 Gemini API Key 配置

## 从构建日志分析

构建日志显示：
```
EAS_BUILD_PROFILE=preview
Environment secrets:
  EXPO_PUBLIC_GEMINI_API_KEY=********
```

这说明：
1. 使用的是 `preview` profile 构建
2. 环境变量在构建时已注入

## 可能的原因

### 1. `eas.json` 中 `preview` profile 缺少环境变量配置（已修复）

**问题**：虽然环境变量在构建时注入了，但如果 `eas.json` 中没有显式配置，可能不会正确传递到 `app.config.js`。

**修复**：已在 `eas.json` 的 `preview` profile 中添加了 `env` 配置。

### 2. `app.config.js` 在构建时执行，此时 `process.env` 可能还未注入

**问题**：`app.config.js` 在构建时执行，如果环境变量注入时机不对，`process.env.EXPO_PUBLIC_GEMINI_API_KEY` 可能为空。

**解决方案**：代码中已添加运行时重新获取 API Key 的逻辑，优先使用 `Constants.expoConfig?.extra?.geminiApiKey`。

### 3. 需要查看应用中的实际调试日志

**下一步**：重新构建后，查看应用中的调试日志输出，特别是：
- `=== Gemini API Key Debug ===` 部分的输出
- 确认哪个变量有值，哪个没有值

## 修复内容

### 1. 更新 `eas.json`

为 `preview` profile 添加了环境变量配置：

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  },
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "${EXPO_PUBLIC_SUPABASE_URL}",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "${EXPO_PUBLIC_SUPABASE_ANON_KEY}",
    "EXPO_PUBLIC_GEMINI_API_KEY": "${EXPO_PUBLIC_GEMINI_API_KEY}"
  }
}
```

### 2. 增强调试日志

在 `lib/gemini.ts` 中添加了更详细的调试日志：
- 显示 `Constants.expoConfig` 和 `extra` 是否存在
- 显示 API Key 的前缀（不显示完整值，保护隐私）
- 显示所有可能的 API Key 来源

### 3. 改进错误消息

错误消息现在包含详细的调试信息，帮助诊断问题。

## 下一步操作

### 步骤 1：重新构建应用

```bash
eas build --platform android --profile preview
```

### 步骤 2：安装并测试

1. 安装新构建的 APK
2. 尝试拍照识别
3. **重要**：查看应用日志或错误消息

### 步骤 3：收集调试信息

如果仍然失败，请提供：

1. **错误消息的完整内容**（特别是包含调试信息的部分）

2. **应用日志**（如果可能获取）：
   - 查找 `=== Gemini API Key Debug ===` 的输出
   - 查看每个变量的状态

3. **构建日志**（确认环境变量是否正确注入）

### 步骤 4：验证环境变量

在 Expo Dashboard 中确认：
- `EXPO_PUBLIC_GEMINI_API_KEY` 在所有环境中都设置了（development, preview, production）
- 变量值格式正确（无引号、无多余空格）

## 如何查看应用日志

### Android

1. 使用 `adb logcat`：
   ```bash
   adb logcat | grep -i "gemini\|api.*key"
   ```

2. 或者使用 Android Studio 的 Logcat

3. 在应用中，错误消息会显示在 Alert 中，包含调试信息

### 如果无法获取日志

错误消息现在包含详细的调试信息，可以直接从 Alert 中看到：
- 哪些变量存在
- 哪些变量不存在
- API Key 的实际长度

## 常见问题

### Q: 为什么 Supabase 可以工作，但 Gemini 不行？

**A**: 可能的原因：
1. Supabase 的环境变量在 `app.config.js` 执行时已正确注入
2. Gemini 的环境变量可能因为某种原因没有正确传递到运行时

### Q: 为什么本地开发可以，但构建后不行？

**A**: 
- 本地开发时，`.env` 文件被直接读取
- 构建时，需要 EAS Secrets 正确注入，并且 `eas.json` 中需要显式配置

### Q: 如何确认环境变量是否正确注入？

**A**: 
1. 查看构建日志中的 "Environment secrets" 部分
2. 查看应用中的调试日志输出
3. 检查错误消息中的调试信息

---

*最后更新：2024年*
