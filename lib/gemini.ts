import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCategories } from './categories';
import { getPurposes } from './purposes';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as FileSystemNew from 'expo-file-system';
import { GeminiReceiptResult } from '@/types';
import { getAvailableImageModel } from './gemini-helper';
import { getMostFrequentCurrency } from './database';

// 引用 gemini-helper 中处理好的安全判断逻辑（如果 gemini-helper 导出了 apiKey）
// 或者直接在此处复制安全获取逻辑：
const getSafeKey = () => {
  const k = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.geminiApiKey || '';
  return (k.includes('${') || k === 'undefined') ? '' : k;
};

const apiKey = getSafeKey();

const genAI = (apiKey && apiKey !== '') 
  ? new GoogleGenerativeAI(apiKey) 
  : null;
  
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
  // 重新获取 API Key（确保使用最新的值）
  const currentApiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  // 调试日志
  console.log('=== Gemini API Key Debug ===');
  console.log('Constants.expoConfig?.extra?.geminiApiKey:', Constants.expoConfig?.extra?.geminiApiKey ? `Present (length: ${Constants.expoConfig.extra.geminiApiKey.length})` : 'Missing');
  console.log('process.env.EXPO_PUBLIC_GEMINI_API_KEY:', process.env.EXPO_PUBLIC_GEMINI_API_KEY ? `Present (length: ${process.env.EXPO_PUBLIC_GEMINI_API_KEY.length})` : 'Missing');
  console.log('Final currentApiKey:', currentApiKey ? `Present (length: ${currentApiKey.length})` : 'Missing');
  console.log('===========================');
  
  // 验证 API Key 是否配置
  if (!currentApiKey || currentApiKey === '' || currentApiKey === 'placeholder-key') {
    const errorMsg = `Gemini API Key 未配置。\n\n调试信息：\n- Constants.expoConfig?.extra?.geminiApiKey: ${Constants.expoConfig?.extra?.geminiApiKey ? '存在' : '不存在'}\n- process.env.EXPO_PUBLIC_GEMINI_API_KEY: ${process.env.EXPO_PUBLIC_GEMINI_API_KEY ? '存在' : '不存在'}\n- 当前 API Key 值: ${currentApiKey || '(空)'}\n\n请在 EAS Secrets 中设置 EXPO_PUBLIC_GEMINI_API_KEY，然后重新构建应用。`;
    const error = new Error(errorMsg) as any;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }

  // 记录尝试使用的模型和 API Key 信息
  console.log('Starting receipt recognition with image URL...');
  console.log('Image URL:', imageUrl);
  console.log('API Key present:', !!currentApiKey, 'Length:', currentApiKey?.length || 0);
  if (currentApiKey) {
    console.log('API Key prefix:', currentApiKey.substring(0, 10) + '...');
  }
  
  // 使用当前获取的 API Key 创建新的 genAI 实例
  const currentGenAI = new GoogleGenerativeAI(currentApiKey);

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

  // 获取用户的分类列表
  let categoryNames: string[] = [];
  try {
    const categories = await getCategories();
    categoryNames = categories.map(cat => cat.name);
  } catch (error) {
    console.warn('Failed to fetch categories, using default list:', error);
    // 如果获取失败，使用默认分类列表
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  // 如果分类列表为空，使用默认分类
  if (categoryNames.length === 0) {
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  // 获取用户的用途列表
  let purposeNames: string[] = [];
  try {
    const purposes = await getPurposes();
    purposeNames = purposes.map(p => p.name);
  } catch (error) {
    console.warn('Failed to fetch purposes, using default list:', error);
    // 如果获取失败，使用默认用途列表
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  // 如果用途列表为空，使用默认用途
  if (purposeNames.length === 0) {
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  const categoryList = categoryNames.join(', ');
  const purposeList = purposeNames.join(', ');

  const prompt = `You are a financial expert. Please analyze the receipt in this image and extract:
1. Store name (storeName)
2. Date (date, format: YYYY-MM-DD)
3. Total amount (totalAmount, numeric type, can be negative for refunds)
4. Currency (currency, such as: CNY, USD, etc.)
5. Payment account (paymentAccountName, if available, MUST include key distinguishing information such as:
   - Card number suffix (last 4 digits, e.g., ****1234, *1234, Last 4: 1234)
   - Account type (Credit Card, Debit Card, Cash, etc.)
   - Any other identifying information that helps distinguish different payment methods)
6. Tax amount (tax, numeric type, 0 if not available)
7. Detailed item list (items), each item contains:
   - Name (name)
   - Category (categoryName): Automatically select one from [${categoryList}] based on item content
   - Purpose (purpose): Select one from [${purposeList}]. DEFAULT to "Home" unless there is clear evidence indicating otherwise (e.g., explicit business expense mention, gift purchase indication). Most receipts are personal/family use, so use "Home" as the default.
   - Unit price (price, numeric type, can be negative for refunds)
8. Image quality assessment (imageQuality):
   - clarity: Image clarity score (0.0-1.0, where 1.0 is perfectly clear)
   - completeness: Image completeness score (0.0-1.0, where 1.0 means all receipt content is visible)
   - clarityComment: Brief comment on image clarity (e.g., "Clear and sharp", "Slightly blurry", "Very blurry")
   - completenessComment: Brief comment on image completeness (e.g., "Complete receipt visible", "Partially cut off", "Missing important sections")
9. Data consistency check (dataConsistency):
   - itemsSum: Sum of all item prices (calculate: sum of all items.price)
   - itemsSumMatchesTotal: Boolean indicating if itemsSum + tax (if any) equals totalAmount (within 0.01 tolerance)
   - missingItems: Boolean indicating if there might be items not captured in the list
   - consistencyComment: Brief comment on data consistency (e.g., "Items sum matches total", "Items sum differs from total by X", "Some items may be missing")
10. Overall confidence (confidence): Overall recognition confidence score (0.0-1.0). Consider:
    - Image clarity and completeness
    - Whether all items are captured
    - Whether item prices sum matches the total amount
    - Lower confidence if items sum doesn't match total or if items seem incomplete

Please return strictly in JSON format without any extra text. JSON format as follows:
{
  "storeName": "Store Name",
  "date": "2024-03-13",
  "totalAmount": 123.45,
  "currency": "CNY",
  "paymentAccountName": "Credit Card ****1234",
  "tax": 5.67,
  "items": [
    {
      "name": "Item Name",
      "categoryName": "Food",
      "purpose": "Home",
      "price": 12.99
    }
  ],
  "imageQuality": {
    "clarity": 0.95,
    "completeness": 1.0,
    "clarityComment": "Clear and sharp",
    "completenessComment": "Complete receipt visible"
  },
  "dataConsistency": {
    "itemsSum": 123.45,
    "itemsSumMatchesTotal": true,
    "missingItems": false,
    "consistencyComment": "Items sum matches total"
  },
  "confidence": 0.92
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
      const model = currentGenAI.getGenerativeModel({ model: modelName });

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
      const defaultCategory = categoryNames.length > 0 ? categoryNames[0] : 'Shopping';
      // 兼容处理：支持 paymentAccount 和 paymentAccountName 两种字段名
      const paymentAccountName = parsedResult.paymentAccountName || (parsedResult as any).paymentAccount || undefined;
      
      // 处理图片质量评价
      const imageQuality = parsedResult.imageQuality ? {
        clarity: parsedResult.imageQuality.clarity !== undefined ? Number(parsedResult.imageQuality.clarity) : undefined,
        completeness: parsedResult.imageQuality.completeness !== undefined ? Number(parsedResult.imageQuality.completeness) : undefined,
        clarityComment: parsedResult.imageQuality.clarityComment,
        completenessComment: parsedResult.imageQuality.completenessComment,
      } : undefined;
      
      // 处理数据一致性检查
      const dataConsistency = parsedResult.dataConsistency ? {
        itemsSum: parsedResult.dataConsistency.itemsSum !== undefined ? Number(parsedResult.dataConsistency.itemsSum) : undefined,
        itemsSumMatchesTotal: parsedResult.dataConsistency.itemsSumMatchesTotal !== undefined ? Boolean(parsedResult.dataConsistency.itemsSumMatchesTotal) : undefined,
        missingItems: parsedResult.dataConsistency.missingItems !== undefined ? Boolean(parsedResult.dataConsistency.missingItems) : undefined,
        consistencyComment: parsedResult.dataConsistency.consistencyComment,
      } : undefined;
      
      // 计算实际的明细金额总和（用于验证）
      const calculatedItemsSum = parsedResult.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      const totalAmount = Number(parsedResult.totalAmount) || 0;
      const tax = parsedResult.tax !== undefined ? Number(parsedResult.tax) : 0;
      const expectedTotal = calculatedItemsSum + tax;
      const actualItemsSumMatches = Math.abs(expectedTotal - totalAmount) <= 0.01;
      
      return {
        storeName: parsedResult.storeName || 'Unknown Store',
        date: parsedResult.date || new Date().toISOString().split('T')[0],
        totalAmount: totalAmount,
        currency: parsedResult.currency || defaultCurrency,
        paymentAccountName: paymentAccountName,
        tax: tax,
        items: parsedResult.items.map(item => ({
          name: item.name || 'Unknown Item',
          categoryName: item.categoryName || defaultCategory, // Use first category as default
          price: Number(item.price) || 0,
          purposeName: item.purpose || 'Home',
          isAsset: item.isAsset !== undefined ? Boolean(item.isAsset) : false,
          confidence: item.confidence !== undefined ? Number(item.confidence) : 0.8,
        })),
        confidence: parsedResult.confidence !== undefined ? Number(parsedResult.confidence) : 0.8,
        imageQuality: imageQuality,
        dataConsistency: dataConsistency || {
          itemsSum: calculatedItemsSum,
          itemsSumMatchesTotal: actualItemsSumMatches,
          missingItems: !actualItemsSumMatches && calculatedItemsSum < totalAmount,
          consistencyComment: actualItemsSumMatches 
            ? 'Items sum matches total' 
            : `Items sum (${calculatedItemsSum.toFixed(2)}) differs from total (${totalAmount.toFixed(2)}) by ${Math.abs(expectedTotal - totalAmount).toFixed(2)}`,
        },
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
      throw new Error(`API quota exhausted or limit reached\nOriginal error: ${lastError.message}`);
    }
    
    // 权限相关错误
    if (errorMsg.includes('permission') || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
      throw new Error(`API permission insufficient, please check API Key permissions\nOriginal error: ${lastError.message}`);
    }
    
    // 模型不存在错误
    if (errorMsg.includes('not found') || errorMsg.includes('404')) {
      throw new Error(
        `All Gemini models unavailable (404)\n\n` +
        `Attempted models: ${POSSIBLE_MODELS.join(', ')}\n\n` +
        `Possible causes:\n` +
        `1. API Key does not have permission to access these models\n` +
        `2. API Key may not be up to date (need to create new Key at Google AI Studio)\n` +
        `3. API version mismatch\n\n` +
        `Suggestions:\n` +
        `1. Visit https://makersuite.google.com/app/apikey to create a new API Key\n` +
        `2. Ensure API Key can access Gemini 1.5 models\n` +
        `3. Check API enablement status in Google Cloud Console\n\n` +
        `Original error: ${lastError.message}`
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
        `Network connection failed\n\n` +
        `Possible causes:\n` +
        `1. API Key not configured or invalid\n` +
        `2. Network connectivity issue\n` +
        `3. Google API service temporarily unavailable\n` +
        `4. Firewall or proxy blocking the request\n\n` +
        `Please check:\n` +
        `- Gemini API Key is set in EAS Secrets (EXPO_PUBLIC_GEMINI_API_KEY)\n` +
        `- Network connection is working\n` +
        `- API Key is valid and has proper permissions\n\n` +
        `Original error: ${lastError.message}`
      );
    }
    
    // 其他错误
    throw new Error(
      `Receipt recognition failed\n\n` +
      `Error type: ${lastError.name}\n` +
      `Details: ${lastError.message}\n\n` +
      `Please check API Key configuration and network connection`
    );
  }
  
  throw new Error('Receipt recognition failed: Unknown error');
}

