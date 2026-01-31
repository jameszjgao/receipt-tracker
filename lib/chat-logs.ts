import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface ChatLog {
  id: string;
  spaceId: string;
  userId: string;
  receiptId?: string;
  type: 'image' | 'text' | 'audio';
  modelName?: string;
  prompt?: string;
  response?: string;
  requestData?: any;
  responseData?: any;
  success: boolean;
  errorMessage?: string;
  confidence?: number;
  processingTimeMs?: number;
  audioUrl?: string; // 语音录入时的录音文件 URL
  createdAt: string;
}

export interface CreateChatLogParams {
  receiptId?: string;
  type: 'image' | 'text' | 'audio';
  modelName?: string;
  prompt?: string;
  response?: string;
  requestData?: any;
  responseData?: any;
  success?: boolean;
  errorMessage?: string;
  confidence?: number;
  processingTimeMs?: number;
  audioUrl?: string; // 语音录入时的录音文件 URL
}

/**
 * 保存聊天日志到数据库
 */
export async function saveChatLog(params: CreateChatLogParams): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.warn('User not logged in, skipping chat log save');
      return;
    }

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      console.warn('User has no space ID, skipping chat log save');
      return;
    }

    const { error } = await supabase
      .from('ai_chat_logs')
      .insert({
        space_id: spaceId,
        user_id: user.id,
        receipt_id: params.receiptId || null,
        type: params.type,
        model_name: params.modelName || null,
        prompt: params.prompt || null,
        response: params.response || null,
        request_data: params.requestData || null,
        response_data: params.responseData || null,
        success: params.success !== undefined ? params.success : true,
        error_message: params.errorMessage || null,
        confidence: params.confidence || null,
        processing_time_ms: params.processingTimeMs || null,
        audio_url: params.audioUrl || null,
      });

    if (error) {
      console.error('Error saving chat log:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      // 不抛出错误，避免影响主要功能
    } else {
      console.log('✅ Chat log saved successfully');
    }
  } catch (error) {
    console.error('Exception saving chat log:', error);
    if (error instanceof Error) {
      console.error('Exception message:', error.message);
      console.error('Exception stack:', error.stack);
    }
    // 不抛出错误，避免影响主要功能
  }
}

/**
 * 获取空间的聊天日志列表
 */
export async function getChatLogs(limit: number = 100): Promise<ChatLog[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      return [];
    }

    const { data, error } = await supabase
      .from('ai_chat_logs')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat logs:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      receiptId: row.receipt_id,
      type: row.type,
      modelName: row.model_name,
      prompt: row.prompt,
      response: row.response,
      requestData: row.request_data,
      responseData: row.response_data,
      success: row.success,
      errorMessage: row.error_message,
      confidence: row.confidence,
      processingTimeMs: row.processing_time_ms,
      audioUrl: row.audio_url,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching chat logs:', error);
    return [];
  }
}

/**
 * 分页获取聊天日志：用于“向上滚动加载更多”
 * - before: 只取某个时间之前的记录（基于 created_at 游标）
 */
export async function getChatLogsPaginated(
  limit: number,
  before?: string,
): Promise<ChatLog[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      return [];
    }

    let query = supabase
      .from('ai_chat_logs')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching paginated chat logs:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      receiptId: row.receipt_id,
      type: row.type,
      modelName: row.model_name,
      prompt: row.prompt,
      response: row.response,
      requestData: row.request_data,
      responseData: row.response_data,
      success: row.success,
      errorMessage: row.error_message,
      confidence: row.confidence,
      processingTimeMs: row.processing_time_ms,
      audioUrl: row.audio_url,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching paginated chat logs:', error);
    return [];
  }
}

/**
 * 获取特定小票的聊天日志
 */
export async function getChatLogsByReceiptId(receiptId: string): Promise<ChatLog[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      return [];
    }

    const { data, error } = await supabase
      .from('ai_chat_logs')
      .select('*')
      .eq('space_id', spaceId)
      .eq('receipt_id', receiptId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat logs by receipt ID:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      userId: row.user_id,
      receiptId: row.receipt_id,
      type: row.type,
      modelName: row.model_name,
      prompt: row.prompt,
      response: row.response,
      requestData: row.request_data,
      responseData: row.response_data,
      success: row.success,
      errorMessage: row.error_message,
      confidence: row.confidence,
      processingTimeMs: row.processing_time_ms,
      audioUrl: row.audio_url,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching chat logs by receipt ID:', error);
    return [];
  }
}
