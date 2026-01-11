// 辅助函数：列出所有可用的 Gemini 模型
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

// 安全获取Gemini API Key，支持多种方式（包括EAS Secrets）
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.geminiApiKey || '';

// 强力推荐：在下方加一个简单的环境检查，打包后的 APK 如果报错，你能立刻知道是不是 Key 的问题
if (!apiKey || apiKey === 'undefined') {
  console.error("Gemini API Key is missing or invalid!");
  // 在预览版 APK 中，弹窗是最高效的调试手段
  if (__DEV__) {
    console.warn("API Key is missing in development");
  } else {
    // 这里的 alert 会在 APK 运行到这一步时跳出来
    // alert("Configuration Error: Gemini API Key not found");
  }
}

// 列出所有可用模型
export async function listAvailableModels() {
  try {
    // 注意：@google/generative-ai SDK 可能没有直接的 listModels 方法
    // 我们可以通过直接调用 REST API 来获取
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + apiKey);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error listing models:', error);
    throw error;
  }
}

// 获取支持图像输入的第一个可用模型
export async function getAvailableImageModel(): Promise<string | null> {
  try {
    const models = await listAvailableModels();
    
    console.log('Available models:', models.map((m: any) => m.name));
    
    // 查找支持 generateContent 的模型
    const supportedModels = models.filter((m: any) => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    console.log('Models supporting generateContent:', supportedModels.map((m: any) => m.name));
    
    // 优先查找支持图像的多模态模型
    const imageModels = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro-vision',
    ];
    
    for (const preferredModel of imageModels) {
      const found = supportedModels.find((m: any) => 
        m.name.includes(preferredModel) || m.name === preferredModel
      );
      if (found) {
        console.log('Found preferred image model:', found.name);
        // 移除 models/ 前缀（如果存在）
        const modelName = found.name.replace(/^models\//, '');
        return modelName;
      }
    }
    
    // 如果没找到，返回第一个支持的模型
    if (supportedModels.length > 0) {
      console.log('Using first available model:', supportedModels[0].name);
      // 移除 models/ 前缀（如果存在）
      const modelName = supportedModels[0].name.replace(/^models\//, '');
      return modelName;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting available image model:', error);
    return null;
  }
}

