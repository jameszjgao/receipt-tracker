import { supabase } from './supabase';
import { PaymentAccount } from '@/types';
import { getCurrentUser } from './auth';

// 获取当前家庭的所有支付账户
export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

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
    if (!user) throw new Error('Not logged in');

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
    if (!user) throw new Error('Not logged in');

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
    if (!user) throw new Error('Not logged in');

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

// 提取卡号尾号（用于匹配）
function extractCardSuffix(name: string): string | null {
  // 匹配常见的卡号格式：****1234, *1234, 尾号1234, Last 4: 1234等
  const patterns = [
    /\*{2,}(\d{4,})/,                    // ****1234, ***1234
    /\*(\d{4,})/,                        // *1234
    /尾号[：:\s]*(\d{4,})/i,              // 尾号1234, 尾号:1234
    /(?:last\s*4|last\s*four)[：:\s]*(\d{4,})/i,  // Last 4: 1234, Last four 1234
    /(?:ending\s*in|ends\s*in)[：:\s]*(\d{4,})/i, // Ending in 1234
    /#\s*(\d{4,})/,                      // #1234
    /\b(\d{4,})\s*(?:尾号|ending|last)/i, // 1234尾号, 1234 ending
    /(\d{4,})$/,                         // 末尾的4位以上数字（最后匹配，避免误匹配）
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// 标准化支付账户名称（用于匹配）
function normalizeAccountName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')  // 多个空格合并为一个
    .replace(/[：:]/g, ':') // 统一冒号
    .replace(/\*+/g, '*'); // 多个*合并为一个
}

// 根据名称查找或创建支付账户（用于AI识别）
export async function findOrCreatePaymentAccount(name: string, isAiRecognized: boolean = true): Promise<PaymentAccount> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Payment account name cannot be empty');
    }

    // 获取所有支付账户
    const { data: allAccounts, error: fetchError } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('household_id', user.householdId);

    if (fetchError) throw fetchError;

    // 如果没有现有账户，直接创建
    if (!allAccounts || allAccounts.length === 0) {
      return await createPaymentAccount(trimmedName, isAiRecognized);
    }

    const normalizedName = normalizeAccountName(trimmedName);

    // 0. 优先检查合并历史记录（用户手动合并的账户应自动归并）
    const mergeHistory = await getMergeHistory();
    const mergedTargetId = mergeHistory.get(normalizedName);
    if (mergedTargetId) {
      const mergedAccount = allAccounts.find(acc => acc.id === mergedTargetId);
      if (mergedAccount) {
        console.log(`Found merged account in history: "${trimmedName}" -> "${mergedAccount.name}"`);
        return {
          id: mergedAccount.id,
          householdId: mergedAccount.household_id,
          name: mergedAccount.name,
          isAiRecognized: mergedAccount.is_ai_recognized,
          createdAt: mergedAccount.created_at,
          updatedAt: mergedAccount.updated_at,
        };
      }
    }

    // 1. 精确匹配（完全相同的名称，忽略大小写和空格）
    const exactMatch = allAccounts.find(acc => 
      normalizeAccountName(acc.name) === normalizedName
    );

    if (exactMatch) {
      return {
        id: exactMatch.id,
        householdId: exactMatch.household_id,
        name: exactMatch.name,
        isAiRecognized: exactMatch.is_ai_recognized,
        createdAt: exactMatch.created_at,
        updatedAt: exactMatch.updated_at,
      };
    }

    // 2. 优先通过卡号尾号匹配（关键区分信息）
    const cardSuffix = extractCardSuffix(trimmedName);
    if (cardSuffix) {
      for (const account of allAccounts) {
        const accountSuffix = extractCardSuffix(account.name);
        if (accountSuffix && accountSuffix === cardSuffix) {
          // 找到匹配的账户（通过关键区分信息：卡号尾号）
          return {
            id: account.id,
            householdId: account.household_id,
            name: account.name,
            isAiRecognized: account.is_ai_recognized,
            createdAt: account.created_at,
            updatedAt: account.updated_at,
          };
        }
      }
    }

    // 3. 尝试模糊匹配（包含关系）- 作为最后的匹配尝试
      const fuzzyMatch = allAccounts.find(acc => {
        const accNormalized = normalizeAccountName(acc.name);
      // 检查是否包含关键信息（账户类型等）
        return accNormalized.includes(normalizedName) || 
               normalizedName.includes(accNormalized);
      });

      if (fuzzyMatch) {
        return {
          id: fuzzyMatch.id,
          householdId: fuzzyMatch.household_id,
          name: fuzzyMatch.name,
          isAiRecognized: fuzzyMatch.is_ai_recognized,
          createdAt: fuzzyMatch.created_at,
          updatedAt: fuzzyMatch.updated_at,
        };
    }

    // 4. 都不匹配，创建新的支付账户（包含关键区分信息）
    return await createPaymentAccount(trimmedName, isAiRecognized);
  } catch (error) {
    console.error('Error finding or creating payment account:', error);
    throw error;
  }
}

