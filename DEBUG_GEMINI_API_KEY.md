# 调试 Gemini API Key 配置问题

## 问题描述

- ✅ 本地测试正常（说明 API Key 本身可用）
- ✅ 环境变量在 Expo Dashboard 中已正确配置
- ❌ 构建的 APK 提示"检查 gemini_api_configuration"

## 可能的原因

### 1. EAS Build 时环境变量注入时机问题

**问题**：`app.config.js` 在构建时执行，此时 `process.env.EXPO_PUBLIC_GEMINI_API_KEY` 可能还没有被 EAS 注入。

**检查方法**：
- 查看构建日志，确认环境变量是否被注入
- 在 `app.config.js` 中添加调试日志（仅用于测试）

### 2. 环境变量读取顺序问题

当前代码读取顺序：
```typescript
const apiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
```

如果 `Constants.expoConfig?.extra?.geminiApiKey` 为空字符串（而不是 `undefined`），`process.env` 的备用方案不会执行。

### 3. app.config.js 中的环境变量未正确传递

`app.config.js` 中：
```javascript
geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
```

如果 `process.env.EXPO_PUBLIC_GEMINI_API_KEY` 在构建时为空，会设置为空字符串，而不是 `undefined`。

## 解决方案

### 方案 1：在 eas.json 中显式配置环境变量（推荐）

修改 `eas.json`：

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_GEMINI_API_KEY": "${EXPO_PUBLIC_GEMINI_API_KEY}"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_GEMINI_API_KEY": "${EXPO_PUBLIC_GEMINI_API_KEY}"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_GEMINI_API_KEY": "${EXPO_PUBLIC_GEMINI_API_KEY}"
      }
    }
  }
}
```

这样 EAS Build 会明确知道需要注入哪些环境变量。

### 方案 2：修改 app.config.js 使用 undefined 而不是空字符串

修改 `app.config.js`：

```javascript
extra: {
  eas: {
    projectId: "b9f86f38-62c6-4bf1-849b-aadccf272d7d"
  },
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || undefined,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || undefined,
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || undefined,
},
```

但这样可能会导致其他问题，因为代码中使用了 `|| ''` 作为默认值。

### 方案 3：添加调试日志（用于诊断）

在 `lib/gemini.ts` 中添加更详细的日志：

```typescript
// 在 recognizeReceipt 函数开始处添加
console.log('=== Gemini API Key Debug ===');
console.log('Constants.expoConfig?.extra?.geminiApiKey:', Constants.expoConfig?.extra?.geminiApiKey ? 'Present' : 'Missing');
console.log('process.env.EXPO_PUBLIC_GEMINI_API_KEY:', process.env.EXPO_PUBLIC_GEMINI_API_KEY ? 'Present' : 'Missing');
console.log('Final apiKey:', apiKey ? `Present (length: ${apiKey.length})` : 'Missing');
console.log('===========================');
```

### 方案 4：确保 EAS Secrets 正确设置

1. 在 Expo Dashboard 中确认：
   - 变量名：`EXPO_PUBLIC_GEMINI_API_KEY`（完全匹配，包括大小写）
   - 值：完整的 API Key（无引号、无空格）
   - Scope：Project 级别
   - Environments：包含 `production`

2. 使用 CLI 验证：
   ```bash
   eas secret:list
   ```

## 诊断步骤

### 步骤 1：检查构建日志

在 EAS Build 日志中查找：
- 环境变量是否被注入
- 是否有关于环境变量的警告或错误

### 步骤 2：添加临时调试代码

在 `app.config.js` 中添加（仅用于诊断）：

```javascript
export default {
  expo: {
    // ... 其他配置
    extra: {
      eas: {
        projectId: "b9f86f38-62c6-4bf1-849b-aadccf272d7d"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
      // 临时调试
      _debug: {
        hasGeminiKey: !!process.env.EXPO_PUBLIC_GEMINI_API_KEY,
        geminiKeyLength: process.env.EXPO_PUBLIC_GEMINI_API_KEY?.length || 0,
      }
    },
  },
};
```

然后在 `lib/gemini.ts` 中检查：

```typescript
console.log('Debug info:', Constants.expoConfig?.extra?._debug);
```

### 步骤 3：验证环境变量格式

确保 EAS Secrets 中的值：
- ✅ 不包含引号：`AIza...`（正确）
- ❌ 不包含引号：`"AIza..."`（错误）
- ✅ 前后无空格
- ✅ 是完整的 API Key

## 推荐的完整解决方案

1. **修改 `eas.json`**（方案 1）- 最可靠
2. **重新构建应用**
3. **测试并查看日志**

如果仍然无法工作，请提供：
- 构建日志的相关部分
- 应用中的调试日志输出
