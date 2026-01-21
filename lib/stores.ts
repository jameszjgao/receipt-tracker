import { supabase } from './supabase';
import { Store } from '@/types';
import { getCurrentUser } from './auth';

// 获取当前家庭的所有商家
export async function getStores(): Promise<Store[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('household_id', householdId)
      .order('is_ai_recognized', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      name: row.name,
      taxNumber: row.tax_number,
      phone: row.phone,
      address: row.address,
      isAiRecognized: row.is_ai_recognized,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }
}

// 创建商家
export async function createStore(
  name: string,
  isAiRecognized: boolean = false,
  taxNumber?: string,
  phone?: string,
  address?: string
): Promise<Store> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    const { data, error } = await supabase
      .from('stores')
      .insert({
        household_id: householdId,
        name: name.trim(),
        tax_number: taxNumber?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        is_ai_recognized: isAiRecognized,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      householdId: data.household_id,
      name: data.name,
      taxNumber: data.tax_number,
      phone: data.phone,
      address: data.address,
      isAiRecognized: data.is_ai_recognized,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating store:', error);
    throw error;
  }
}

// 更新商家
export async function updateStore(
  storeId: string,
  updates: {
    name?: string;
    taxNumber?: string;
    phone?: string;
    address?: string;
  }
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.taxNumber !== undefined) updateData.tax_number = updates.taxNumber?.trim() || null;
    if (updates.phone !== undefined) updateData.phone = updates.phone?.trim() || null;
    if (updates.address !== undefined) updateData.address = updates.address?.trim() || null;

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    const { error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', storeId)
      .eq('household_id', householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating store:', error);
    throw error;
  }
}

// 删除商家
export async function deleteStore(storeId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId)
      .eq('household_id', householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting store:', error);
    throw error;
  }
}

// 标准化商家名称（用于匹配）
function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // 多个空格合并为一个
    .replace(/[：:]/g, ':') // 统一冒号
    .replace(/有限公司/g, '') // 移除常见后缀
    .replace(/股份有限公司/g, '')
    .replace(/有限责任公司/g, '')
    .replace(/公司/g, '')
    .replace(/商店/g, '')
    .replace(/超市/g, '')
    .replace(/商场/g, '');
}

// 检查商家名称是否有效（排除处理状态等无效名称）
function isValidStoreName(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  // 排除处理状态、占位符等无效名称
  const invalidNames = [
    'processing',
    'processing...',
    'pending',
    'pending...',
    'loading',
    'loading...',
    '识别中',
    '处理中',
    '待处理',
    '',
  ];
  return trimmed.length > 0 && !invalidNames.includes(trimmed);
}