// 合并支付账户（将源支付账户的所有小票合并到目标支付账户，然后删除源支付账户）
// 支持合并多个账户到一个目标账户
export async function mergePaymentAccount(
  sourceAccountIds: string[],
  targetAccountId: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (sourceAccountIds.length === 0) {
      throw new Error('No source accounts to merge');
    }

    if (sourceAccountIds.includes(targetAccountId)) {
      throw new Error('Cannot merge payment account to itself');
    }

    // 验证所有支付账户都属于当前家庭
    const allAccountIds = [...sourceAccountIds, targetAccountId];
    const { data: accounts, error: fetchError } = await supabase
      .from('payment_accounts')
      .select('*')
      .eq('household_id', user.householdId)
      .in('id', allAccountIds);

    if (fetchError) throw fetchError;
    if (!accounts || accounts.length !== allAccountIds.length) {
      throw new Error('Payment account does not exist or does not belong to current household');
    }

    const targetAccount = accounts.find(acc => acc.id === targetAccountId);
    if (!targetAccount) {
      throw new Error('Target payment account does not exist');
    }

    // 对每个源账户执行合并操作
    for (const sourceAccountId of sourceAccountIds) {
      const sourceAccount = accounts.find(acc => acc.id === sourceAccountId);
      if (!sourceAccount) continue;

    // 更新所有使用源支付账户的小票，将它们指向目标支付账户
    const { error: updateError } = await supabase
      .from('receipts')
      .update({ payment_account_id: targetAccountId })
      .eq('payment_account_id', sourceAccountId)
      .eq('household_id', user.householdId);

    if (updateError) throw updateError;

      // 记录合并历史（保存源账户的原始名称）
      const { error: historyError } = await supabase
        .from('payment_account_merge_history')
        .insert({
          household_id: user.householdId,
          source_account_name: sourceAccount.name,
          target_account_id: targetAccountId,
        });

      if (historyError) {
        console.warn('Failed to record merge history:', historyError);
        // 不阻止合并操作，只记录警告
      }

    // 删除源支付账户
    const { error: deleteError } = await supabase
      .from('payment_accounts')
      .delete()
      .eq('id', sourceAccountId)
      .eq('household_id', user.householdId);

    if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error('Error merging payment account:', error);
    throw error;
  }
}

// 获取合并历史记录（用于查找应该自动归并的账户）
async function getMergeHistory(): Promise<Map<string, string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return new Map();

    // 获取合并历史记录
    const { data: historyData, error: historyError } = await supabase
      .from('payment_account_merge_history')
      .select('source_account_name, target_account_id')
      .eq('household_id', user.householdId);

    if (historyError) {
      // 如果表不存在，返回空 Map（兼容性处理）
      if (historyError.code === '42P01' || historyError.message?.includes('does not exist')) {
        console.log('Merge history table does not exist yet');
        return new Map();
      }
      console.warn('Failed to fetch merge history:', historyError);
      return new Map();
    }

    if (!historyData || historyData.length === 0) {
      return new Map();
    }

    // 获取所有有效的目标账户 ID
    const targetAccountIds = [...new Set(historyData.map(r => r.target_account_id))];
    const { data: validAccounts, error: accountsError } = await supabase
      .from('payment_accounts')
      .select('id')
      .eq('household_id', user.householdId)
      .in('id', targetAccountIds);

    if (accountsError) {
      console.warn('Failed to validate target accounts:', accountsError);
      return new Map();
    }

    const validAccountIds = new Set(validAccounts?.map(acc => acc.id) || []);

    // 只返回目标账户仍然存在的合并历史记录
    const historyMap = new Map<string, string>();
    for (const record of historyData) {
      if (validAccountIds.has(record.target_account_id)) {
        // 使用标准化名称作为 key，以便匹配时忽略大小写和空格
        const normalizedName = normalizeAccountName(record.source_account_name);
        historyMap.set(normalizedName, record.target_account_id);
      }
    }

    return historyMap;
  } catch (error) {
    console.warn('Error getting merge history:', error);
    return new Map();
  }
}

