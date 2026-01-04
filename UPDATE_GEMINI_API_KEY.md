# 更新 Gemini API Key 指南

## 更新步骤

### 方法 1：直接编辑 .env 文件（推荐）

1. 打开项目根目录下的 `.env` 文件
2. 找到 `GEMINI_API_KEY` 这一行
3. 将新的 API Key 替换旧的值：
   ```
   GEMINI_API_KEY=your_new_api_key_here
   ```
4. 保存文件
5. **重要：重启 Expo 开发服务器**
   ```bash
   # 如果服务器正在运行，按 Ctrl+C 停止
   # 然后重新启动
   npm start
   # 或者
   expo start
   ```

### 方法 2：使用环境变量（临时）

如果你想临时测试新的 API Key，可以在启动时设置：

```bash
GEMINI_API_KEY=your_new_api_key_here npm start
```

### 方法 3：在 app.config.js 中设置（不推荐）

如果你不想使用 `.env` 文件，可以在 `app.config.js` 中直接设置：

```javascript
extra: {
  geminiApiKey: 'your_new_api_key_here',
  // ...
}
```

**注意：** 这种方法会将 API Key 暴露在代码中，不建议用于生产环境。

## 验证新 API Key

更新后，可以使用测试脚本验证：

```bash
node test-gemini-api.js
```

或者直接在应用中拍摄一张小票测试识别功能。

## 重要提示

1. **必须重启 Expo 开发服务器**，环境变量的更改才会生效
2. `.env` 文件已经在 `.gitignore` 中，不会被提交到 Git
3. 如果使用 Expo Go，可能需要完全关闭并重新打开应用
4. 如果是在开发构建中，需要重新构建应用

