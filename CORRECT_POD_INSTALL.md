# 正确的 pod install 操作步骤

## ❌ 错误操作

```bash
source 'https://cdn.cocoapods.org/'  # ❌ 这是错误的！
```

`source` 是 shell 命令，用于执行脚本文件，不能用于 URL。

## ✅ 正确操作

`source 'https://cdn.cocoapods.org/'` 这行代码应该**已经在 Podfile 文件中了**，不需要在终端运行。

### 步骤 1：检查 Podfile 配置

```bash
# 查看 Podfile 的第一行
head -2 /Users/macbook/Vouchap/ios/Podfile
```

应该看到：
```
# 使用 CocoaPods CDN 加速（比 GitHub 快很多）
source 'https://cdn.cocoapods.org/'
```

### 步骤 2：清理并重新安装

```bash
# 进入 ios 目录
cd /Users/macbook/Vouchap/ios

# 清理之前的安装
rm -rf Pods Podfile.lock

# 重新安装（会自动使用 Podfile 中配置的 CDN）
pod install --repo-update
```

## 说明

- ✅ **Podfile 已配置 CDN**：`source 'https://cdn.cocoapods.org/'` 已经在 Podfile 文件中
- ✅ **不需要在终端运行**：Podfile 中的配置会自动生效
- ✅ **直接运行 pod install**：CocoaPods 会自动读取 Podfile 中的配置

## 完整操作流程

```bash
# 1. 进入 ios 目录
cd /Users/macbook/Vouchap/ios

# 2. 清理（如果之前安装失败）
rm -rf Pods Podfile.lock

# 3. 重新安装（会自动使用 CDN）
pod install --repo-update

# 或者如果 repo 已经更新过，可以跳过：
pod install
```

## 验证 CDN 配置

检查 Podfile 是否已配置 CDN：

```bash
# 查看 Podfile 前几行
head -5 /Users/macbook/Vouchap/ios/Podfile
```

应该看到：
```ruby
# 使用 CocoaPods CDN 加速（比 GitHub 快很多）
source 'https://cdn.cocoapods.org/'
```

如果看到这行，说明配置正确，直接运行 `pod install` 即可。

## 如果 Podfile 没有 CDN 配置

如果 Podfile 第一行不是 `source 'https://cdn.cocoapods.org/'`，需要添加：

```bash
# 编辑 Podfile
nano /Users/macbook/Vouchap/ios/Podfile
```

在文件最开头添加：
```ruby
source 'https://cdn.cocoapods.org/'
```

保存后运行 `pod install`。
