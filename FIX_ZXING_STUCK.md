# 解决 zxingobjc 安装卡住问题

## 问题

`pod install` 卡在 `zxingobjc` 上不动，可能的原因：

1. **网络问题**：从 GitHub 下载很慢或超时
2. **依赖编译**：zxingobjc 需要编译，可能很慢
3. **网络超时**：下载过程中网络中断

## 当前状态

- ✅ `pod install` 进程还在运行（PID: 84591）
- ⚠️ Pods 目录大小：816MB（没有增长，可能卡住了）
- ⚠️ zxingobjc 可能正在下载或编译

## 解决方案

### 方案 1：中断并使用 CDN 重新安装（推荐）

zxingobjc 可能卡在从 GitHub 下载。使用 CDN 会更快：

```bash
# 1. 中断当前进程（Ctrl+C）

# 2. 清理
cd /Users/macbook/Vouchap/ios
rm -rf Pods Podfile.lock

# 3. 清理 CocoaPods 缓存
pod cache clean --all

# 4. 重新安装（使用 CDN，更快）
pod install --repo-update
```

### 方案 2：跳过 repo-update（如果已经更新过）

如果之前已经更新过 repo，可以跳过：

```bash
# 中断（Ctrl+C）

cd /Users/macbook/Vouchap/ios
rm -rf Pods Podfile.lock
pod install  # 不使用 --repo-update
```

### 方案 3：使用国内镜像（如果在中国）

如果在中国，可以使用清华镜像加速：

```bash
# 编辑 Podfile，确保第一行是：
source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'
```

然后：

```bash
cd /Users/macbook/Vouchap/ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

### 方案 4：手动指定 zxingobjc 版本

如果 zxingobjc 版本有问题，可以在 Podfile 中指定版本：

```ruby
# 在 target 'Vouchap' do 块内添加
pod 'ZXingObjC', '~> 3.6.5'
```

然后：

```bash
cd /Users/macbook/Vouchap/ios
pod install
```

### 方案 5：使用代理（如果有）

如果有代理，可以设置：

```bash
export http_proxy=http://proxy.example.com:8080
export https_proxy=http://proxy.example.com:8080
cd /Users/macbook/Vouchap/ios
pod install
```

## 为什么是 zxingobjc？

`zxingobjc` 是二维码扫描库，通常被以下包依赖：
- `react-native-document-scanner-plugin` - 文档扫描插件
- 其他需要二维码扫描功能的包

这个库：
- 体积较大（需要编译）
- 从 GitHub 下载可能很慢
- 编译需要时间

## 快速修复步骤

### 步骤 1：中断当前进程

在运行 `pod install` 的终端按 `Ctrl+C`

### 步骤 2：清理并重新安装

```bash
cd /Users/macbook/Vouchap/ios

# 清理
rm -rf Pods Podfile.lock

# 清理缓存（可选，但推荐）
pod cache clean --all

# 重新安装（使用 CDN）
pod install --repo-update
```

### 步骤 3：如果还是卡住

等待 5-10 分钟，如果还是没有进度：

```bash
# 检查网络连接
ping github.com

# 检查是否有网络活动
# 在活动监视器中查看网络使用情况

# 如果网络正常但卡住，尝试：
pod install --verbose
# 这会显示详细的安装日志，可以看到卡在哪里
```

## 替代方案：跳过 pod install

如果 pod install 一直有问题，可以尝试：

### 使用 Expo 预构建

```bash
# 在项目根目录
npx expo prebuild --platform ios --clean

# 这会重新生成 iOS 项目，可能避免某些依赖问题
```

### 使用 EAS Build（云端构建）

如果本地构建一直有问题，可以使用云端构建：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 构建 iOS（云端构建，不需要本地 pod install）
eas build --platform ios --profile development
```

## 验证修复

安装完成后，检查：

```bash
# 检查 zxingobjc 是否安装
ls -la ios/Pods | grep -i zxing

# 检查 Podfile.lock
grep -i zxing ios/Podfile.lock

# 检查安装是否完成
ls -lh ios/Podfile.lock
```

## 预防措施

为了避免将来再次卡住：

1. **使用 CDN 镜像**（已在 Podfile 中配置）
2. **定期更新 repo**：`pod repo update`
3. **使用缓存**：不要频繁清理 `pod cache`

## 总结

- ⚠️ 当前可能卡在 zxingobjc 下载/编译
- ✅ 建议中断并使用 CDN 重新安装
- ✅ Podfile 已配置 CDN 镜像，下次会更快
- 🔄 如果还是卡住，考虑使用 EAS Build（云端构建）
