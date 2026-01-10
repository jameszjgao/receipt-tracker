import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

// 安全获取环境变量，避免启动时崩溃
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// 验证环境变量是否配置
export function validateSupabaseConfig(): { valid: boolean; error?: string } {
  if (!supabaseUrl || supabaseUrl === '' || supabaseUrl.includes('placeholder')) {
    return { valid: false, error: 'Supabase URL is not configured. Please set EXPO_PUBLIC_SUPABASE_URL.' };
  }
  if (!supabaseAnonKey || supabaseAnonKey === '' || supabaseAnonKey === 'placeholder-key') {
    return { valid: false, error: 'Supabase Anon Key is not configured. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY.' };
  }
  return { valid: true };
}

// 使用安全默认值初始化客户端，避免启动时崩溃
// 实际使用时会在首次调用前验证配置
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-client-info': 'receipt-tracker@1.0.0',
      },
    },
  }
);

// Storage Bucket 名称配置
const STORAGE_BUCKET = 'receipts';

// 上传图片到Supabase Storage（临时文件名，用于识别前上传）
export async function uploadReceiptImageTemp(fileUri: string, tempFileName: string): Promise<string> {
  try {
    // 读取文件为 base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 转换为 ArrayBuffer
    const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    const fileExt = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${tempFileName}.${fileExt}`;
    // 文件路径：直接使用文件名，bucket 已在 from() 中指定
    const filePath = fileName;
    const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    console.log(`Uploading to bucket: ${STORAGE_BUCKET}, path: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // 获取公共URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    console.log('Upload successful, public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

// 上传图片到Supabase Storage（使用receiptId作为文件名）
export async function uploadReceiptImage(fileUri: string, receiptId: string): Promise<string> {
  try {
    // 读取文件为 base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 转换为 ArrayBuffer
    const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    const fileExt = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${receiptId}.${fileExt}`;
    // 文件路径：直接使用文件名，bucket 已在 from() 中指定
    const filePath = fileName;
    const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    console.log(`Uploading to bucket: ${STORAGE_BUCKET}, path: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

    // 获取公共URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    console.log('Upload successful, public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

// 获取图片URL
export function getReceiptImageUrl(filePath: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);
  return publicUrl;
}

