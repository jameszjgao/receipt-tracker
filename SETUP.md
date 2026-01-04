# 设置指南

## 1. 环境变量配置

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入你的配置：
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## 2. Supabase 数据库设置

### 步骤 1: 创建表结构

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `database.sql` 文件中的 SQL 语句

或者直接复制粘贴以下 SQL：

```sql
-- 创建 receipts 表
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_name TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  payment_account TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_url TEXT,
  confidence DECIMAL(3, 2),
  processed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建 receipt_items 表
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  purpose TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_asset BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(3, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);
```

### 步骤 2: 设置 Row Level Security (RLS)

在 Supabase Dashboard 的 Authentication > Policies 中，或者使用 SQL：

```sql
-- 启用 RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

-- 创建策略（允许所有操作，生产环境需要更严格的策略）
CREATE POLICY "Allow all operations on receipts" ON receipts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on receipt_items" ON receipt_items
  FOR ALL USING (true) WITH CHECK (true);
```

### 步骤 3: 创建 Storage Bucket

1. 进入 Supabase Dashboard > Storage
2. 点击 "New bucket"
3. 命名为 `receipts`
4. 设置为 **Public**（或根据需要配置访问策略）
5. 点击 "Create bucket"

## 3. Gemini API 配置

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API Key
3. 将 API Key 复制到 `.env` 文件的 `GEMINI_API_KEY`

## 4. 安装依赖

```bash
npm install
# 或
yarn install
```

## 5. 运行应用

```bash
npm start
# 或
yarn start
```

然后：
- 按 `i` 启动 iOS 模拟器
- 按 `a` 启动 Android 模拟器
- 扫描二维码在真实设备上运行

## 6. 测试

1. 打开应用
2. 点击"拍摄小票"按钮
3. 拍摄一张小票或从相册选择
4. 等待 AI 识别完成
5. 检查识别结果并确认

## 常见问题

### 问题 1: 环境变量未生效

确保：
- `.env` 文件在项目根目录
- 变量名以 `EXPO_PUBLIC_` 开头（对于客户端可访问的变量）
- 重启 Expo 开发服务器

### 问题 2: 图片上传失败

检查：
- Storage Bucket 是否已创建
- Bucket 是否为 Public 或配置了正确的访问策略
- Supabase URL 和 Key 是否正确

### 问题 3: AI 识别失败

检查：
- Gemini API Key 是否正确
- API Key 是否有足够的配额
- 网络连接是否正常

### 问题 4: 数据库操作失败

检查：
- 表结构是否正确创建
- RLS 策略是否正确配置
- Supabase URL 和 Anon Key 是否正确

## 下一步

- 配置更严格的 RLS 策略（如果需要多用户支持）
- 设置环境变量管理（如使用 Expo Secrets）
- 配置 CI/CD 流程
- 添加错误监控（如 Sentry）

