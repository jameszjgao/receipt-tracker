// 辅助函数：列出所有可用的 Gemini 模型
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

/**
 * 严格获取 API Key
 * 排除 EAS 可能注入的 "${EXPO_PUBLIC_...}" 这种无效字符串
 */
const getSafeApiKey = (): string => {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 
              Constants.expoConfig?.extra?.geminiApiKey || 
              '';
  
  // 核心修复：如果 Key 包含 ${ 符号，说明是 EAS 占位符注入失败，视为空
  if (key.includes('${') || key === 'undefined' || !key) {
    return '';
  }
  return key;
};

const apiKey = getSafeApiKey();

/**
 * 校验 Key 是否存在
 * 如果是在打包后的 APK (非 __DEV__) 中发现 Key 缺失，直接弹窗告知用户原因
 */
if (!apiKey) {
  const errorMsg = "Gemini API Key 未配置或注入失败（检测到占位符）";
  console.error(errorMsg);
  if (!__DEV__) {
    // 只有在非开发环境下才弹窗，方便 APK 调试
    // alert(errorMsg); 
  }
}

// 列出所有可用模型
export async function listAvailableModels() {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    // 增加超时控制，防止网络环境差导致应用卡死
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google API Error: ${response.status} - ${errorData?.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error: any) {
    console.error('Error listing models:', error);
    // 针对网络连接失败（通常是没挂代理）给出明确提示
    if (error.message === 'Aborted' || error.message.includes('Network request failed')) {
      throw new Error("NETWORK_ERROR_OR_PROXY_REQUIRED");
    }
    throw error;
  }
}

// 获取支持图像输入的第一个可用模型
export async function getAvailableImageModel(): Promise<string | null> {
  // 兜底模型：如果动态获取失败，至少尝试使用这个公认的模型
  const FALLBACK_MODEL = 'gemini-1.5-flash';

  try {
    if (!apiKey) return null;

    const models = await listAvailableModels();
    
    // 查找支持 generateContent 的模型
    const supportedModels = models.filter((m: any) => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    // 优先级排序
    const preferredModels = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro-vision',
    ];
    
    for (const preferred of preferredModels) {
      const found = supportedModels.find((m: any) => 
        m.name.includes(preferred) || m.name === `models/${preferred}`
      );
      if (found) {
        return found.name.replace(/^models\//, '');
      }
    }
    
    if (supportedModels.length > 0) {
      return supportedModels[0].name.replace(/^models\//, '');
    }
    
    return FALLBACK_MODEL;
  } catch (error: any) {
    console.warn('无法动态获取模型列表，使用默认模型:', error.message);
    // 如果是因为网络原因获取列表失败，返回默认模型尝试直接通信
    return FALLBACK_MODEL;
  }
}