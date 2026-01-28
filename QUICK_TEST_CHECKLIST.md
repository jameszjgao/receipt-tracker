# 快速测试检查清单

## 🚀 5 分钟快速验证

### 1. 数据库配置（1 分钟）

在 Supabase SQL Editor 执行：
```sql
-- 快速检查表名
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('spaces', 'suppliers', 'space_invitations', 'user_spaces')
ORDER BY table_name;
```

**预期**：应该返回 4 个表，不应该有 `households`, `stores` 等

### 2. 应用启动（1 分钟）

```bash
npm start
# 或
npx expo start
```

**检查**：
- ✅ 应用正常启动
- ✅ 无控制台错误
- ✅ 登录页面正常显示

### 3. 核心功能（3 分钟）

**测试流程**：
1. 注册新账号 → 应该跳转到空间设置页面
2. 创建空间 → 应该自动进入首页
3. 拍摄小票 → 应该识别并保存
4. 查看小票列表 → 应该显示刚创建的小票

**预期**：
- ✅ 所有步骤无错误
- ✅ 数据正确保存
- ✅ UI 正常显示

## ⚠️ 如果遇到错误

### 错误 1: "relation does not exist"
→ 执行表重命名脚本

### 错误 2: "column does not exist"  
→ 执行列重命名脚本

### 错误 3: "function does not exist"
→ 执行函数创建脚本

### 错误 4: 权限错误
→ 执行 RLS 策略更新脚本
