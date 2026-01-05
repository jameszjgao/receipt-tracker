import { supabase } from './supabase';
import { getCurrentUser } from './auth';

// 用途接口
export interface Purpose {
  id: string;
  householdId: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 获取当前家庭的所有用途
export async function getPurposes(): Promise<Purpose[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const { data, error } = await supabase
      .from('purposes')
      .select('*')
      .eq('household_id', user.householdId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      name: row.name,
      color: row.color,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching purposes:', error);
    throw error;
  }
}

// 创建用途
export async function createPurpose(name: string, color: string = '#95A5A6'): Promise<Purpose> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const { data, error } = await supabase
      .from('purposes')
      .insert({
        household_id: user.householdId,
        name: name.trim(),
        color: color,
        is_default: false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      householdId: data.household_id,
      name: data.name,
      color: data.color,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error creating purpose:', error);
    throw error;
  }
}

// 更新用途
export async function updatePurpose(purposeId: string, updates: { name?: string; color?: string }): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.color !== undefined) updateData.color = updates.color;

    const { error } = await supabase
      .from('purposes')
      .update(updateData)
      .eq('id', purposeId)
      .eq('household_id', user.householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating purpose:', error);
    throw error;
  }
}

// 删除用途（不能删除默认用途）
export async function deletePurpose(purposeId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 检查是否为默认用途
    const { data: purpose, error: fetchError } = await supabase
      .from('purposes')
      .select('is_default')
      .eq('id', purposeId)
      .eq('household_id', user.householdId)
      .single();

    if (fetchError) throw fetchError;
    if (purpose?.is_default) {
      throw new Error('Cannot delete default purpose');
    }

    const { error } = await supabase
      .from('purposes')
      .delete()
      .eq('id', purposeId)
      .eq('household_id', user.householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting purpose:', error);
    throw error;
  }
}

// 根据名称查找用途（用于AI识别后匹配）
export async function findPurposeByName(name: string): Promise<Purpose | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('purposes')
      .select('*')
      .eq('household_id', user.householdId)
      .ilike('name', name.trim())
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      householdId: data.household_id,
      name: data.name,
      color: data.color,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error finding purpose:', error);
    return null;
  }
}

