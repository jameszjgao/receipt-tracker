import { supabase } from './supabase';
import { Supplier } from '@/types';
import { getCurrentUser } from './auth';

// 获取当前空间的所有供应商
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('space_id', spaceId)
      .order('is_ai_recognized', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      name: row.name,
      taxNumber: row.tax_number,
      phone: row.phone,
      address: row.address,
      isAiRecognized: row.is_ai_recognized,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }
}

// 创建供应商
export async function createSupplier(
  name: string,
  isAiRecognized: boolean = false,
  taxNumber?: string,
  phone?: string,
  address?: string
): Promise<Supplier> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        space_id: spaceId,
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
      spaceId: data.space_id,
      name: data.name,
      taxNumber: data.tax_number,
      phone: data.phone,
      address: data.address,
      isAiRecognized: data.is_ai_recognized,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating supplier:', error);
    throw error;
  }
}

// 更新供应商
export async function updateSupplier(
  supplierId: string,
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

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', supplierId)
      .eq('space_id', spaceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating supplier:', error);
    throw error;
  }
}

// 删除供应商
export async function deleteSupplier(supplierId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .eq('space_id', spaceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting supplier:', error);
    throw error;
  }
}

// 标准化供应商名称（用于匹配）
function normalizeSupplierName(name: string): string {
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

// 检查供应商名称是否有效（排除处理状态等无效名称）
function isValidSupplierName(name: string): boolean {
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

// 根据名称查找或创建供应商（用于AI识别）
export async function findOrCreateSupplier(
  name: string,
  isAiRecognized: boolean = true,
  taxNumber?: string,
  phone?: string,
  address?: string
): Promise<Supplier> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const trimmedName = name.trim();
    if (!trimmedName || !isValidSupplierName(trimmedName)) {
      throw new Error('Invalid supplier name: Supplier name cannot be empty or a processing status');
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 获取所有供应商
    const { data: allSuppliers, error: fetchError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('space_id', spaceId);

    if (fetchError) throw fetchError;

    // 如果没有现有商家，直接创建
    if (!allSuppliers || allSuppliers.length === 0) {
      return await createSupplier(trimmedName, isAiRecognized, taxNumber, phone, address);
    }

    const normalizedName = normalizeSupplierName(trimmedName);

    // 0. 优先检查合并历史记录（用户手动合并的商家应自动归并）
    const mergeHistory = await getMergeHistory();
    const mergedTargetId = mergeHistory.get(normalizedName);
    if (mergedTargetId) {
      const mergedSupplier = allSuppliers.find(supplier => supplier.id === mergedTargetId);
      if (mergedSupplier) {
        console.log(`Found merged supplier in history: "${trimmedName}" -> "${mergedSupplier.name}"`);
        // 如果新识别的信息更完整，更新商家信息
        const shouldUpdate =
          (taxNumber && !mergedSupplier.tax_number) ||
          (phone && !mergedSupplier.phone) ||
          (address && !mergedSupplier.address);
        
        if (shouldUpdate) {
          await updateSupplier(mergedSupplier.id, {
            taxNumber: taxNumber || mergedSupplier.tax_number,
            phone: phone || mergedSupplier.phone,
            address: address || mergedSupplier.address,
          });
          // 重新获取更新后的商家信息
          const { data: updatedSupplier } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', mergedSupplier.id)
            .single();
          if (updatedSupplier) {
            return {
              id: updatedSupplier.id,
              spaceId: updatedSupplier.space_id,
              name: updatedSupplier.name,
              taxNumber: updatedSupplier.tax_number,
              phone: updatedSupplier.phone,
              address: updatedSupplier.address,
              isAiRecognized: updatedSupplier.is_ai_recognized,
              createdAt: updatedSupplier.created_at,
              updatedAt: updatedSupplier.updated_at,
            };
          }
        }
        
        return {
          id: mergedSupplier.id,
          spaceId: mergedSupplier.space_id,
          name: mergedSupplier.name,
          taxNumber: mergedSupplier.tax_number,
          phone: mergedSupplier.phone,
          address: mergedSupplier.address,
          isAiRecognized: mergedSupplier.is_ai_recognized,
          createdAt: mergedSupplier.created_at,
          updatedAt: mergedSupplier.updated_at,
        };
      }
    }

    // 1. 精确匹配（完全相同的名称，忽略大小写和空格）
    const exactMatch = allSuppliers.find(supplier => 
      normalizeSupplierName(supplier.name) === normalizedName
    );

    if (exactMatch) {
      // 如果新识别的信息更完整，更新商家信息
      const shouldUpdate =
        (taxNumber && !exactMatch.tax_number) ||
        (phone && !exactMatch.phone) ||
        (address && !exactMatch.address);
      
      if (shouldUpdate) {
        await updateSupplier(exactMatch.id, {
          taxNumber: taxNumber || exactMatch.tax_number,
          phone: phone || exactMatch.phone,
          address: address || exactMatch.address,
        });
        // 重新获取更新后的商家信息
        const { data: updatedSupplier } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', exactMatch.id)
          .single();
        if (updatedSupplier) {
          return {
            id: updatedSupplier.id,
            spaceId: updatedSupplier.space_id,
            name: updatedSupplier.name,
            taxNumber: updatedSupplier.tax_number,
            phone: updatedSupplier.phone,
            address: updatedSupplier.address,
            isAiRecognized: updatedSupplier.is_ai_recognized,
            createdAt: updatedSupplier.created_at,
            updatedAt: updatedSupplier.updated_at,
          };
        }
      }
      
      return {
        id: exactMatch.id,
        spaceId: exactMatch.space_id,
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
      const taxNumberMatch = allSuppliers.find(supplier => 
        supplier.tax_number && supplier.tax_number.trim() === taxNumber.trim()
      );
      if (taxNumberMatch) {
        console.log(`Found supplier by tax number: "${trimmedName}" -> "${taxNumberMatch.name}"`);
        // 更新商家名称（如果新名称更完整）
        if (trimmedName.length > taxNumberMatch.name.length) {
          await updateSupplier(taxNumberMatch.id, { name: trimmedName });
        }
        // 更新其他信息（如果新信息更完整）
        const shouldUpdate =
          (phone && !taxNumberMatch.phone) ||
          (address && !taxNumberMatch.address);
        if (shouldUpdate) {
          await updateSupplier(taxNumberMatch.id, {
            phone: phone || taxNumberMatch.phone,
            address: address || taxNumberMatch.address,
          });
        }
        // 重新获取更新后的商家信息
        const { data: updatedSupplier } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', taxNumberMatch.id)
          .single();
        if (updatedSupplier) {
          return {
            id: updatedSupplier.id,
            spaceId: updatedSupplier.space_id,
            name: updatedSupplier.name,
            taxNumber: updatedSupplier.tax_number,
            phone: updatedSupplier.phone,
            address: updatedSupplier.address,
            isAiRecognized: updatedSupplier.is_ai_recognized,
            createdAt: updatedSupplier.created_at,
            updatedAt: updatedSupplier.updated_at,
          };
        }
      }
    }

    // 3. 不进行模糊匹配，优先创建新商家
    // 只有精确匹配、合并历史匹配或税号匹配时才关联已有商家
    // 这样可以确保从小票识别出的商家名称被优先使用，而不是强制匹配到已有商家
    
    // 创建新的供应商（使用小票上识别出的完整名称和信息）
    console.log(`Creating new supplier from receipt: "${trimmedName}"`);
    return await createSupplier(trimmedName, isAiRecognized, taxNumber, phone, address);
  } catch (error) {
    console.error('Error finding or creating supplier:', error);
    throw error;
  }
}

// 合并供应商（将源供应商的所有小票合并到目标供应商，然后删除源供应商）
// 支持合并多个供应商到一个目标供应商
export async function mergeSupplier(
  sourceSupplierIds: string[],
  targetSupplierId: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (sourceSupplierIds.length === 0) {
      throw new Error('No source suppliers to merge');
    }

    if (sourceSupplierIds.includes(targetSupplierId)) {
      throw new Error('Cannot merge supplier to itself');
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 验证所有供应商都属于当前空间
    const allSupplierIds = [...sourceSupplierIds, targetSupplierId];
    const { data: allSuppliers, error: fetchError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('space_id', spaceId)
      .in('id', allSupplierIds);

    if (fetchError) throw fetchError;
    if (!allSuppliers || allSuppliers.length !== allSupplierIds.length) {
      throw new Error('Supplier does not exist or does not belong to current space');
    }

    const targetSupplier = allSuppliers.find(supplier => supplier.id === targetSupplierId);
    if (!targetSupplier) {
      throw new Error('Target supplier does not exist');
    }

    // 对每个源供应商执行合并操作
    for (const sourceSupplierId of sourceSupplierIds) {
      const sourceSupplier = allSuppliers.find(supplier => supplier.id === sourceSupplierId);
      if (!sourceSupplier) continue;

      // 更新所有使用源供应商的小票，将它们指向目标供应商
      const { error: updateError } = await supabase
        .from('receipts')
        .update({ supplier_id: targetSupplierId })
        .eq('supplier_id', sourceSupplierId)
        .eq('space_id', spaceId);

      if (updateError) throw updateError;

      // 如果目标供应商缺少某些信息，尝试从源供应商补充
      const updates: any = {};
      if (!targetSupplier.tax_number && sourceSupplier.tax_number) {
        updates.taxNumber = sourceSupplier.tax_number;
      }
      if (!targetSupplier.phone && sourceSupplier.phone) {
        updates.phone = sourceSupplier.phone;
      }
      if (!targetSupplier.address && sourceSupplier.address) {
        updates.address = sourceSupplier.address;
      }
      if (Object.keys(updates).length > 0) {
        await updateSupplier(targetSupplierId, updates);
      }

      // 记录合并历史（保存源供应商的原始名称）
      const { error: historyError } = await supabase
        .from('supplier_merge_history')
        .insert({
          space_id: spaceId,
          source_supplier_name: sourceSupplier.name,
          target_supplier_id: targetSupplierId,
        });

      if (historyError) {
        console.warn('Failed to record merge history:', historyError);
        // 不阻止合并操作，只记录警告
      }

      // 删除源供应商
      const { error: deleteError } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', sourceSupplierId)
        .eq('space_id', spaceId);

      if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error('Error merging supplier:', error);
    throw error;
  }
}

// 获取合并历史记录（用于查找应该自动归并的供应商）
async function getMergeHistory(): Promise<Map<string, string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return new Map();

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) return new Map();

    // 获取合并历史记录
    const { data: historyData, error: historyError } = await supabase
      .from('supplier_merge_history')
      .select('source_supplier_name, target_supplier_id')
      .eq('space_id', spaceId);

    if (historyError) {
      // 如果表不存在，返回空 Map（兼容性处理）
      if (historyError.code === '42P01' || historyError.message?.includes('does not exist')) {
        console.log('Supplier merge history table does not exist yet');
        return new Map();
      }
      console.warn('Failed to fetch merge history:', historyError);
      return new Map();
    }

    if (!historyData || historyData.length === 0) {
      return new Map();
    }

    // 获取所有有效的目标供应商 ID
    const targetSupplierIds = [...new Set(historyData.map(r => r.target_supplier_id))];
    const { data: validSuppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('space_id', spaceId)
      .in('id', targetSupplierIds);

    if (suppliersError) {
      console.warn('Failed to validate target suppliers:', suppliersError);
      return new Map();
    }

    const validSupplierIds = new Set(validSuppliers?.map(supplier => supplier.id) || []);

    // 只返回目标供应商仍然存在的合并历史记录
    const historyMap = new Map<string, string>();
    for (const record of historyData) {
      if (validSupplierIds.has(record.target_supplier_id)) {
        // 使用标准化名称作为 key，以便匹配时忽略大小写和空格
        const normalizedName = normalizeSupplierName(record.source_supplier_name);
        historyMap.set(normalizedName, record.target_supplier_id);
      }
    }

    return historyMap;
  } catch (error) {
    console.warn('Error getting merge history:', error);
    return new Map();
  }
}