// 从文字识别小票内容
export async function recognizeReceiptFromText(text: string): Promise<GeminiReceiptResult> {
  // 重新获取 API Key（确保使用最新的值）
  const currentApiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  if (!currentApiKey || currentApiKey === '' || currentApiKey === 'placeholder-key') {
    const error = new Error('Gemini API Key 未配置。请在 EAS Secrets 中设置 EXPO_PUBLIC_GEMINI_API_KEY。') as any;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }
  
  const currentGenAI = new GoogleGenerativeAI(currentApiKey);
  
  console.log('Starting receipt recognition with text...');
  console.log('Text input:', text);

  // 获取用户的分类列表
  let categoryNames: string[] = [];
  try {
    const categories = await getCategories();
    categoryNames = categories.map(cat => cat.name);
  } catch (error) {
    console.warn('Failed to fetch categories, using default list:', error);
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  if (categoryNames.length === 0) {
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  // 获取用户的用途列表
  let purposeNames: string[] = [];
  try {
    const purposes = await getPurposes();
    purposeNames = purposes.map(p => p.name);
  } catch (error) {
    console.warn('Failed to fetch purposes, using default list:', error);
    // 如果获取失败，使用默认用途列表
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  // 如果用途列表为空，使用默认用途
  if (purposeNames.length === 0) {
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  // 获取用户历史小票中最频繁的币种，作为默认币种
  let defaultCurrency = 'USD'; // 文本识别的默认值
  try {
    const mostFrequentCurrency = await getMostFrequentCurrency();
    if (mostFrequentCurrency) {
      defaultCurrency = mostFrequentCurrency;
      console.log('Using most frequent currency as default:', defaultCurrency);
    } else {
      console.log('No currency history found, using default:', defaultCurrency);
    }
  } catch (error) {
    console.warn('Failed to fetch most frequent currency, using default:', error);
  }

  const categoryList = categoryNames.join(', ');
  const purposeList = purposeNames.join(', ');

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();
  
  const prompt = `You are a financial expert. Please carefully analyze the receipt information from this text input and extract ALL available information. Pay special attention to details about the purchase time, payment account, store name, and all items.

CURRENT DATE CONTEXT:
- Today's date: ${today}
- Current year: ${currentYear}
- Current month: ${currentMonth}
- Current day: ${currentDay}

REQUIRED FIELDS (extract completely, do not omit any mentioned information):

1. Store name (storeName) - string, REQUIRED
   - Extract the complete store/business name from the text
   - Look for patterns like: "at [Store Name]", "from [Store Name]", "paid [Store Name]", "[Store Name] receipt", or explicit store mentions
   - If the store name is mentioned, extract it completely, including any brand names, locations, or suffixes
   - If no store name is explicitly mentioned:
     * First, try to infer from context (e.g., "Starbucks" from "coffee at Starbucks")
     * If inference fails and there are items mentioned, use the FIRST item's name as the store name
     * Only use "Unknown Store" as a last resort if no items are mentioned either

2. Date (date) - string, format: YYYY-MM-DD, REQUIRED - CRITICAL: Purchase dates are typically RECENT dates
   - Extract the purchase date from the text with high priority
   - IMPORTANT: Receipts are usually from RECENT purchases (within the past few days to weeks), NOT from years ago
   - Recognize various date formats:
     * Explicit dates: "March 15, 2024", "2024-03-15", "03/15/2024", "15/03/2024"
     * Relative dates: "today" -> ${today}, "yesterday" -> previous day from ${today}, "last week" -> approximately 7 days before ${today}
     * Month mentions: "March 15th", "15th March", "March 15" - if year not mentioned, use ${currentYear} if month/day is recent, otherwise use ${currentYear - 1} if it's a past month
     * Year mentions: "2024-03-15", "03/15/24", "03/15/2024"
   - YEAR INFERENCE RULES (CRITICAL):
     * If year is explicitly mentioned, use that year
     * If year is NOT mentioned:
       - If the month/day combination is in the future relative to today (${today}), assume it's from LAST YEAR (${currentYear - 1})
       - If the month/day combination is in the past relative to today (${today}), assume it's from THIS YEAR (${currentYear})
       - For example: If today is ${today} and text says "March 15" (which is in the past), use "${currentYear}-03-15"
       - For example: If today is ${today} and text says "December 25" (which may be in the future), use "${currentYear - 1}-12-25" if December 25 hasn't occurred yet this year
     * For relative dates like "last week", "3 days ago", calculate from ${today}
   - If no date is mentioned at all, use "${today}" as fallback (assume it's today's purchase)
   - Pay attention to temporal words like "on", "at", "during", "bought on", "purchased on", "yesterday", "today", "last week", "a few days ago"
   - REMEMBER: Most receipts are from recent purchases, so prefer dates closer to ${today} when ambiguous

3. Total amount (totalAmount) - number, REQUIRED, must be positive
   - Extract the total amount paid
   - Look for patterns: "total", "paid", "amount", "$X", "X dollars", currency symbols
   - Extract the final total, not subtotals
   - Must be a positive number

4. Currency (currency) - string, default to "USD" if not mentioned
   - Extract currency from text: USD, CNY, EUR, GBP, JPY, etc.
   - Look for currency symbols: $ (USD), ¥ (CNY/JPY), € (EUR), £ (GBP)
   - Default to "USD" only if no currency information is present

5. Tax amount (tax) - number, default to 0 if not mentioned
   - Extract tax amount if explicitly mentioned
   - Look for: "tax", "VAT", "GST", "sales tax", "tax amount"
   - Default to 0 if not mentioned

6. Payment account (paymentAccountName) - string, HIGHLY IMPORTANT - extract ALL available payment details
   - Extract COMPLETE payment information when mentioned:
     * Card type: "Credit Card", "Debit Card", "Visa", "Mastercard", "Amex", "Discover"
     * Card number suffix: last 4 digits (e.g., "****1234", "*1234", "ending in 1234", "last 4: 1234")
     * Full account identifier: "Credit Card ****1234", "Visa *5678", "Debit Card ending 9012"
   - Other payment methods: "Cash", "PayPal", "Venmo", "Apple Pay", "Google Pay", "Bank Transfer", "Check"
   - Include ALL identifying information to help distinguish different payment methods
   - Format: Combine all payment details (e.g., "Credit Card ****1234", "Visa *5678", "Cash")
   - If payment method is mentioned but incomplete, still include what is available
   - If no payment information is mentioned, omit this field (do not include)

7. Items (items) - array, REQUIRED, must contain at least one item
   - Extract ALL items mentioned in the text
   - Each item must have:
     * name: string, complete item name or description
     * categoryName: string, MUST be one from this list: [${categoryList}]
     * purpose: string, MUST be one from this list: [${purposeList}]. Choose "Home" for personal/family use, "Business" for work/business expenses, "Gifts" for gifts given to others
     * price: number, unit price of the item (can be negative for refunds)
   - Look for item patterns:
     * Lists: "Items: Coffee $5.50, Sandwich $20.00"
     * Descriptions: "bought coffee for $5.50", "a sandwich costing $20"
     * Multiple mentions: extract each unique item
   - If item prices are not explicitly mentioned, try to infer from context or distribute total amount
   - If only a total is mentioned without item details, create a single item:
     * name: "General Purchase" or infer from store/context (e.g., "Coffee Purchase" for Starbucks)
     * categoryName: select the most appropriate category from [${categoryList}] based on store name or context
     * price: total amount minus tax (if tax mentioned)

8. Data consistency (dataConsistency) - object, required:
   - itemsSum: number, sum of all item prices (calculate: sum of all items.price)
   - itemsSumMatchesTotal: boolean, true if itemsSum + tax equals totalAmount (within 0.01 tolerance)
   - missingItems: boolean, true if there might be items not captured in the list (e.g., if text says "and more" or only mentions total)
   - consistencyComment: string, brief comment on data consistency

9. Confidence (confidence) - number, 0.0-1.0, overall recognition confidence score
   - Consider: completeness of extracted information, clarity of input text, whether all items are captured

CRITICAL EXTRACTION RULES:
- Extract information COMPLETELY - do not omit any mentioned details
- For dates: Parse all date formats carefully and extract the actual purchase date
- For store names: Extract the complete business name, don't abbreviate unnecessarily
- For payment accounts: Include ALL identifying information (card type, last 4 digits, payment method)
- For items: Extract ALL mentioned items, don't skip any
- If the text is ambiguous, make reasonable inferences but note in confidence score
- Prices can be negative for refunds or returns
- All dates must be in YYYY-MM-DD format
- Category names must exactly match one from the list: [${categoryList}]

User input text:
"${text}"

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks, no explanations, no extra text. The JSON must be parseable and complete.

Example JSON format:
{
  "storeName": "Store Name",
  "date": "${today}",
  "totalAmount": 123.45,
  "currency": "USD",
  "paymentAccountName": "Credit Card ****1234",
  "tax": 5.67,
  "items": [
    {
      "name": "Item Name",
      "categoryName": "Food",
      "purpose": "Home",
      "price": 12.99
    }
  ],
  "dataConsistency": {
    "itemsSum": 123.45,
    "itemsSumMatchesTotal": true,
    "missingItems": false,
    "consistencyComment": "Items sum matches total"
  },
  "confidence": 0.92
}`;

  try {
    // 首先尝试从 API 获取可用模型
    let availableModel: string | null = null;
    try {
      availableModel = await getAvailableImageModel();
      if (availableModel) {
        console.log('✅ Found available model via API:', availableModel);
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch available models from API:', error);
    }

    // 尝试使用模型（优先使用从 API 获取的模型）
    const modelsToTry = availableModel 
      ? [availableModel, ...POSSIBLE_MODELS]
      : POSSIBLE_MODELS;

    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = currentGenAI.getGenerativeModel({ model: modelName });

        // 使用文本提示
        const result = await model.generateContent(prompt);

        const response = await result.response;
        const textResponse = response.text();
        console.log('Gemini response:', textResponse);

        // 解析JSON响应
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const parsedResult: any = JSON.parse(jsonMatch[0]);

        // 如果商家名称为空或为"Unknown Store"，且有商品项，使用第一个商品名称作为商家名称
        if ((!parsedResult.storeName || parsedResult.storeName === 'Unknown Store') && parsedResult.items && Array.isArray(parsedResult.items) && parsedResult.items.length > 0) {
          const firstItem = parsedResult.items[0];
          if (firstItem && firstItem.name) {
            console.log('Store name not found, using first item name as store name:', firstItem.name);
            parsedResult.storeName = firstItem.name;
          }
        }

        // 验证必需字段
        if (!parsedResult.storeName || !parsedResult.date || parsedResult.totalAmount === undefined) {
          console.error('Missing required fields:', {
            storeName: !!parsedResult.storeName,
            date: !!parsedResult.date,
            totalAmount: parsedResult.totalAmount !== undefined,
          });
          throw new Error('Missing required fields: storeName, date, or totalAmount');
        }

        // 确保 items 是数组且不为空
        if (!parsedResult.items) {
          console.warn('No items field in response, creating default item from total amount');
          // 如果没有items，创建一个默认item
          parsedResult.items = [{
            name: 'General Purchase',
            categoryName: categoryNames[0] || 'Shopping',
            purpose: 'Home',
            price: parsedResult.totalAmount - (parsedResult.tax || 0),
          }];
        } else if (!Array.isArray(parsedResult.items)) {
          console.warn('Items field is not an array, converting to array');
          parsedResult.items = [];
        } else if (parsedResult.items.length === 0) {
          console.warn('Items array is empty, creating default item from total amount');
          // 如果items为空，创建一个默认item
          parsedResult.items = [{
            name: 'General Purchase',
            categoryName: categoryNames[0] || 'Shopping',
            price: parsedResult.totalAmount - (parsedResult.tax || 0),
          }];
        }
        
        // 验证每个item的必要字段，并确保有 purpose
        parsedResult.items = parsedResult.items.map((item: any) => {
          // 如果缺少 purpose，默认使用 "Home"
          if (!item.purpose) {
            item.purpose = 'Home';
          }
          return item;
        }).filter((item: any) => {
          if (!item.name || item.price === undefined || !item.categoryName) {
            console.warn('Invalid item found, skipping:', item);
            return false;
          }
          return true;
        });
        
        // 如果过滤后items为空，创建默认item
        if (parsedResult.items.length === 0) {
          console.warn('All items were invalid, creating default item');
          parsedResult.items = [{
            name: 'General Purchase',
            categoryName: categoryNames[0] || 'Shopping',
            purpose: 'Home',
            price: parsedResult.totalAmount - (parsedResult.tax || 0),
          }];
        }
        
        console.log('Parsed result items count:', parsedResult.items.length);
        console.log('Parsed result:', {
          storeName: parsedResult.storeName,
          date: parsedResult.date,
          totalAmount: parsedResult.totalAmount,
          itemsCount: parsedResult.items.length,
        });

        // 确保 dataConsistency 存在
        if (!parsedResult.dataConsistency) {
          parsedResult.dataConsistency = {};
        }
        
        // 计算itemsSum如果未提供
        if (parsedResult.items && parsedResult.items.length > 0) {
          if (parsedResult.dataConsistency.itemsSum === undefined) {
            parsedResult.dataConsistency.itemsSum = parsedResult.items.reduce(
              (sum: number, item: any) => sum + (Number(item.price) || 0),
              0
            );
          }
          if (parsedResult.dataConsistency.itemsSumMatchesTotal === undefined) {
            const itemsSum = parsedResult.dataConsistency.itemsSum;
            const total = Number(parsedResult.totalAmount) || 0;
            const tax = Number(parsedResult.tax) || 0;
            parsedResult.dataConsistency.itemsSumMatchesTotal = Math.abs(itemsSum + tax - total) < 0.01;
          }
        } else {
          // 如果没有items，设置默认值
          parsedResult.dataConsistency.itemsSum = 0;
          parsedResult.dataConsistency.itemsSumMatchesTotal = false;
        }
        
        // 确保 confidence 存在
        if (parsedResult.confidence === undefined) {
          parsedResult.confidence = 0.8; // 默认置信度
        }

        // 确保 currency 存在，使用默认币种
        if (!parsedResult.currency) {
          parsedResult.currency = defaultCurrency;
        }

        console.log('Final parsed result:', {
          storeName: parsedResult.storeName,
          date: parsedResult.date,
          totalAmount: parsedResult.totalAmount,
          currency: parsedResult.currency,
          itemsCount: parsedResult.items.length,
          items: parsedResult.items.map((item: any) => ({ name: item.name, price: item.price })),
        });

        return parsedResult as GeminiReceiptResult;
      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError || new Error('All models failed');
  } catch (error) {
    console.error('Error recognizing receipt from text:', error);
    throw error;
  }
}

// 从音频识别小票内容
export async function recognizeReceiptFromAudio(audioUri: string): Promise<GeminiReceiptResult> {
  // 重新获取 API Key（确保使用最新的值）
  const currentApiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  
  if (!currentApiKey || currentApiKey === '' || currentApiKey === 'placeholder-key') {
    const error = new Error('Gemini API Key 未配置。请在 EAS Secrets 中设置 EXPO_PUBLIC_GEMINI_API_KEY。') as any;
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }
  
  const currentGenAI = new GoogleGenerativeAI(currentApiKey);
  
  console.log('Starting receipt recognition with audio...');
  console.log('Audio URI:', audioUri);

  // 获取用户的分类列表
  let categoryNames: string[] = [];
  try {
    const categories = await getCategories();
    categoryNames = categories.map(cat => cat.name);
  } catch (error) {
    console.warn('Failed to fetch categories, using default list:', error);
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  if (categoryNames.length === 0) {
    categoryNames = ['Food', 'Dining Out', 'Home', 'Transportation', 'Shopping', 'Medical', 'Education'];
  }

  // 获取用户的用途列表
  let purposeNames: string[] = [];
  try {
    const purposes = await getPurposes();
    purposeNames = purposes.map(p => p.name);
  } catch (error) {
    console.warn('Failed to fetch purposes, using default list:', error);
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  if (purposeNames.length === 0) {
    purposeNames = ['Home', 'Gifts', 'Business'];
  }

  // 获取用户历史小票中最频繁的币种，作为默认币种
  let defaultCurrency = 'USD'; // 音频识别的默认值
  try {
    const mostFrequentCurrency = await getMostFrequentCurrency();
    if (mostFrequentCurrency) {
      defaultCurrency = mostFrequentCurrency;
      console.log('Using most frequent currency as default:', defaultCurrency);
    } else {
      console.log('No currency history found, using default:', defaultCurrency);
    }
  } catch (error) {
    console.warn('Failed to fetch most frequent currency, using default:', error);
  }

  const categoryList = categoryNames.join(', ');
  const purposeList = purposeNames.join(', ');

  const prompt = `You are a financial expert. Please analyze the receipt information from this audio recording and extract:
1. Store name (storeName)
2. Date (date, format: YYYY-MM-DD, use today's date if not mentioned)
3. Total amount (totalAmount, numeric type)
4. Currency (currency, such as: CNY, USD, etc., default to ${defaultCurrency} if not mentioned)
5. Payment account (paymentAccountName, if available, MUST include key distinguishing information such as:
   - Card number suffix (last 4 digits, e.g., ****1234, *1234, Last 4: 1234)
   - Account type (Credit Card, Debit Card, Cash, etc.)
   - Any other identifying information that helps distinguish different payment methods)
6. Tax amount (tax, numeric type, 0 if not available)
7. Detailed item list (items), each item contains:
   - Name (name)
   - Category (categoryName): Automatically select one from [${categoryList}] based on item content
   - Purpose (purpose): Select one from [${purposeList}]. DEFAULT to "Home" unless there is clear evidence indicating otherwise (e.g., explicit business expense mention, gift purchase indication). Most receipts are personal/family use, so use "Home" as the default.
   - Unit price (price, numeric type, can be negative for refunds)
8. Data consistency check (dataConsistency):
   - itemsSum: Sum of all item prices (calculate: sum of all items.price)
   - itemsSumMatchesTotal: Boolean indicating if itemsSum + tax (if any) equals totalAmount (within 0.01 tolerance)
   - missingItems: Boolean indicating if there might be items not captured in the list
   - consistencyComment: Brief comment on data consistency
9. Overall confidence (confidence): Overall recognition confidence score (0.0-1.0). Consider:
    - Whether all items are captured
    - Whether item prices sum matches the total amount
    - Lower confidence if items sum doesn't match total or if items seem incomplete

Please return strictly in JSON format without any extra text. JSON format as follows:
{
  "storeName": "Store Name",
  "date": "2024-03-13",
  "totalAmount": 123.45,
  "currency": "USD",
  "paymentAccountName": "Credit Card ****1234",
  "tax": 5.67,
  "items": [
    {
      "name": "Item Name",
      "categoryName": "Food",
      "purpose": "Home",
      "price": 12.99
    }
  ],
  "dataConsistency": {
    "itemsSum": 123.45,
    "itemsSumMatchesTotal": true,
    "missingItems": false,
    "consistencyComment": "Items sum matches total"
  },
  "confidence": 0.92
}`;

  try {
    // 读取音频文件
    // 使用 legacy API 读取音频文件（与新版本 API 兼容）
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 获取音频文件的MIME类型（假设是m4a格式，Expo录音默认格式）
    const mimeType = 'audio/m4a';

    // 首先尝试从 API 获取可用模型（支持多模态的模型通常也支持音频）
    let availableModel: string | null = null;
    try {
      availableModel = await getAvailableImageModel();
      if (availableModel) {
        console.log('✅ Found available model via API:', availableModel);
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch available models from API:', error);
    }

    // 尝试使用支持音频的模型（优先使用从 API 获取的模型）
    const modelsToTry = availableModel 
      ? [availableModel, ...POSSIBLE_MODELS]
      : POSSIBLE_MODELS;

    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const model = currentGenAI.getGenerativeModel({ model: modelName });

        // 使用音频和文本提示
        const result = await model.generateContent([
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          prompt,
        ]);

        const response = await result.response;
        const text = response.text();
        console.log('Gemini response:', text);

        // 解析JSON响应
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const parsedResult: any = JSON.parse(jsonMatch[0]);

        // 验证必需字段
        if (!parsedResult.storeName || !parsedResult.date || parsedResult.totalAmount === undefined) {
          throw new Error('Missing required fields in response');
        }

        // 确保每个 item 都有 purpose 字段
        if (parsedResult.items && Array.isArray(parsedResult.items)) {
          parsedResult.items = parsedResult.items.map((item: any) => {
            if (!item.purpose) {
              item.purpose = 'Home';
            }
            // 兼容新字段 purposeName，方便后续匹配 purposes 表
            if (!item.purposeName) {
              item.purposeName = item.purpose;
            }
            return item;
          });
        }

        // 计算itemsSum如果未提供
        if (parsedResult.items && parsedResult.items.length > 0) {
          if (parsedResult.dataConsistency?.itemsSum === undefined) {
            parsedResult.dataConsistency = parsedResult.dataConsistency || {};
            parsedResult.dataConsistency.itemsSum = parsedResult.items.reduce(
              (sum: number, item: any) => sum + (item.price || 0),
              0
            );
          }
          if (parsedResult.dataConsistency?.itemsSumMatchesTotal === undefined) {
            const itemsSum = parsedResult.dataConsistency.itemsSum;
            const total = parsedResult.totalAmount || 0;
            const tax = parsedResult.tax || 0;
            parsedResult.dataConsistency.itemsSumMatchesTotal = Math.abs(itemsSum + tax - total) < 0.01;
          }
        }

        // 确保 currency 存在，使用默认币种
        if (!parsedResult.currency) {
          parsedResult.currency = defaultCurrency;
        }

        return parsedResult as GeminiReceiptResult;
      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError || new Error('All models failed');
  } catch (error) {
    console.error('Error recognizing receipt from audio:', error);
    throw error;
  }
}
