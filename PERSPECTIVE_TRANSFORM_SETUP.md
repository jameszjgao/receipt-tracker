# 透视变换（Perspective Transform）设置指南

## 功能说明

透视变换功能可以将倾斜拍摄的小票（梯形）转换为正视图（矩形），提高 OCR 识别准确率。

## 当前实现状态

### ✅ 已完成
1. **角点检测接口**：`detectReceiptCorners()` 函数已实现（简化版本）
2. **裁剪框预览**：相机预览上显示裁剪框，提示用户拍摄后的裁剪效果
3. **基础边缘检测**：使用简化的边缘检测算法

### ⚠️ 待实现（需要服务端支持）

由于 `expo-image-manipulator` 不支持透视变换，需要以下方案之一：

#### 方案 1：使用 Supabase Edge Functions + OpenCV（推荐）

1. **创建 Edge Function**：
   ```typescript
   // supabase/functions/perspective-transform/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
   
   serve(async (req) => {
     // 使用 OpenCV 或图像处理库进行透视变换
     // 接收图片 URL 和四个角点坐标
     // 返回处理后的图片 URL
   })
   ```

2. **安装依赖**：
   - 在 Edge Function 中使用 `opencv-wasm` 或类似的图像处理库
   - 或者使用 Python 版本的 Edge Function + OpenCV

#### 方案 2：使用 Gemini Vision API 检测角点

1. **修改 Gemini Prompt**：添加角点检测要求
2. **解析角点坐标**：从 Gemini 返回的 JSON 中提取四个角点
3. **服务端透视变换**：将角点坐标发送到服务端进行变换

#### 方案 3：使用原生模块（需要开发构建）

1. **安装原生模块**：如 `react-native-opencv` 或 `react-native-image-manipulator`
2. **实现透视变换**：在原生代码中实现 `warpPerspective`
3. **桥接到 JS**：通过 React Native 桥接调用原生函数

## 当前工作流程

1. **拍摄照片**：用户拍摄小票
2. **显示预览框**：相机预览上显示裁剪框（提示用户拍摄后的裁剪效果）
3. **边缘检测**：使用简化的边缘检测算法（基于边距计算）
4. **矩形裁剪**：使用 `expo-image-manipulator` 进行矩形裁剪（不支持透视变换）
5. **图像增强**：应用亮度/对比度优化

## 未来改进方向

1. **集成 Gemini Vision API**：使用 Gemini 检测小票的四个角点
2. **服务端透视变换**：在 Supabase Edge Functions 中实现透视变换
3. **实时角点检测**：在相机预览时实时检测角点并显示动态四边形

## 使用说明

当前版本会：
- ✅ 显示裁剪框预览（提示用户拍摄后的裁剪效果）
- ✅ 自动裁剪图片（基于边缘检测）
- ⚠️ 不支持透视变换（倾斜拍摄的小票会保持倾斜）

要启用完整的透视变换功能，需要按照上述方案之一实现服务端处理。
