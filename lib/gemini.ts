import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { GeminiReceiptResult, ItemPurpose } from '@/types';
import { getAvailableImageModel } from './gemini-helper';

const apiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('Gemini API Key check:', {
    fromConfig: !!Constants.expoConfig?.extra?.geminiApiKey,
    fromPublicEnv: !!process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    fromEnv: !!process.env.GEMINI_API_KEY,
  });
  throw new Error('缺少 Gemini API Key。请检查 .env 文件中的 GEMINI_API_KEY 配置');
}

const genAI = new GoogleGenerativeAI(apiKey);

// 尝试多个可能的模型名称（按优先级排序，优先使用最快的模型）
// gemini-1.5-flash 是最快的模型，适合实时处理
const POSSIBLE_MODELS = [
  'gemini-1.5-flash',        // 最快，优先使用
  'gemini-1.5-flash-latest', // 最新版本的 flash
  'gemini-1.5-pro-latest',   // Pro 最新版本
  'gemini-1.5-pro',          // Pro 稳定版本
  'gemini-pro-vision',       // 旧版本
  'gemini-pro',              // 最旧版本
];

// 动态获取可用模型的缓存
let availableModelCache: string | null = null;

// 识别小票内容（使用图片 URL）
export async function recognizeReceipt(imageUrl: string): Promise<GeminiReceiptResult> {
  // 记录尝试使用的模型和 API Key 信息
  console.log('Starting receipt recognition with image URL...');
  console.log('Image URL:', imageUrl);
  console.log('API Key present:', !!apiKey, 'Length:', apiKey?.length || 0);
  if (apiKey) {
    console.log('API Key prefix:', apiKey.substring(0, 10) + '...');
  }

  // 首先尝试从 API 获取可用模型（如果缓存为空）
  if (!availableModelCache) {
    console.log('Attempting to fetch available models from API...');
    try {
      const availableModel = await getAvailableImageModel();
      if (availableModel) {
        availableModelCache = availableModel;
        console.log('✅ Found available model via API:', availableModelCache);
      } else {
        console.warn('⚠️  No image models found via API');
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch available models from API:', error);
      console.warn('Will try default model list...');
    }
  }

  // 如果找到了可用模型，优先使用它
  const modelsToTry = availableModelCache ? [availableModelCache, ...POSSIBLE_MODELS] : POSSIBLE_MODELS;

  const prompt = `你是一个财务专家。请分析这张图片中的小票，提取出：
1. 商户名称 (storeName)
2. 日期 (date，格式：YYYY-MM-DD)
3. 总金额 (totalAmount，数字类型)
4. 币种 (currency，如：CNY、USD等)
5. 支付账户 (paymentAccount，如果有，包含卡号尾号信息)
6. 税费 (tax，数字类型，如果没有则为0)
7. 详细商品列表 (items)，每个商品包含：
   - 名称 (name)
   - 分类 (categoryName): 根据商品内容自动从[食品,外餐, 居家, 交通, 购物, 医疗, 教育]中选择一个
   - 单价 (price，数字类型)

请严格以 JSON 格式返回，不要有任何多余文字。JSON格式如下：
{
  "storeName": "商户名称",
  "date": "2024-03-13",
  "totalAmount": 123.45,
  "currency": "CNY",
  "paymentAccount": "信用卡****1234",
  "tax": 5.67,
  "items": [
    {
      "name": "商品名称",
      "categoryName": "食品",
      "price": 12.99
    }
  ]
}`;

  // 从 URL 下载图片并转换为 base64（只需要下载一次）
  console.log('Downloading image from URL...');
  console.log('Image URL:', imageUrl);

  // 下载文件到临时目录
  const downloadResult = await FileSystem.downloadAsync(
    imageUrl,
    FileSystem.documentDirectory + `temp-${Date.now()}.jpg`
  );

  if (!downloadResult.uri) {
    throw new Error('Failed to download image from URL');
  }

  // 读取文件为 base64
  const base64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 清理临时文件
  try {
    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
  } catch (e) {
    console.warn('Failed to delete temp file:', e);
  }

  // 从 URL 推断 MIME 类型
  let mimeType = 'image/jpeg';
  if (imageUrl.includes('.png')) {
    mimeType = 'image/png';
  } else if (imageUrl.includes('.gif')) {
    mimeType = 'image/gif';
  } else if (imageUrl.includes('.webp')) {
    mimeType = 'image/webp';
  }

  console.log('Image downloaded, size:', base64.length, 'bytes, mime type:', mimeType);

  // 使用 base64 图片数据
  const imagePart = {
    inlineData: {
      data: base64,
      mimeType: mimeType,
    },
  };

  // 尝试每个模型，直到找到一个可用的
  let lastError: Error | null = null;
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      console.log('Sending request to Gemini API...');
      const result = await model.generateContent([prompt, imagePart]);
      const apiResponse = await result.response;
      const text = apiResponse.text();
      console.log(`✅ Model ${modelName} worked! Response length:`, text.length);

      // 提取JSON部分（去除可能的markdown代码块标记）
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedResult: GeminiReceiptResult = JSON.parse(jsonText);

      // 验证和规范化数据
      return {
        storeName: parsedResult.storeName || '未知商户',
        date: parsedResult.date || new Date().toISOString().split('T')[0],
        totalAmount: Number(parsedResult.totalAmount) || 0,
        currency: parsedResult.currency || 'CNY',
        paymentAccountName: parsedResult.paymentAccountName || undefined,
        tax: parsedResult.tax !== undefined ? Number(parsedResult.tax) : 0,
        items: parsedResult.items.map(item => ({
          name: item.name || '未知商品',
          categoryName: item.categoryName || '购物', // 默认使用"购物"而不是"Other"
          price: Number(item.price) || 0,
          purpose: (item.purpose as ItemPurpose) || 'Personnel',
          isAsset: item.isAsset !== undefined ? Boolean(item.isAsset) : false,
          confidence: item.confidence !== undefined ? Number(item.confidence) : 0.8,
        })),
        confidence: parsedResult.confidence !== undefined ? Number(parsedResult.confidence) : 0.8,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Model ${modelName} failed:`, lastError.message);
      
      // 如果是模型不存在的错误，尝试下一个模型
      const errorMsg = lastError.message.toLowerCase();
      if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        console.log(`  模型 ${modelName} 不可用，尝试下一个...`);
        continue;
      }
      
      // 如果是其他错误（如 API Key 错误），不再尝试其他模型
      break;
    }
  }

  // 如果所有模型都失败了
  console.error('All models failed. Last error:', lastError);
  
  if (lastError) {
    const errorMsg = lastError.message.toLowerCase();
    
    // API Key 相关错误
    if (errorMsg.includes('api key') || errorMsg.includes('api_key') || errorMsg.includes('invalid api key') || errorMsg.includes('401')) {
      throw new Error(
        `Gemini API Key 无效或未配置\n\n` +
        `请检查：\n` +
        `1. API Key 是否正确设置（检查 .env 文件或 app.config.js）\n` +
        `2. API Key 是否有效（访问 https://makersuite.google.com/app/apikey 创建新的 Key）\n` +
        `3. API Key 是否有访问 Gemini API 的权限\n\n` +
        `当前 API Key 长度: ${apiKey?.length || 0}\n` +
        `原始错误: ${lastError.message}`
      );
    }
    
    // 配额相关错误
    if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      throw new Error(`API 调用配额已用完或达到限制\n原始错误: ${lastError.message}`);
    }
    
    // 权限相关错误
    if (errorMsg.includes('permission') || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
      throw new Error(`API 权限不足，请检查 API Key 权限\n原始错误: ${lastError.message}`);
    }
    
    // 模型不存在错误
    if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      throw new Error(
        `所有 Gemini 模型都不可用 (404)\n\n` +
        `已尝试的模型: ${POSSIBLE_MODELS.join(', ')}\n\n` +
        `可能原因：\n` +
        `1. API Key 没有访问这些模型的权限\n` +
        `2. API Key 可能不是最新的（需要访问 Google AI Studio 创建新的 Key）\n` +
        `3. API 版本不匹配\n\n` +
        `建议：\n` +
        `1. 访问 https://makersuite.google.com/app/apikey 创建新的 API Key\n` +
        `2. 确保 API Key 可以访问 Gemini 1.5 模型\n` +
        `3. 检查 Google Cloud Console 中的 API 启用状态\n\n` +
        `原始错误: ${lastError.message}`
      );
    }
    
    // 网络连接错误
    if (errorMsg.includes('network') || 
        errorMsg.includes('fetch') || 
        errorMsg.includes('connection') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('econnrefused') ||
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('generativelanguage.googleapis.com')) {
      throw new Error(
        `网络连接失败\n\n` +
        `重要提示：\n` +
        `在中国大陆可能无法直接访问 Google API (googleapis.com)\n\n` +
        `解决方案：\n` +
        `1. 使用 VPN/代理连接到 Google API\n` +
        `2. 使用支持 Google API 的代理服务器\n` +
        `3. 检查防火墙/网络设置\n\n` +
        `原始错误: ${lastError.message}`
      );
    }
    
    // 其他错误
    throw new Error(
      `识别小票失败\n\n` +
      `错误类型: ${lastError.name}\n` +
      `详细信息: ${lastError.message}\n\n` +
      `请检查 API Key 配置和网络连接`
    );
  }
  
  throw new Error('识别小票失败: 未知错误');
}
