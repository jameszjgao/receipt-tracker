# 修复 Expo Go 中 DocumentScanner 错误

## 问题

```
ERROR [Invariant Violation: TurboModuleRegistry.getEnforcing]
```

**原因**：`react-native-document-scanner-plugin` 是原生模块，在 Expo Go 中不可用。直接导入会导致应用无法启动。

## 已修复

### 修复内容

1. **移除了顶部的直接导入**：
   ```typescript
   // ❌ 之前（会导致 Expo Go 报错）
   import DocumentScanner from 'react-native-document-scanner-plugin';
   
   // ✅ 现在（已移除）
   ```

2. **改为动态导入**：
   ```typescript
   // ✅ 现在（只在需要时导入）
   const DocumentScanner = (await import('react-native-document-scanner-plugin')).default;
   ```

3. **添加了错误处理**：
   - 如果模块未找到，提示使用开发构建
   - 提供备选方案（从相册选择）

### 修复的文件

- ✅ `app/index.tsx` - 已修复
- ✅ `app/receipts.tsx` - 已修复

## 现在的行为

### 在 Expo Go 中

1. **点击扫描按钮** → 显示提示："Development Build Required"
2. **提供选项**：
   - Cancel（取消）
   - Pick from Gallery（从相册选择）

### 在开发构建中

1. **点击扫描按钮** → 打开原生扫描器
2. **扫描文档** → 自动处理

## 验证修复

### 步骤 1：重新加载应用

在 Expo Go 中：
1. **摇动设备**（或按 `Cmd+D` 在模拟器中）
2. **选择 "Reload"**

或者：
```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npx expo start --go --tunnel --clear
```

### 步骤 2：测试功能

1. **打开应用** → 应该不再报错
2. **点击扫描按钮** → 应该显示提示，可以选择从相册选择
3. **从相册选择图片** → 应该可以正常处理

## 如果仍然有问题

### 清除缓存

```bash
# 停止服务器（Ctrl+C）

# 清除缓存
rm -rf .expo
rm -rf node_modules/.cache

# 重新启动
npx expo start --go --tunnel --clear
```

### 重新安装依赖

```bash
# 清除并重新安装
rm -rf node_modules
npm install

# 重新启动
npx expo start --go --tunnel --clear
```

## 关于警告

如果看到警告：
```
WARN Route "./index.tsx" is missing the required default export
```

这可能是误报，因为文件确实有 `export default function HomeScreen()`。

如果确实有问题，检查：
1. 文件末尾是否有 `export default`
2. 函数名是否正确

## 总结

- ✅ **已修复**：DocumentScanner 改为动态导入
- ✅ **Expo Go 兼容**：应用可以在 Expo Go 中运行
- ✅ **功能保留**：在开发构建中仍然可以使用原生扫描
- ✅ **备选方案**：在 Expo Go 中可以从相册选择图片

现在应用应该可以在 Expo Go 中正常运行了！
