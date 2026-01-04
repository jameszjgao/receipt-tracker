# Supabase Storage RLS 配置指南

## 问题
上传图片到 Storage 时出现错误：`StorageApiError: new row violates row-level security policy`

这是因为 Supabase Storage 也有 RLS（Row Level Security）策略，需要单独配置。

## 解决方案

### 步骤 1: 打开 Supabase Dashboard
1. 访问 https://supabase.com/dashboard
2. 登录并选择你的项目

### 步骤 2: 进入 Storage 设置
1. 点击左侧菜单的 **"Storage"**
2. 找到 **"receipts"** bucket（如果不存在，先创建一个）
3. 点击 **"receipts"** bucket 名称进入详情

### 步骤 3: 配置 Storage Policies
1. 点击 **"Policies"** 标签
2. 点击 **"New Policy"** 按钮

### 步骤 4: 创建上传策略（INSERT）
1. **Policy name**: `Allow authenticated uploads`
2. **Allowed operation**: 选择 **INSERT**
3. **Policy definition**: 
   ```sql
   (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)
   ```
4. 或者使用简化版本：
   ```sql
   auth.role() = 'authenticated'
   ```
5. 点击 **"Review"** 然后 **"Save policy"**

### 步骤 5: 创建查看策略（SELECT）
1. 再次点击 **"New Policy"**
2. **Policy name**: `Allow authenticated select`
3. **Allowed operation**: 选择 **SELECT**
4. **Policy definition**: 
   ```sql
   (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)
   ```
5. 点击 **"Save policy"**

### 步骤 6: 创建更新策略（UPDATE）
1. 再次点击 **"New Policy"**
2. **Policy name**: `Allow authenticated update`
3. **Allowed operation**: 选择 **UPDATE**
4. **Policy definition**: 
   ```sql
   (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)
   ```
5. 点击 **"Save policy"**

### 步骤 7: 创建删除策略（DELETE）
1. 再次点击 **"New Policy"**
2. **Policy name**: `Allow authenticated delete`
3. **Allowed operation**: 选择 **DELETE**
4. **Policy definition**: 
   ```sql
   (bucket_id = 'receipts'::text) AND (auth.role() = 'authenticated'::text)
   ```
5. 点击 **"Save policy"**

## 验证配置

配置完成后，应该能看到 4 个策略：
- ✅ Allow authenticated uploads (INSERT)
- ✅ Allow authenticated select (SELECT)
- ✅ Allow authenticated update (UPDATE)
- ✅ Allow authenticated delete (DELETE)

## 如果 receipts bucket 不存在

如果还没有创建 `receipts` bucket：

1. 在 Storage 页面，点击 **"New bucket"**
2. **Name**: `receipts`
3. **Public bucket**: 可以选择 **公开**（如果希望图片可以直接通过 URL 访问）或 **私有**（更安全）
4. 点击 **"Create bucket"**
5. 然后按照上面的步骤配置策略

## 测试

配置完成后：
1. 重新尝试拍摄小票
2. 应该可以成功上传图片到 Storage
3. 然后图片 URL 会被传递给 Gemini API 进行识别
4. 识别结果会保存到数据库

## 注意事项

- Storage RLS 策略和数据库表 RLS 策略是分开配置的
- 必须确保用户已登录（`auth.role() = 'authenticated'`）
- 如果希望图片公开访问，可以在创建 bucket 时设置为公开，或者使用 public URL

