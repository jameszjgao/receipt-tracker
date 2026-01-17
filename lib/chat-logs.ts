import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface ChatLog {
  id: string;
  householdId: string;
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

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      console.warn('User has no household ID, skipping chat log save');
      return;
    }

    const { error } = await supabase
      .from('ai_chat_logs')
      .insert({
        household_id: householdId,
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
 * 获取家庭的聊天日志列表
 */
export async function getChatLogs(limit: number = 100): Promise<ChatLog[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      return [];
    }

    const { data, error } = await supabase
      .from('ai_chat_logs')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat logs:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
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
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching chat logs:', error);
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

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      return [];
    }

    const { data, error } = await supabase
      .from('ai_chat_logs')
      .select('*')
      .eq('household_id', householdId)
      .eq('receipt_id', receiptId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat logs by receipt ID:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
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
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching chat logs by receipt ID:', error);
    return [];
  }
}
