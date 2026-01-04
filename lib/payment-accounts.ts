import { supabase } from './supabase';
import { PaymentAccount } from '@/types';
import { getCurrentUser } from './auth';

// 获取当前家庭的所有支付账户
export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('household_id', user.householdId)
      .order('is_ai_recognized', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      name: row.name,
      isAiRecognized: row.is_ai_recognized,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    throw error;
  }
}

// 创建支付账户
export async function createPaymentAccount(name: string, isAiRecognized: boolean = false): Promise<PaymentAccount> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const { data, error } = await supabase
      .from('payment_accounts')
      .insert({
        household_id: user.householdId,
        name: name.trim(),
        is_ai_recognized: isAiRecognized,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      householdId: data.household_id,
      name: data.name,
      isAiRecognized: data.is_ai_recognized,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating payment account:', error);
    throw error;
  }
}

// 更新支付账户
export async function updatePaymentAccount(accountId: string, updates: { name?: string }): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();

    const { error } = await supabase
      .from('payment_accounts')
      .update(updateData)
      .eq('id', accountId)
      .eq('household_id', user.householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating payment account:', error);
    throw error;
  }
}

// 删除支付账户
export async function deletePaymentAccount(accountId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const { error } = await supabase
      .from('payment_accounts')
      .delete()
      .eq('id', accountId)
      .eq('household_id', user.householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting payment account:', error);
    throw error;
  }
}

// 根据名称查找或创建支付账户（用于AI识别）
export async function findOrCreatePaymentAccount(name: string, isAiRecognized: boolean = true): Promise<PaymentAccount> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    // 先尝试查找
    const { data: existing, error: findError } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('household_id', user.householdId)
      .ilike('name', name.trim())
      .limit(1)
      .single();

    if (!findError && existing) {
      return {
        id: existing.id,
        householdId: existing.household_id,
        name: existing.name,
        isAiRecognized: existing.is_ai_recognized,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    // 不存在则创建
    return await createPaymentAccount(name, isAiRecognized);
  } catch (error) {
    console.error('Error finding or creating payment account:', error);
    throw error;
  }
}

// 合并支付账户（将源支付账户的所有小票合并到目标支付账户，然后删除源支付账户）
export async function mergePaymentAccount(sourceAccountId: string, targetAccountId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    if (sourceAccountId === targetAccountId) {
      throw new Error('不能将支付账户合并到自己');
    }

    // 验证两个支付账户都属于当前家庭
    const { data: accounts, error: fetchError } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('household_id', user.householdId)
      .in('id', [sourceAccountId, targetAccountId]);

    if (fetchError) throw fetchError;
    if (!accounts || accounts.length !== 2) {
      throw new Error('支付账户不存在或不属于当前家庭');
    }

    const sourceAccount = accounts.find(acc => acc.id === sourceAccountId);
    const targetAccount = accounts.find(acc => acc.id === targetAccountId);

    if (!sourceAccount || !targetAccount) {
      throw new Error('支付账户不存在');
    }

    // 更新所有使用源支付账户的小票，将它们指向目标支付账户
    const { error: updateError } = await supabase
      .from('receipts')
      .update({ payment_account_id: targetAccountId })
      .eq('payment_account_id', sourceAccountId)
      .eq('household_id', user.householdId);

    if (updateError) throw updateError;

    // 删除源支付账户
    const { error: deleteError } = await supabase
      .from('payment_accounts')
      .delete()
      .eq('id', sourceAccountId)
      .eq('household_id', user.householdId);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error merging payment account:', error);
    throw error;
  }
}

