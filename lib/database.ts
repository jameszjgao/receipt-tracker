import { supabase } from './supabase';
import { Receipt, ReceiptItem, ReceiptStatus } from '@/types';
import { getCurrentUser } from './auth';
import { findCategoryByName } from './categories';
import { findOrCreatePaymentAccount } from './payment-accounts';

// 保存小票到数据库
export async function saveReceipt(receipt: Receipt): Promise<string> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('User not logged in when trying to save receipt');
      throw new Error('未登录：请先登录后再保存小票');
    }
    
    if (!user.householdId) {
      console.error('User has no household ID');
      throw new Error('用户未关联家庭账户，请重新登录');
    }

    // 处理支付账户ID
    let paymentAccountId = receipt.paymentAccountId;
    if (!paymentAccountId && receipt.paymentAccount) {
      const account = await findOrCreatePaymentAccount(receipt.paymentAccount.name || receipt.paymentAccount.id, true);
      paymentAccountId = account.id;
    }

    // 先保存小票主记录
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        household_id: user.householdId,
        store_name: receipt.storeName,
        total_amount: receipt.totalAmount,
        date: receipt.date,
        payment_account_id: paymentAccountId,
        status: receipt.status,
        image_url: receipt.imageUrl,
        confidence: receipt.confidence,
        processed_by: receipt.processedBy,
      })
      .select()
      .single();

    if (receiptError) {
      console.error('Receipt insert error:', receiptError);
      console.error('User info:', {
        userId: user.id,
        householdId: user.householdId,
        email: user.email,
      });
      console.error('Receipt data being inserted:', {
        household_id: user.householdId,
        store_name: receipt.storeName,
        total_amount: receipt.totalAmount,
        date: receipt.date,
      });
      
      if (receiptError.message?.includes('row-level security') || receiptError.code === '42501') {
        throw new Error(
          '数据库权限错误：无法保存小票\n\n' +
          '可能原因：\n' +
          '1. RLS 策略未正确配置 - 请在 Supabase 中执行 fix-receipts-rls-force.sql\n' +
          '2. get_user_household_id() 函数返回 NULL - 请检查用户是否有关联的家庭\n' +
          '3. household_id 不匹配 - 请重新登录\n\n' +
          '当前用户信息：\n' +
          `- 用户ID: ${user.id}\n` +
          `- 家庭ID: ${user.householdId || 'NULL（未关联家庭）'}\n` +
          `- 邮箱: ${user.email}\n\n` +
          '请先执行诊断脚本 diagnose-rls-issue.sql 查看详细状态'
        );
      }
      throw receiptError;
    }

    const receiptId = receiptData.id;

    // 保存商品项（需要将分类名称匹配到分类ID）
    if (receipt.items && receipt.items.length > 0) {
      const itemsToInsert: any[] = [];

      for (const item of receipt.items) {
        let categoryId = item.categoryId;
        
        // 如果没有categoryId但有category对象，使用category.id
        if (!categoryId && item.category) {
          categoryId = item.category.id;
        }

        // 如果还是没有，尝试通过名称查找（兼容旧代码）
        if (!categoryId) {
          const category = await findCategoryByName(item.name || 'Other');
          categoryId = category?.id || null;
        }

        if (!categoryId) {
          // 如果仍然找不到，尝试获取默认分类
          console.warn(`商品 "${item.name}" 的分类未找到，使用默认分类`);
          
          // 尝试按优先级查找默认分类
          const defaultCategoryNames = ['购物', '食品', 'Other', 'Grocery'];
          let defaultCategory = null;
          
          for (const defaultName of defaultCategoryNames) {
            defaultCategory = await findCategoryByName(defaultName);
            if (defaultCategory) break;
          }
          
          if (!defaultCategory) {
            // 如果都找不到，尝试获取第一个默认分类
            const { data: defaultCategories } = await supabase
              .from('categories')
              .select('id')
              .eq('household_id', user.householdId)
              .eq('is_default', true)
              .limit(1);
            
            if (!defaultCategories || defaultCategories.length === 0) {
              // 如果连默认分类都没有，尝试获取任何第一个分类
              const { data: anyCategories } = await supabase
                .from('categories')
                .select('id')
                .eq('household_id', user.householdId)
                .limit(1);
              
              if (!anyCategories || anyCategories.length === 0) {
                throw new Error(
                  '未找到任何分类。\n\n' +
                  '请执行以下操作：\n' +
                  '1. 在 Supabase SQL Editor 中执行 add-default-categories-for-existing-users.sql\n' +
                  '2. 或者在应用中手动创建至少一个分类\n\n' +
                  '当前用户的家庭ID: ' + (user.householdId || '未知')
                );
              }
              categoryId = anyCategories[0].id;
            } else {
              categoryId = defaultCategories[0].id;
            }
          } else {
            categoryId = defaultCategory.id;
          }
        }

        itemsToInsert.push({
          receipt_id: receiptId,
          name: item.name,
          category_id: categoryId,
          purpose: item.purpose,
          price: item.price,
          is_asset: item.isAsset,
          confidence: item.confidence,
        });
      }

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('receipt_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Receipt items insert error:', itemsError);
          if (itemsError.message?.includes('row-level security') || itemsError.code === '42501') {
            throw new Error('数据库权限错误：无法保存商品项，请检查 RLS 策略');
          }
          throw itemsError;
        }
      }
    }

    return receiptId;
  } catch (error) {
    console.error('Error saving receipt:', error);
    throw error;
  }
}