// 根据名称查找或创建商家（用于AI识别）
export async function findOrCreateStore(
  name: string,
  isAiRecognized: boolean = true,
  taxNumber?: string,
  phone?: string,
  address?: string
): Promise<Store> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const trimmedName = name.trim();
    if (!trimmedName || !isValidStoreName(trimmedName)) {
      throw new Error('Invalid store name: Store name cannot be empty or a processing status');
    }

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    // 获取所有商家
    const { data: allStores, error: fetchError } = await supabase
      .from('stores')
      .select('*')
      .eq('household_id', householdId);

    if (fetchError) throw fetchError;

    // 如果没有现有商家，直接创建
    if (!allStores || allStores.length === 0) {
      return await createStore(trimmedName, isAiRecognized, taxNumber, phone, address);
    }

    const normalizedName = normalizeStoreName(trimmedName);

    // 0. 优先检查合并历史记录（用户手动合并的商家应自动归并）
    const mergeHistory = await getMergeHistory();
    const mergedTargetId = mergeHistory.get(normalizedName);
    if (mergedTargetId) {
      const mergedStore = allStores.find(store => store.id === mergedTargetId);
      if (mergedStore) {
        console.log(`Found merged store in history: "${trimmedName}" -> "${mergedStore.name}"`);
        // 如果新识别的信息更完整，更新商家信息
        const shouldUpdate =
          (taxNumber && !mergedStore.tax_number) ||
          (phone && !mergedStore.phone) ||
          (address && !mergedStore.address);
        
        if (shouldUpdate) {
          await updateStore(mergedStore.id, {
            taxNumber: taxNumber || mergedStore.tax_number,
            phone: phone || mergedStore.phone,
            address: address || mergedStore.address,
          });
          // 重新获取更新后的商家信息
          const { data: updatedStore } = await supabase
            .from('stores')
            .select('*')
            .eq('id', mergedStore.id)
            .single();
          if (updatedStore) {
            return {
              id: updatedStore.id,
              householdId: updatedStore.household_id,
              name: updatedStore.name,
              taxNumber: updatedStore.tax_number,
              phone: updatedStore.phone,
              address: updatedStore.address,
              isAiRecognized: updatedStore.is_ai_recognized,
              createdAt: updatedStore.created_at,
              updatedAt: updatedStore.updated_at,
            };
          }
        }
        
        return {
          id: mergedStore.id,
          householdId: mergedStore.household_id,
          name: mergedStore.name,
          taxNumber: mergedStore.tax_number,
          phone: mergedStore.phone,
          address: mergedStore.address,
          isAiRecognized: mergedStore.is_ai_recognized,
          createdAt: mergedStore.created_at,
          updatedAt: mergedStore.updated_at,
        };
      }
    }

    // 1. 精确匹配（完全相同的名称，忽略大小写和空格）
    const exactMatch = allStores.find(store => 
      normalizeStoreName(store.name) === normalizedName
    );

    if (exactMatch) {
      // 如果新识别的信息更完整，更新商家信息
      const shouldUpdate =
        (taxNumber && !exactMatch.tax_number) ||
        (phone && !exactMatch.phone) ||
        (address && !exactMatch.address);
      
      if (shouldUpdate) {
        await updateStore(exactMatch.id, {
          taxNumber: taxNumber || exactMatch.tax_number,
          phone: phone || exactMatch.phone,
          address: address || exactMatch.address,
        });
        // 重新获取更新后的商家信息
        const { data: updatedStore } = await supabase
          .from('stores')
          .select('*')
          .eq('id', exactMatch.id)
          .single();
        if (updatedStore) {
          return {
            id: updatedStore.id,
            householdId: updatedStore.household_id,
            name: updatedStore.name,
            taxNumber: updatedStore.tax_number,
            phone: updatedStore.phone,
            address: updatedStore.address,
            isAiRecognized: updatedStore.is_ai_recognized,
            createdAt: updatedStore.created_at,
            updatedAt: updatedStore.updated_at,
          };
        }
      }
      
      return {
        id: exactMatch.id,
        householdId: exactMatch.household_id,
        name: exactMatch.name,
        taxNumber: exactMatch.tax_number,
        phone: exactMatch.phone,
        address: exactMatch.address,
        isAiRecognized: exactMatch.is_ai_recognized,
        createdAt: exactMatch.created_at,
        updatedAt: exactMatch.updated_at,
      };
    }

    // 2. 通过税号匹配（如果有税号且税号唯一）
    if (taxNumber && taxNumber.trim()) {
      const taxNumberMatch = allStores.find(store => 
        store.tax_number && store.tax_number.trim() === taxNumber.trim()
      );
      if (taxNumberMatch) {
        console.log(`Found store by tax number: "${trimmedName}" -> "${taxNumberMatch.name}"`);
        // 更新商家名称（如果新名称更完整）
        if (trimmedName.length > taxNumberMatch.name.length) {
          await updateStore(taxNumberMatch.id, { name: trimmedName });
        }
        // 更新其他信息（如果新信息更完整）
        const shouldUpdate =
          (phone && !taxNumberMatch.phone) ||
          (address && !taxNumberMatch.address);
        if (shouldUpdate) {
          await updateStore(taxNumberMatch.id, {
            phone: phone || taxNumberMatch.phone,
            address: address || taxNumberMatch.address,
          });
        }
        // 重新获取更新后的商家信息
        const { data: updatedStore } = await supabase
          .from('stores')
          .select('*')
          .eq('id', taxNumberMatch.id)
          .single();
        if (updatedStore) {
          return {
            id: updatedStore.id,
            householdId: updatedStore.household_id,
            name: updatedStore.name,
            taxNumber: updatedStore.tax_number,
            phone: updatedStore.phone,
            address: updatedStore.address,
            isAiRecognized: updatedStore.is_ai_recognized,
            createdAt: updatedStore.created_at,
            updatedAt: updatedStore.updated_at,
          };
        }
      }
    }

    // 3. 不进行模糊匹配，优先创建新商家
    // 只有精确匹配、合并历史匹配或税号匹配时才关联已有商家
    // 这样可以确保从小票识别出的商家名称被优先使用，而不是强制匹配到已有商家
    
    // 创建新的商家（使用小票上识别出的完整名称和信息）
    console.log(`Creating new store from receipt: "${trimmedName}"`);
    return await createStore(trimmedName, isAiRecognized, taxNumber, phone, address);
  } catch (error) {
    console.error('Error finding or creating store:', error);
    throw error;
  }
}

