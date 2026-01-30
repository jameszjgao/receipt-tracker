import { supabase } from './supabase';
import { Category } from '@/types';
import { getCurrentUser } from './auth';

// 获取当前空间的所有分类
export async function getCategories(): Promise<Category[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('space_id', spaceId)
      .order('usage_count', { ascending: false, nullsFirst: false })
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      name: row.name,
      color: row.color,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

// 创建分类
export async function createCategory(name: string, color: string = '#95A5A6'): Promise<Category> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('categories')
      .insert({
        space_id: spaceId,
        name: name.trim(),
        color: color,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      spaceId: data.space_id,
      name: data.name,
      color: data.color,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
}

// 更新分类
export async function updateCategory(categoryId: string, updates: { name?: string; color?: string }): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.color !== undefined) updateData.color = updates.color;

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('space_id', spaceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

// 删除分类（不能删除默认分类）
export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 检查是否为默认分类
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('is_default')
      .eq('id', categoryId)
      .eq('space_id', spaceId)
      .single();

    if (fetchError) throw fetchError;
    if (category?.is_default) {
      throw new Error('Cannot delete default category');
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('space_id', spaceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

// 根据名称查找分类（用于AI识别后匹配）
export async function findCategoryByName(name: string): Promise<Category | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) return null;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('space_id', spaceId)
      .ilike('name', name.trim())
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      spaceId: data.space_id,
      name: data.name,
      color: data.color,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error finding category:', error);
    return null;
  }
}

// 合并分类（将源分类的所有商品项合并到目标分类，然后删除源分类）
export async function mergeCategory(sourceCategoryId: string, targetCategoryId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    if (sourceCategoryId === targetCategoryId) {
      throw new Error('Cannot merge category to itself');
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 验证两个分类都属于当前家庭
    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('space_id', spaceId)
      .in('id', [sourceCategoryId, targetCategoryId]);

    if (fetchError) throw fetchError;
    if (!categories || categories.length !== 2) {
      throw new Error('Category does not exist or does not belong to current household');
    }

    const sourceCategory = categories.find(cat => cat.id === sourceCategoryId);
    const targetCategory = categories.find(cat => cat.id === targetCategoryId);

    if (!sourceCategory || !targetCategory) {
      throw new Error('Category does not exist');
    }

    // 更新所有使用源分类的商品项，将它们指向目标分类
    // 由于需要确保只更新当前家庭的商品项，我们需要先获取所有相关的 receipt_ids
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id')
      .eq('space_id', spaceId);

    if (receiptsError) throw receiptsError;

    if (receipts && receipts.length > 0) {
      const receiptIds = receipts.map(r => r.id);
      
      // 获取所有使用源分类的商品项
      const { data: items, error: itemsError } = await supabase
        .from('receipt_items')
        .select('id')
        .eq('category_id', sourceCategoryId)
        .in('receipt_id', receiptIds);

      if (itemsError) throw itemsError;

      // 更新这些商品项
      if (items && items.length > 0) {
        const itemIds = items.map(item => item.id);
        const { error: updateItemsError } = await supabase
          .from('receipt_items')
          .update({ category_id: targetCategoryId })
          .in('id', itemIds);

        if (updateItemsError) throw updateItemsError;
      }
    }

    // 删除源分类（不能删除默认分类，但如果用户明确要合并，可以允许）
    // 注意：默认分类可以被合并，但合并后的目标分类保持其属性
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', sourceCategoryId)
      .eq('space_id', spaceId);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error merging category:', error);
    throw error;
  }
}

