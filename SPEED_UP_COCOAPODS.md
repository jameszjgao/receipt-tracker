# 加速 CocoaPods 安装

## 问题

`npx expo run:ios` 或 `pod install` 长时间显示 "installing cocoapods"，可能的原因：

1. **网络慢**：从 GitHub 下载依赖很慢
2. **依赖多**：React Native 和 Expo 有很多依赖
3. **首次安装**：需要下载所有依赖
4. **网络问题**：可能卡在某个依赖上

## 解决方案

### 方案 1：使用国内镜像源（推荐，最快）

#### 使用 CDN 镜像（推荐）

编辑 `ios/Podfile`，在文件开头添加：

```ruby
source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'
# 或使用其他镜像
# source 'https://cdn.cocoapods.org/'
```

或者使用清华镜像：

```ruby
source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'
```

#### 使用 CocoaPods CDN（最快）

在 `ios/Podfile` 最顶部添加：

```ruby
source 'https://cdn.cocoapods.org/'
```

这是 CocoaPods 官方 CDN，通常比 GitHub 快很多。

### 方案 2：检查当前进度

如果正在安装，可以查看进度：

```bash
# 查看 pod install 进程
ps aux | grep pod

# 查看 Pods 目录大小（会增长）
du -sh ios/Pods

# 查看网络活动
# 在活动监视器中查看网络使用情况
```

### 方案 3：中断并重新开始（如果卡住）

如果长时间没有进度（超过 10 分钟），可以：

1. **中断当前进程**：
   - 按 `Ctrl+C` 中断
   - 或关闭终端窗口

2. **清理并重新安装**：
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install --repo-update
   cd ..
   ```

3. **使用并行安装**（更快）：
   ```bash
   cd ios
   pod install --repo-update --verbose
   cd ..
   ```

### 方案 4：使用预构建的依赖（最快）

如果使用 Expo，可以跳过 `pod install`，直接运行：

```bash
# 直接运行，Expo 会自动处理
npx expo run:ios
```

Expo 会使用预构建的依赖，不需要完整安装所有 Pods。

### 方案 5：只安装必要的依赖

如果只是想快速测试，可以：

```bash
# 跳过 pod install，直接运行
npx expo run:ios --no-install
```

但这可能不适用于所有情况。

## 优化 Podfile（加速后续安装）

编辑 `ios/Podfile`，添加以下优化：

```ruby
# 在文件开头添加
source 'https://cdn.cocoapods.org/'

# 使用并行安装
install! 'cocoapods', :deterministic_uuids => false

# 在 target 块内添加
platform :ios, '15.1'

target 'Vouchap' do
  # ... 现有配置 ...
  
  # 优化安装速度
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        # 禁用警告，加快编译
        config.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
      end
    end
  end
end
```

## 检查安装是否完成

### 方法 1：查看 Pods 目录

```bash
# 查看 Pods 目录大小（正常应该在 500MB-2GB）
du -sh ios/Pods

# 查看 Pods 目录内容
ls -la ios/Pods | wc -l
# 应该有很多目录（50-200个）
```

### 方法 2：检查 Podfile.lock

```bash
# 如果 Podfile.lock 存在，说明安装完成或正在进行
ls -lh ios/Podfile.lock
```

### 方法 3：查看进程

```bash
# 如果还有 pod 进程在运行，说明还在安装
ps aux | grep pod | grep -v grep
```

## 常见问题

### Q: 安装需要多长时间？

**A:** 
- **首次安装**：10-30 分钟（取决于网络）
- **更新安装**：5-15 分钟
- **使用 CDN 镜像**：5-10 分钟

### Q: 如何知道是否卡住了？

**A:** 
- 如果超过 30 分钟没有进度
- 网络活动为 0
- 终端没有任何输出

可以中断并重新开始。

### Q: 可以使用代理吗？

**A:** 可以，设置代理环境变量：

```bash
export http_proxy=http://proxy.example.com:8080
export https_proxy=http://proxy.example.com:8080
cd ios
pod install
```

### Q: 安装失败怎么办？

**A:** 

1. **清理并重试**：
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod cache clean --all
   pod install --repo-update
   ```

2. **检查网络**：
   ```bash
   # 测试 GitHub 连接
   curl -I https://github.com
   
   # 测试 CocoaPods CDN
   curl -I https://cdn.cocoapods.org
   ```

3. **使用镜像源**（见方案 1）

## 推荐配置

最快的配置：

1. **使用 CDN 镜像**（在 Podfile 开头）：
   ```ruby
   source 'https://cdn.cocoapods.org/'
   ```

2. **并行安装**：
   ```bash
   cd ios
   pod install --repo-update
   ```

3. **如果还是慢，使用国内镜像**：
   ```ruby
   source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'
   ```

## 验证安装完成

安装完成后，应该看到：

```
[!] Please close any current Xcode sessions and use `Vouchap.xcworkspace` for this project from now on.
```

然后可以运行：

```bash
npx expo run:ios
```

## 如果仍然很慢

考虑使用 **EAS Build**（云端构建，不需要本地安装）：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 构建 iOS（云端构建，不需要本地 CocoaPods）
eas build --platform ios --profile development
```

这样就不需要等待本地 CocoaPods 安装了。
