import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

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

// 从公共URL中提取文件路径
function extractFilePathFromUrl(url: string): string | null {
  try {
    // URL 格式通常是: https://[project].supabase.co/storage/v1/object/public/receipts/[filename]
    // 或者: https://[project].supabase.co/storage/v1/object/sign/receipts/[filename]?token=...
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf(STORAGE_BUCKET);
    if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
      // 提取 bucket 后面的所有路径部分（文件名可能包含目录结构）
      const fileName = pathParts.slice(bucketIndex + 1).join('/');
      return fileName;
    }
    return null;
  } catch (error) {
    console.error('Error extracting file path from URL:', error);
    return null;
  }
}

// 删除Supabase Storage中的文件
export async function deleteReceiptImage(imageUrl: string): Promise<void> {
  try {
    const filePath = extractFilePathFromUrl(imageUrl);
    if (!filePath) {
      console.warn('Could not extract file path from URL:', imageUrl);
      return;
    }

    console.log(`Deleting file from bucket: ${STORAGE_BUCKET}, path: ${filePath}`);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      // 不抛出错误，因为删除失败不应该影响主流程
    } else {
      console.log('File deleted successfully:', filePath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    // 不抛出错误，因为删除失败不应该影响主流程
  }
}