// 合并商家（将源商家的所有小票合并到目标商家，然后删除源商家）
// 支持合并多个商家到一个目标商家
export async function mergeStore(
  sourceStoreIds: string[],
  targetStoreId: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (sourceStoreIds.length === 0) {
      throw new Error('No source stores to merge');
    }

    if (sourceStoreIds.includes(targetStoreId)) {
      throw new Error('Cannot merge store to itself');
    }

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    // 验证所有商家都属于当前家庭
    const allStoreIds = [...sourceStoreIds, targetStoreId];
    const { data: stores, error: fetchError } = await supabase
      .from('stores')
      .select('*')
      .eq('household_id', householdId)
      .in('id', allStoreIds);

    if (fetchError) throw fetchError;
    if (!stores || stores.length !== allStoreIds.length) {
      throw new Error('Store does not exist or does not belong to current household');
    }

    const targetStore = stores.find(store => store.id === targetStoreId);
    if (!targetStore) {
      throw new Error('Target store does not exist');
    }

    // 对每个源商家执行合并操作
    for (const sourceStoreId of sourceStoreIds) {
      const sourceStore = stores.find(store => store.id === sourceStoreId);
      if (!sourceStore) continue;

      // 更新所有使用源商家的小票，将它们指向目标商家
      const { error: updateError } = await supabase
        .from('receipts')
        .update({ store_id: targetStoreId })
        .eq('store_id', sourceStoreId)
        .eq('household_id', householdId);

      if (updateError) throw updateError;

      // 如果目标商家缺少某些信息，尝试从源商家补充
      const updates: any = {};
      if (!targetStore.tax_number && sourceStore.tax_number) {
        updates.taxNumber = sourceStore.tax_number;
      }
      if (!targetStore.phone && sourceStore.phone) {
        updates.phone = sourceStore.phone;
      }
      if (!targetStore.address && sourceStore.address) {
        updates.address = sourceStore.address;
      }
      if (Object.keys(updates).length > 0) {
        await updateStore(targetStoreId, updates);
      }

      // 记录合并历史（保存源商家的原始名称）
      const { error: historyError } = await supabase
        .from('store_merge_history')
        .insert({
          household_id: householdId,
          source_store_name: sourceStore.name,
          target_store_id: targetStoreId,
        });

      if (historyError) {
        console.warn('Failed to record merge history:', historyError);
        // 不阻止合并操作，只记录警告
      }

      // 删除源商家
      const { error: deleteError } = await supabase
        .from('stores')
        .delete()
        .eq('id', sourceStoreId)
        .eq('household_id', householdId);

      if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error('Error merging store:', error);
    throw error;
  }
}

// 获取合并历史记录（用于查找应该自动归并的商家）
async function getMergeHistory(): Promise<Map<string, string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return new Map();

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) return new Map();

    // 获取合并历史记录
    const { data: historyData, error: historyError } = await supabase
      .from('store_merge_history')
      .select('source_store_name, target_store_id')
      .eq('household_id', householdId);

    if (historyError) {
      // 如果表不存在，返回空 Map（兼容性处理）
      if (historyError.code === '42P01' || historyError.message?.includes('does not exist')) {
        console.log('Store merge history table does not exist yet');
        return new Map();
      }
      console.warn('Failed to fetch merge history:', historyError);
      return new Map();
    }

    if (!historyData || historyData.length === 0) {
      return new Map();
    }

    // 获取所有有效的目标商家 ID
    const targetStoreIds = [...new Set(historyData.map(r => r.target_store_id))];
    const { data: validStores, error: storesError } = await supabase
      .from('stores')
      .select('id')
      .eq('household_id', householdId)
      .in('id', targetStoreIds);

    if (storesError) {
      console.warn('Failed to validate target stores:', storesError);
      return new Map();
    }

    const validStoreIds = new Set(validStores?.map(store => store.id) || []);

    // 只返回目标商家仍然存在的合并历史记录
    const historyMap = new Map<string, string>();
    for (const record of historyData) {
      if (validStoreIds.has(record.target_store_id)) {
        // 使用标准化名称作为 key，以便匹配时忽略大小写和空格
        const normalizedName = normalizeStoreName(record.source_store_name);
        historyMap.set(normalizedName, record.target_store_id);
      }
    }

    return historyMap;
  } catch (error) {
    console.warn('Error getting merge history:', error);
    return new Map();
  }
}
