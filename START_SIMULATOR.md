# 启动 iOS 模拟器

## 问题

```
CommandError: No iOS devices available in Simulator.app
```

## 解决方案

### 方法 1：直接打开模拟器应用

```bash
open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app
```

等待模拟器启动后（会显示 iPhone 界面），运行：

```bash
npx expo run:ios
```

### 方法 2：通过 Finder 打开

1. **打开 Finder**
2. **前往**：`/Applications/Xcode.app/Contents/Developer/Applications/`
3. **双击 "Simulator.app"**
4. **等待模拟器启动**
5. **运行应用**：
   ```bash
   npx expo run:ios
   ```

### 方法 3：使用 Spotlight 搜索

1. **按 `Cmd+Space` 打开 Spotlight**
2. **搜索 "Simulator"**
3. **打开 Simulator 应用**
4. **等待启动**
5. **运行应用**

### 方法 4：指定模拟器运行

如果模拟器已启动，可以指定设备：

```bash
# 列出可用的模拟器
xcrun simctl list devices available

# 使用特定模拟器
npx expo run:ios --simulator="iPhone 15 Pro"
```

## 验证

模拟器启动后，应该看到：
- iPhone 界面
- 主屏幕
- 可以交互

然后运行：

```bash
npx expo run:ios
```

## 如果模拟器无法启动

可能需要：

1. **检查 Xcode 是否完整安装**
2. **下载 iOS 运行时**：
   - 打开 Xcode
   - Xcode → Settings → Platforms
   - 下载需要的 iOS 版本

3. **使用真机设备**：
   ```bash
   npx expo run:ios --device
   ```

## 推荐操作

**立即执行**：

```bash
# 1. 打开模拟器
open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app

# 2. 等待模拟器启动（看到 iPhone 界面）

# 3. 运行应用
npx expo run:ios
```
