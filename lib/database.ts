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
      throw new Error('Not logged in: Please sign in before saving receipt');
    }
    
    if (!user.householdId) {
      console.error('User has no household ID');
      throw new Error('User not associated with household account, please sign in again');
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
        currency: receipt.currency,
        tax: receipt.tax,
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
          'Database permission error: Unable to save receipt\n\n' +
          'Possible causes:\n' +
          '1. RLS policy not configured correctly - Please execute fix-receipts-rls-force.sql in Supabase\n' +
          '2. get_user_household_id() function returns NULL - Check if user has associated household\n' +
          '3. household_id mismatch - Please sign in again\n\n' +
          'Current user info:\n' +
          `- User ID: ${user.id}\n` +
          `- Household ID: ${user.householdId || 'NULL (not associated)'}\n` +
          `- Email: ${user.email}\n\n` +
          'Please execute diagnose-rls-issue.sql script to view detailed status'
        );
      }
      throw receiptError;
    }

    const receiptId = receiptData.id;

    // 保存商品项（需要将分类名称匹配到分类ID）
    console.log('Saving receipt items:', receipt.items?.length || 0, 'items');
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
                  'No categories found.\n\n' +
                  'Please do one of the following:\n' +
                  '1. Execute add-default-categories-for-existing-users.sql in Supabase SQL Editor\n' +
                  '2. Or manually create at least one category in the app\n\n' +
                  'Current user household ID: ' + (user.householdId || 'Unknown')
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
          purpose: item.purpose || 'Personnel', // 确保 purpose 不为 null
          price: item.price,
          is_asset: item.isAsset !== undefined ? item.isAsset : false, // 确保 isAsset 不为 null
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
            throw new Error('Database permission error: Unable to save items, please check RLS policy');
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
    if (!user) throw new Error('Not logged in');

    // 处理支付账户ID
    let paymentAccountId = receipt.paymentAccountId;
    if (!paymentAccountId && receipt.paymentAccount) {
      const account = await findOrCreatePaymentAccount(receipt.paymentAccount.name || receipt.paymentAccount.id, true);
      paymentAccountId = account.id;
    }

    // 更新小票主记录
    const updateData: any = {};
    if (receipt.storeName !== undefined) updateData.store_name = receipt.storeName;
    if (receipt.totalAmount !== undefined) updateData.total_amount = receipt.totalAmount;
    if (receipt.currency !== undefined) updateData.currency = receipt.currency;
    if (receipt.tax !== undefined) updateData.tax = receipt.tax;
    if (receipt.date !== undefined) updateData.date = receipt.date;
    if (paymentAccountId !== undefined) updateData.payment_account_id = paymentAccountId;
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
            throw new Error(`Item "${item.name}" is missing category ID`);
          }

          itemsToInsert.push({
            receipt_id: receiptId,
            name: item.name,
            category_id: categoryId,
            purpose: item.purpose || 'Personnel', // 确保 purpose 不为 null
            price: item.price,
            is_asset: item.isAsset !== undefined ? item.isAsset : false, // 确保 isAsset 不为 null
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
    if (!user) throw new Error('Not logged in');

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
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'receipt_items', ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      storeName: row.store_name,
      totalAmount: row.total_amount,
      currency: row.currency,
      tax: row.tax,
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

// 更新单个商品项的某个字段
export async function updateReceiptItem(
  receiptId: string,
  itemId: string,
  field: 'categoryId' | 'purpose' | 'isAsset',
  value: any
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 构建更新数据
    const updateData: any = {};
    if (field === 'categoryId') {
      updateData.category_id = value;
    } else if (field === 'purpose') {
      updateData.purpose = value;
    } else if (field === 'isAsset') {
      updateData.is_asset = value;
    }

    // 更新商品项（直接使用 itemId，不依赖索引）
    const { error } = await supabase
      .from('receipt_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('receipt_id', receiptId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating receipt item:', error);
    throw error;
  }
}

// 根据ID获取小票
export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

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
      .order('created_at', { foreignTable: 'receipt_items', ascending: true })
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
      currency: data.currency,
      tax: data.tax,
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
    if (!user) throw new Error('Not logged in');

    // 先获取小票信息，以便删除关联的图片
    const receipt = await getReceiptById(receiptId);
    
    // 删除关联的图片
    if (receipt?.imageUrl) {
      try {
        // 从 imageUrl 中提取文件路径
        // imageUrl 格式通常是：https://xxx.supabase.co/storage/v1/object/public/receipts/filename.ext
        // 或者：https://xxx.supabase.co/storage/v1/object/sign/receipts/filename.ext?token=...
        let filePaths: string[] = [];
        
        // 尝试从 URL 中提取文件名
        const urlParts = receipt.imageUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        // 移除查询参数（如果有）
        const fileName = lastPart.split('?')[0];
        
        if (fileName && fileName.length > 0) {
          filePaths.push(fileName);
        }
        
        // 同时尝试使用 receiptId 构建可能的文件名（作为备选）
        // 尝试常见的图片扩展名
        const extensions = ['jpg', 'jpeg', 'png', 'webp'];
        for (const ext of extensions) {
          const testPath = `${receiptId}.${ext}`;
          if (!filePaths.includes(testPath)) {
            filePaths.push(testPath);
          }
        }
        
        // 尝试删除所有可能的文件路径（remove 方法会忽略不存在的文件）
        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('receipts')
            .remove(filePaths);
          
          if (storageError) {
            console.warn('Failed to delete image from storage:', storageError);
            // 不抛出错误，继续删除小票记录
          } else {
            console.log('Successfully deleted image(s):', filePaths);
          }
        } else {
          console.warn('Could not determine file path for image deletion');
        }
      } catch (imageError) {
        console.warn('Error deleting image:', imageError);
        // 不抛出错误，继续删除小票记录
      }
    }

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