// 更新小票
export async function updateReceipt(receiptId: string, receipt: Partial<Receipt>): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    // 更新小票主记录
    const updateData: any = {};
    if (receipt.storeName !== undefined) updateData.store_name = receipt.storeName;
    if (receipt.totalAmount !== undefined) updateData.total_amount = receipt.totalAmount;
    if (receipt.date !== undefined) updateData.date = receipt.date;
    if (receipt.paymentAccountId !== undefined) updateData.payment_account_id = receipt.paymentAccountId;
    if (receipt.status !== undefined) updateData.status = receipt.status;
    if (receipt.confidence !== undefined) updateData.confidence = receipt.confidence;
    if (receipt.imageUrl !== undefined) updateData.image_url = receipt.imageUrl;

    const { error: receiptError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receiptId)
      .eq('household_id', user.householdId);

    if (receiptError) throw receiptError;

    // 如果更新了商品项，先删除旧的再插入新的
    if (receipt.items !== undefined) {
      // 删除旧商品项
      await supabase
        .from('receipt_items')
        .delete()
        .eq('receipt_id', receiptId);

      // 插入新商品项
      if (receipt.items.length > 0) {
        const itemsToInsert: any[] = [];

        for (const item of receipt.items) {
          let categoryId = item.categoryId;
          if (!categoryId && item.category) {
            categoryId = item.category.id;
          }
          if (!categoryId) {
            throw new Error(`商品 "${item.name}" 缺少分类ID`);
          }

          itemsToInsert.push({
            receipt_id: receiptId,
            name: item.name,
            category_id: categoryId,
            purpose: item.purpose,
            price: item.price,
            is_asset: item.isAsset,
            confidence: item.confidence,
          });
        }

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('receipt_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }
    }
  } catch (error) {
    console.error('Error updating receipt:', error);
    throw error;
  }
}

// 获取所有小票（当前家庭的）
export async function getAllReceipts(): Promise<Receipt[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        payment_accounts (*),
        receipt_items (
          *,
          categories (*)
        )
      `)
      .eq('household_id', user.householdId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      storeName: row.store_name,
      totalAmount: row.total_amount,
      date: row.date,
      paymentAccountId: row.payment_account_id,
      paymentAccount: row.payment_accounts ? {
        id: row.payment_accounts.id,
        householdId: row.payment_accounts.household_id,
        name: row.payment_accounts.name,
        isAiRecognized: row.payment_accounts.is_ai_recognized,
        createdAt: row.payment_accounts.created_at,
        updatedAt: row.payment_accounts.updated_at,
      } : undefined,
      status: row.status as ReceiptStatus,
      imageUrl: row.image_url,
      confidence: row.confidence,
      processedBy: row.processed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: (row.receipt_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        category: item.categories ? {
          id: item.categories.id,
          householdId: item.categories.household_id,
          name: item.categories.name,
          color: item.categories.color,
          isDefault: item.categories.is_default,
          createdAt: item.categories.created_at,
          updatedAt: item.categories.updated_at,
        } : undefined,
        purpose: item.purpose,
        price: item.price,
        isAsset: item.is_asset,
        confidence: item.confidence,
      })),
    }));
  } catch (error) {
    console.error('Error fetching receipts:', error);
    throw error;
  }
}

// 根据ID获取小票
export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        payment_accounts (*),
        receipt_items (
          *,
          categories (*)
        )
      `)
      .eq('id', receiptId)
      .eq('household_id', user.householdId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    if (!data) return null;

    return {
      id: data.id,
      householdId: data.household_id,
      storeName: data.store_name,
      totalAmount: data.total_amount,
      date: data.date,
      paymentAccountId: data.payment_account_id,
      paymentAccount: data.payment_accounts ? {
        id: data.payment_accounts.id,
        householdId: data.payment_accounts.household_id,
        name: data.payment_accounts.name,
        isAiRecognized: data.payment_accounts.is_ai_recognized,
        createdAt: data.payment_accounts.created_at,
        updatedAt: data.payment_accounts.updated_at,
      } : undefined,
      status: data.status as ReceiptStatus,
      imageUrl: data.image_url,
      confidence: data.confidence,
      processedBy: data.processed_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      items: (data.receipt_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        category: item.categories ? {
          id: item.categories.id,
          householdId: item.categories.household_id,
          name: item.categories.name,
          color: item.categories.color,
          isDefault: item.categories.is_default,
          createdAt: item.categories.created_at,
          updatedAt: item.categories.updated_at,
        } : undefined,
        purpose: item.purpose,
        price: item.price,
        isAsset: item.is_asset,
        confidence: item.confidence,
      })),
    };
  } catch (error) {
    console.error('Error fetching receipt:', error);
    throw error;
  }
}

// 删除小票
export async function deleteReceipt(receiptId: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('未登录');

    // 删除会级联删除商品项
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('household_id', user.householdId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
}
