# 快速开始指南

## ⚠️ 重要：命令执行位置

**所有命令必须在项目根目录运行！**

### 检查当前目录

运行命令前，确保你在正确的目录：

```bash
# 检查当前目录
pwd

# 应该显示：
# /Users/macbook/receipt-tracker

# 如果不在项目目录，切换到项目根目录：
cd /Users/macbook/receipt-tracker
```

## 常用命令

### 1. 启动开发服务器

```bash
cd /Users/macbook/receipt-tracker
npm start
# 或
npx expo start
```

### 2. 运行 iOS

```bash
cd /Users/macbook/receipt-tracker
npx expo run:ios
```

### 3. 运行 Android

```bash
cd /Users/macbook/receipt-tracker
npx expo run:android
```

### 4. 安装 iOS 依赖

```bash
cd /Users/macbook/receipt-tracker
cd ios
pod install
cd ..
```

## 常见错误

### ❌ 错误：`ConfigError: The expected package.json path does not exist`

**原因**：在错误的目录运行了命令

**解决**：
```bash
# 切换到项目根目录
cd /Users/macbook/receipt-tracker

# 然后重新运行命令
npx expo run:ios
# 或
npx expo run:android
```

### ❌ 错误：在 `ios` 目录下运行 `npx expo install`

**原因**：`npx expo` 命令必须在项目根目录运行

**解决**：
```bash
# 确保在项目根目录
cd /Users/macbook/receipt-tracker

# 然后运行命令
npx expo install <package-name>
```

## 提示

可以在 `~/.zshrc` 或 `~/.bashrc` 中添加别名，方便快速切换：

```bash
# 添加到 ~/.zshrc
alias vouchap='cd /Users/macbook/receipt-tracker'
```

然后就可以直接运行：
```bash
vouchap
npx expo run:ios
```
