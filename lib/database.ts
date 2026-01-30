import { supabase } from './supabase';
import { Receipt, ReceiptItem, ReceiptStatus } from '@/types';
import { getCurrentUser } from './auth';
import { findCategoryByName } from './categories';
import { findOrCreatePaymentAccount } from './payment-accounts';
import { findOrCreateSupplier } from './suppliers';

// 将日期数据转换为 YYYY-MM-DD 格式的字符串，完全忠实于票面日期，不做任何时区转换
function normalizeDate(dateValue: any): string {
  if (!dateValue) {
    // 如果日期为空，返回今天的日期（使用本地时区）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 优先处理字符串，因为这是数据库 DATE 字段的原始格式
  if (typeof dateValue === 'string') {
    // 如果是 ISO 字符串（如 "2024-01-15T00:00:00Z"），只取日期部分，不进行时区转换
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // 如果已经是 YYYY-MM-DD 格式，直接返回，不做任何转换
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
  }

  // 如果是 Date 对象，需要小心处理时区问题
  // 为了避免时区转换问题，我们使用 UTC 方法而不是本地时区方法
  // 这样可以确保日期与数据库存储的日期一致
  if (dateValue instanceof Date) {
    // 使用 UTC 方法，确保与数据库 DATE 字段的存储方式一致
    // PostgreSQL DATE 类型不包含时区信息，总是按字面值存储
    const year = dateValue.getUTCFullYear();
    const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 其他情况，尝试转换为字符串
  return String(dateValue);
}

// 保存小票到数据库
export async function saveReceipt(receipt: Receipt): Promise<string> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('User not logged in when trying to save receipt');
      throw new Error('Not logged in: Please sign in before saving receipt');
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      console.error('User has no space ID');
      throw new Error('User not associated with space account, please sign in again');
    }

    // 处理供应商ID（排除无效的供应商名称，如 "Processing..." 等）
    let supplierId = receipt.supplierId;
    const supplierName = receipt.supplierName || receipt.storeName; // 向后兼容
    if (!supplierId && supplierName) {
      const trimmedSupplierName = supplierName.trim();
      // 排除处理状态等无效名称
      const invalidNames = ['processing', 'processing...', 'pending', 'pending...', 'loading', 'loading...', '识别中', '处理中', '待处理'];
      const isValidName = !invalidNames.includes(trimmedSupplierName.toLowerCase());

      if (isValidName) {
        try {
          // 如果没有 supplierId 但有 storeName，尝试查找或创建供应商
          const supplier = await findOrCreateSupplier(trimmedSupplierName, true);
          supplierId = supplier.id;
        } catch (error) {
          console.warn('Failed to create or find supplier:', error);
          // 如果供应商创建失败，继续处理其他信息，不阻塞整个流程
        }
      } else {
        console.warn(`Skipping invalid supplier name: "${trimmedSupplierName}"`);
      }
    } else if (!supplierId && receipt.supplier) {
      // 如果有 supplier 对象，使用其 ID
      supplierId = receipt.supplier.id;
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
        space_id: spaceId,
        supplier_name: receipt.supplierName || receipt.storeName,
        supplier_id: supplierId,
        total_amount: receipt.totalAmount,
        currency: receipt.currency,
        tax: receipt.tax,
        date: receipt.date,
        payment_account_id: paymentAccountId,
        status: receipt.status,
        image_url: receipt.imageUrl,
        confidence: receipt.confidence,
        processed_by: receipt.processedBy,
        created_by: user.id, // 记录提交者
      })
      .select()
      .single();

    if (receiptError) {
      console.error('Receipt insert error:', receiptError);
      console.error('User info:', {
        userId: user.id,
        spaceId: spaceId,
        email: user.email,
      });
      console.error('Receipt data being inserted:', {
        space_id: spaceId,
        supplier_name: receipt.supplierName || receipt.storeName,
        total_amount: receipt.totalAmount,
        date: receipt.date,
      });

      if (receiptError.message?.includes('row-level security') || receiptError.code === '42501') {
        throw new Error(
          'Database permission error: Unable to save receipt\n\n' +
          'Possible causes:\n' +
          '1. RLS policy not configured correctly - Please execute fix-receipts-rls-force.sql in Supabase\n' +
          '2. get_user_space_id() function returns NULL - Check if user has associated space\n' +
          '3. space_id mismatch - Please sign in again\n\n' +
          'Current user info:\n' +
          `- User ID: ${user.id}\n` +
          `- Space ID: ${spaceId || 'NULL (not associated)'}\n` +
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
        let categoryId: string | null | undefined = item.categoryId;

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
              .eq('space_id', spaceId)
              .eq('is_default', true)
              .limit(1);

            if (!defaultCategories || defaultCategories.length === 0) {
              // 如果连默认分类都没有，尝试获取任何第一个分类
              const { data: anyCategories } = await supabase
                .from('categories')
                .select('id')
                .eq('space_id', spaceId)
                .limit(1);

              if (!anyCategories || anyCategories.length === 0) {
                throw new Error(
                  'No categories found.\n\n' +
                  'Please do one of the following:\n' +
                  '1. Execute add-default-categories-for-existing-users.sql in Supabase SQL Editor\n' +
                  '2. Or manually create at least one category in the app\n\n' +
                  'Current user space ID: ' + (spaceId || 'Unknown')
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
          purpose_id: item.purposeId ?? null,
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

    // 处理供应商ID（排除无效的供应商名称，如 "Processing..." 等）
    let supplierId = receipt.supplierId;
    const supplierName = receipt.supplierName || receipt.storeName; // 向后兼容
    if (supplierName && !supplierId) {
      const trimmedSupplierName = supplierName.trim();
      // 排除处理状态等无效名称
      const invalidNames = ['processing', 'processing...', 'pending', 'pending...', 'loading', 'loading...', '识别中', '处理中', '待处理'];
      const isValidName = !invalidNames.includes(trimmedSupplierName.toLowerCase());

      if (isValidName) {
        try {
          // 如果更新了 storeName 但没有 supplierId，尝试查找或创建供应商
          const supplier = await findOrCreateSupplier(trimmedSupplierName, true);
          supplierId = supplier.id;
        } catch (error) {
          console.warn('Failed to create or find supplier:', error);
          // 如果供应商创建失败，继续处理其他信息，不阻塞整个流程
        }
      } else {
        console.warn(`Skipping invalid supplier name: "${trimmedSupplierName}"`);
      }
    } else if (receipt.supplier && !supplierId) {
      // 如果有 supplier 对象，使用其 ID
      supplierId = receipt.supplier.id;
    }

    // 处理支付账户ID
    let paymentAccountId = receipt.paymentAccountId;
    if (!paymentAccountId && receipt.paymentAccount) {
      const account = await findOrCreatePaymentAccount(receipt.paymentAccount.name || receipt.paymentAccount.id, true);
      paymentAccountId = account.id;
    }

    // 更新小票主记录
    const updateData: any = {};
    if (receipt.supplierName !== undefined) updateData.supplier_name = receipt.supplierName;
    else if (receipt.storeName !== undefined) updateData.supplier_name = receipt.storeName; // 向后兼容
    if (supplierId !== undefined) updateData.supplier_id = supplierId;
    if (receipt.totalAmount !== undefined) updateData.total_amount = receipt.totalAmount;
    if (receipt.currency !== undefined) updateData.currency = receipt.currency;
    if (receipt.tax !== undefined) updateData.tax = receipt.tax;
    if (receipt.date !== undefined) updateData.date = receipt.date;
    if (paymentAccountId !== undefined) updateData.payment_account_id = paymentAccountId;
    if (receipt.status !== undefined) updateData.status = receipt.status;
    if (receipt.confidence !== undefined) updateData.confidence = receipt.confidence;
    if (receipt.imageUrl !== undefined) updateData.image_url = receipt.imageUrl;

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { error: receiptError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receiptId)
                .eq('space_id', spaceId);

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
            purpose_id: item.purposeId ?? null,
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

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        suppliers (*),
        payment_accounts (*),
        created_by_user:users!created_by (
          id,
          email,
          name,
          current_space_id
        ),
        receipt_items (
          *,
          categories (*),
          purposes (*)
        )
      `)
                .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'receipt_items', ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      spaceId: row.space_id,
      supplierName: row.supplier_name,
      storeName: row.supplier_name, // 向后兼容
      supplierId: row.supplier_id,
      supplier: row.suppliers ? {
        id: row.suppliers.id,
        spaceId: row.suppliers.space_id,
        name: row.suppliers.name,
        taxNumber: row.suppliers.tax_number,
        phone: row.suppliers.phone,
        address: row.suppliers.address,
        isAiRecognized: row.suppliers.is_ai_recognized,
        createdAt: row.suppliers.created_at,
        updatedAt: row.suppliers.updated_at,
      } : undefined,
      totalAmount: row.total_amount,
      currency: row.currency,
      tax: row.tax,
      date: normalizeDate(row.date),
      paymentAccountId: row.payment_account_id,
      paymentAccount: row.payment_accounts ? {
        id: row.payment_accounts.id,
        spaceId: row.payment_accounts.space_id,
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
      createdBy: row.created_by,
      createdByUser: row.created_by_user ? {
        id: row.created_by_user.id,
        email: row.created_by_user.email,
        name: row.created_by_user.name,
        spaceId: row.created_by_user.current_space_id,
      } : undefined,
      items: (row.receipt_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        category: item.categories ? {
          id: item.categories.id,
          spaceId: item.categories.space_id,
          name: item.categories.name,
          color: item.categories.color,
          isDefault: item.categories.is_default,
          createdAt: item.categories.created_at,
          updatedAt: item.categories.updated_at,
        } : undefined,
        purposeId: item.purpose_id ?? null,
        purpose: item.purposes ? {
          id: item.purposes.id,
          spaceId: item.purposes.space_id,
          name: item.purposes.name,
          color: item.purposes.color,
          isDefault: item.purposes.is_default,
          createdAt: item.purposes.created_at,
          updatedAt: item.purposes.updated_at,
        } : undefined,
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
  field: 'categoryId' | 'purposeId' | 'isAsset',
  value: any
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 构建更新数据
    const updateData: any = {};
    if (field === 'categoryId') {
      updateData.category_id = value;
    } else if (field === 'purposeId') {
      updateData.purpose_id = value;
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

// 获取用户历史小票中最频繁的币种
export async function getMostFrequentCurrency(): Promise<string | null> {
  const currencies = await getCurrenciesByUsage();
  return currencies.length > 0 ? currencies[0] : null;
}

// 获取用户历史小票中所有币种（按使用频率降序排列）
export async function getCurrenciesByUsage(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 查询当前家庭的所有小票，统计币种出现频次
    const { data, error } = await supabase
      .from('receipts')
      .select('currency')
      .eq('space_id', spaceId)
      .not('currency', 'is', null);

    if (error) {
      console.warn('Error fetching currency statistics:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 统计币种出现频次
    const currencyCount: Record<string, number> = {};
    data.forEach((receipt: any) => {
      const currency = receipt.currency;
      if (currency) {
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
      }
    });

    // 按使用频率降序排列
    const sortedCurrencies = Object.entries(currencyCount)
      .sort((a, b) => b[1] - a[1])
      .map(([currency]) => currency);

    return sortedCurrencies;
  } catch (error) {
    console.warn('Error getting currencies by usage:', error);
    return [];
  }
}

// 根据ID获取小票
export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        suppliers (*),
        payment_accounts (*),
        created_by_user:users!created_by (
          id,
          email,
          name,
          current_space_id
        ),
        receipt_items (
          *,
          categories (*),
          purposes (*)
        )
      `)
      .eq('id', receiptId)
                .eq('space_id', spaceId)
      .order('created_at', { foreignTable: 'receipt_items', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    if (!data) return null;

    return {
      id: data.id,
      spaceId: data.space_id,
      supplierName: data.supplier_name,
      supplierId: data.supplier_id,
      supplier: data.suppliers ? {
        id: data.suppliers.id,
        spaceId: data.suppliers.space_id,
        name: data.suppliers.name,
        taxNumber: data.suppliers.tax_number,
        phone: data.suppliers.phone,
        address: data.suppliers.address,
        isAiRecognized: data.suppliers.is_ai_recognized,
        createdAt: data.suppliers.created_at,
        updatedAt: data.suppliers.updated_at,
      } : undefined,
      totalAmount: data.total_amount,
      currency: data.currency,
      tax: data.tax,
      date: normalizeDate(data.date),
      paymentAccountId: data.payment_account_id,
      paymentAccount: data.payment_accounts ? {
        id: data.payment_accounts.id,
        spaceId: data.payment_accounts.space_id,
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
      createdBy: data.created_by,
      createdByUser: data.created_by_user ? {
        id: data.created_by_user.id,
        email: data.created_by_user.email,
        name: data.created_by_user.name,
        spaceId: data.created_by_user.current_space_id,
      } : undefined,
      items: (data.receipt_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        category: item.categories ? {
          id: item.categories.id,
          spaceId: item.categories.space_id,
          name: item.categories.name,
          color: item.categories.color,
          isDefault: item.categories.is_default,
          createdAt: item.categories.created_at,
          updatedAt: item.categories.updated_at,
        } : undefined,
        purposeId: item.purpose_id ?? null,
        purpose: item.purposes ? {
          id: item.purposes.id,
          spaceId: item.purposes.space_id,
          name: item.purposes.name,
          color: item.purposes.color,
          isDefault: item.purposes.is_default,
          createdAt: item.purposes.created_at,
          updatedAt: item.purposes.updated_at,
        } : undefined,
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

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) throw new Error('No space selected');

    // 删除会级联删除商品项
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
                .eq('space_id', spaceId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
}
