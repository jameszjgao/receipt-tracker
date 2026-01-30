# 修复 CocoaPods SSL 连接错误

## 问题描述

```
CDN: trunk URL couldn't be downloaded: https://cdn.cocoapods.org/deprecated_podspecs.txt
Response: SSL connect error
```

这是 CocoaPods CDN 的 SSL 连接问题，常见于网络环境限制或 CDN 访问问题。

## 解决方案

### 方案 1: 使用 Git 源替代 CDN（推荐）

修改 `ios/Podfile`，将 CDN 源改为 Git 源：

```ruby
# 注释掉或删除 CDN 源
# source 'https://cdn.cocoapods.org/'

# 使用 Git 源
source 'https://github.com/CocoaPods/Specs.git'
```

### 方案 2: 使用国内镜像源（如果在中国）

```ruby
# 使用清华大学镜像
source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'

# 或者使用腾讯云镜像
# source 'https://mirrors.cloud.tencent.com/CocoaPods/Specs.git'
```

### 方案 3: 更新 CocoaPods 并清理缓存

```bash
# 更新 CocoaPods
sudo gem install cocoapods

# 清理 CocoaPods 缓存
pod cache clean --all

# 删除 Podfile.lock 和 Pods 目录
cd ios
rm -rf Podfile.lock Pods
cd ..

# 重新安装
cd ios
pod install --repo-update
cd ..
```

### 方案 4: 跳过 CDN，直接使用 Git

```bash
cd ios

# 删除 Podfile.lock
rm -f Podfile.lock

# 使用 Git 源安装（跳过 CDN）
pod install --repo-update --no-repo-update
```

### 方案 5: 临时禁用 SSL 验证（不推荐，仅用于测试）

```bash
# 设置环境变量跳过 SSL 验证（仅用于测试）
export SSL_CERT_FILE=""
cd ios
pod install
cd ..
```

## 推荐步骤（综合方案）

1. **修改 Podfile**（使用 Git 源）：
   ```bash
   cd ios
   # 编辑 Podfile，将 CDN 源改为 Git 源
   ```

2. **清理并重新安装**：
   ```bash
   cd ios
   rm -rf Podfile.lock Pods
   pod cache clean --all
   pod install --repo-update
   cd ..
   ```

3. **如果仍然失败，尝试使用国内镜像**：
   ```bash
   cd ios
   # 修改 Podfile 使用镜像源
   pod install
   cd ..
   ```

## 验证安装

安装成功后，你应该看到：
```
Pod installation complete! There are X dependencies from the Podfile.
```

然后可以继续构建：
```bash
npm run ios
```
