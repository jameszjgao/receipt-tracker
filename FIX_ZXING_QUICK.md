# 快速修复 zxingobjc 卡住问题

## 当前状态

- ⚠️ `pod install` 进程还在运行，但已卡住
- ⚠️ Pods 目录大小：816MB（没有增长）
- ⚠️ zxingobjc 正在从 GitHub 下载，可能很慢或超时

## 立即解决方案

### 步骤 1：中断当前进程

在运行 `pod install` 的终端按 **`Ctrl+C`**

### 步骤 2：清理并重新安装（使用 CDN，更快）

```bash
cd /Users/macbook/Vouchap/ios

# 清理
rm -rf Pods Podfile.lock

# 重新安装（使用 CDN，比 GitHub 快很多）
pod install --repo-update
```

**注意**：Podfile 已经配置了 CDN 镜像源，这次应该会更快。

### 步骤 3：如果还是卡住，跳过 repo-update

如果 `--repo-update` 很慢，可以跳过：

```bash
cd /Users/macbook/Vouchap/ios
rm -rf Pods Podfile.lock
pod install  # 不使用 --repo-update
```

## 为什么卡在 zxingobjc？

`zxingobjc` 是二维码扫描库，被 `react-native-document-scanner-plugin` 依赖。问题原因：

1. **从 GitHub 下载很慢**：CocoaPods 默认从 GitHub 克隆仓库
2. **网络超时**：下载过程中可能超时
3. **体积较大**：需要编译，耗时较长

## 已优化的配置

我已经在 `Podfile` 中添加了 CDN 镜像源：

```ruby
source 'https://cdn.cocoapods.org/'
```

这会让下载快很多。

## 如果还是有问题

### 选项 1：使用详细日志查看进度

```bash
cd /Users/macbook/Vouchap/ios
pod install --verbose
```

这会显示详细的安装日志，可以看到具体卡在哪里。

### 选项 2：使用国内镜像（如果在中国）

编辑 `ios/Podfile`，将第一行改为：

```ruby
source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'
```

然后：

```bash
cd /Users/macbook/Vouchap/ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

### 选项 3：使用 EAS Build（云端构建）

如果本地构建一直有问题：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 云端构建（不需要本地 pod install）
eas build --platform ios --profile development
```

## 验证修复

安装完成后，检查：

```bash
# 检查 zxingobjc 是否安装
ls -la ios/Pods | grep -i zxing

# 检查 Podfile.lock 是否存在
ls -lh ios/Podfile.lock
```

## 推荐操作

**立即执行**：

1. 按 `Ctrl+C` 中断当前进程
2. 运行：
   ```bash
   cd /Users/macbook/Vouchap/ios
   rm -rf Pods Podfile.lock
   pod install --repo-update
   ```

这次使用 CDN 应该会快很多，zxingobjc 应该能正常下载。
