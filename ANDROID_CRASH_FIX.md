# Android 闪退问题修复指南

## 问题描述

应用在Android手机上安装后无法打开，出现闪退。

## 已修复的问题

### 1. ✅ 环境变量初始化问题

**问题**：`lib/supabase.ts` 在模块加载时如果环境变量缺失会直接抛出错误，导致应用启动时崩溃。

**修复**：
- 使用安全默认值初始化 Supabase 客户端，避免启动时崩溃
- 添加了 `validateSupabaseConfig()` 函数用于验证配置
- 在 `app/_layout.tsx` 中添加启动时的配置验证（仅用于日志）

### 2. ✅ Android 权限配置不完整

**问题**：缺少必要的 Android 权限，可能导致运行时崩溃。

**修复**：在 `app.config.js` 和 `app.json` 中添加了以下权限：
- `READ_EXTERNAL_STORAGE` - 读取外部存储
- `WRITE_EXTERNAL_STORAGE` - 写入外部存储
- `READ_MEDIA_IMAGES` - 读取媒体图片（Android 13+）
- `ACCESS_NETWORK_STATE` - 访问网络状态
- `INTERNET` - 网络访问

### 3. ✅ 缺少 Android 自适应图标配置

**问题**：Android 11+ 需要自适应图标配置。

**修复**：添加了 `adaptiveIcon` 配置。

### 4. ✅ 文件系统 API 兼容性

**问题**：使用了 `expo-file-system/legacy` API，可能在较新的 Expo 版本中不可用。

**修复**：改为使用标准的 `expo-file-system` API。

## 重新构建步骤

### 方法 1：使用 EAS Build（推荐）

```bash
# 确保环境变量已配置
# 在 EAS Dashboard 或通过命令设置环境变量
eas build:configure

# 构建 Android 应用
eas build --platform android --profile production
```

**重要**：在 EAS Build 中设置环境变量：
1. 登录 [Expo Dashboard](https://expo.dev)
2. 进入项目设置
3. 在 "Secrets" 中添加：
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`

### 方法 2：本地构建

```bash
# 1. 清理构建缓存
rm -rf android ios .expo node_modules
npm install

# 2. 预构建（如果需要）
npx expo prebuild --platform android

# 3. 构建 Android APK/AAB
cd android
./gradlew assembleRelease
# 或
./gradlew bundleRelease

# 生成的文件位置：
# APK: android/app/build/outputs/apk/release/app-release.apk
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

## 调试步骤

### 1. 查看崩溃日志

使用 Android Studio 或 adb 查看日志：

```bash
# 连接设备后，查看实时日志
adb logcat | grep -i "AndroidRuntime\|FATAL"

# 或者查看特定应用日志
adb logcat | grep "com.snapreceipt.app"
```

### 2. 检查环境变量

在应用中添加调试代码验证环境变量：

```typescript
import Constants from 'expo-constants';
console.log('Supabase URL:', Constants.expoConfig?.extra?.supabaseUrl);
console.log('Supabase Key:', Constants.expoConfig?.extra?.supabaseAnonKey ? '***' : 'missing');
```

### 3. 测试最小化构建

创建一个简单的测试页面，验证应用是否能正常启动：

```typescript
// app/test.tsx
import { View, Text } from 'react-native';

export default function TestScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>App is running!</Text>
    </View>
  );
}
```

## 常见问题排查

### 问题 1：构建时环境变量未注入

**症状**：应用能启动，但连接 Supabase 失败。

**解决方案**：
- 确保在构建时设置了环境变量
- 使用 EAS Secrets 或构建时环境变量
- 检查 `app.config.js` 中的 `extra` 配置

### 问题 2：权限被拒绝

**症状**：相机或存储访问失败。

**解决方案**：
- 确保在 `AndroidManifest.xml` 中声明了所有权限
- 在运行时请求权限（Android 6.0+）
- 检查应用的权限设置页面

### 问题 3：React Native 版本不兼容

**症状**：编译错误或运行时错误。

**解决方案**：
- 检查 `package.json` 中的依赖版本
- 确保 React Native 0.81.5 与 React 19.1.0 兼容
- 如需，降级到稳定版本：
  ```json
  "react": "18.2.0",
  "react-native": "0.76.0"
  ```

### 问题 4：原生模块问题

**症状**：特定功能（如相机）崩溃。

**解决方案**：
- 确保所有原生模块都已正确链接
- 运行 `npx expo install --fix` 修复依赖
- 清除缓存并重新构建

## 验证修复

1. **构建成功**：构建过程无错误
2. **安装成功**：APK/AAB 可以成功安装
3. **启动成功**：应用可以打开并显示初始页面
4. **基本功能**：登录、注册等基本功能可用
5. **相机功能**：相机权限请求和拍照功能正常

## 下一步

如果问题仍然存在，请：

1. 收集完整的崩溃日志
2. 记录设备信息（Android 版本、设备型号）
3. 检查 EAS Build 日志
4. 尝试在模拟器上复现问题

## 相关文件

- `app.config.js` - Expo 配置文件
- `app.json` - Expo 配置文件（备用）
- `lib/supabase.ts` - Supabase 客户端初始化
- `app/_layout.tsx` - 应用根布局

---

*最后更新：修复了环境变量初始化、Android权限配置和文件系统API兼容性问题*
