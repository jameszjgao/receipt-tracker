// 辅助函数：列出所有可用的 Gemini 模型
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

const apiKey = Constants.expoConfig?.extra?.geminiApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('缺少 Gemini API Key');
}

const genAI = new GoogleGenerativeAI(apiKey);

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
        return found.name;
      }
    }
    
    // 如果没找到，返回第一个支持的模型
    if (supportedModels.length > 0) {
      console.log('Using first available model:', supportedModels[0].name);
      return supportedModels[0].name;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting available image model:', error);
    return null;
  }
}

