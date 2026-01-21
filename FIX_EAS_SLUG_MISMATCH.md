# 修复 EAS Slug 不匹配问题

## 问题描述

构建时出现错误：
```
Project config: Slug for project identified by "extra.eas.projectId" (snap-receipt) does not match the "slug" field (vouchap).
```

这是因为 EAS 项目 ID `ab9f28b4-7d21-45e4-8c82-5d8cabfb2583` 关联的 slug 是 `snap-receipt`，但 `app.config.js` 中的 slug 已更新为 `vouchap`。

## 解决方案

有两种方法解决这个问题：

### 方法 1：在 EAS Dashboard 中更新项目 Slug（推荐）

1. **访问 EAS Dashboard**
   - 打开 https://expo.dev/accounts/aimlink/projects/snap-receipt/settings
   - 或访问 https://expo.dev，登录后进入项目设置

2. **更新项目 Slug**
   - 在项目设置中找到 "Slug" 字段
   - 将 `snap-receipt` 更改为 `vouchap`
   - 保存更改

3. **验证配置**
   - 运行 `npx eas project:info` 验证配置是否正确
   - 如果仍有问题，可能需要等待几分钟让更改生效

### 方法 2：创建新的 EAS 项目（如果无法更新现有项目）

1. **创建新项目**
   ```bash
   npx eas init
   ```
   - 选择创建新项目
   - 输入 slug: `vouchap`
   - 输入 owner: `aimlink`

2. **更新配置文件**
   - 新项目会生成新的 `projectId`
   - 将新的 `projectId` 更新到 `app.config.js` 和 `app.json` 中

3. **注意**
   - 创建新项目会导致之前的构建历史丢失
   - 如果是生产环境，建议使用方法 1

## 临时解决方案（不推荐）

如果暂时无法访问 EAS Dashboard，可以临时将 `app.config.js` 中的 slug 改回 `snap-receipt`：

```javascript
slug: "snap-receipt",  // 临时改回，匹配现有 EAS 项目
```

但这与应用的改名需求冲突，**不推荐**作为长期解决方案。

## 验证修复

修复后，运行以下命令验证：

```bash
npx eas project:info
```

如果配置正确，应该能看到项目的详细信息，而不会出现 slug 不匹配的错误。

## 参考链接

- [EAS Project Configuration](https://docs.expo.dev/eas-update/eas-json/)
- [Expo Project IDs](https://expo.fyi/eas-project-id)
