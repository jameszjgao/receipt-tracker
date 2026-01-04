import { GeminiReceiptResult, Receipt } from '@/types';
import { getCurrentUser } from './auth';
import { findCategoryByName, getCategories } from './categories';
import { findOrCreatePaymentAccount } from './payment-accounts';

// 将 Gemini 识别结果转换为 Receipt 格式
export async function convertGeminiResultToReceipt(result: GeminiReceiptResult): Promise<Receipt> {
  const user = await getCurrentUser();
  if (!user) throw new Error('未登录');

  // 获取所有分类
  const categories = await getCategories();

  // 处理支付账户
  let paymentAccountId: string | undefined;
  if (result.paymentAccountName) {
    const account = await findOrCreatePaymentAccount(result.paymentAccountName, true);
    paymentAccountId = account.id;
  }

  // 处理商品项，匹配分类
  const items = await Promise.all(
    result.items.map(async (item) => {
      // 尝试匹配分类名称
      let category = categories.find((cat) => 
        cat.name.toLowerCase() === item.categoryName.toLowerCase()
      );

      // 如果找不到，尝试使用 findCategoryByName（模糊匹配）
      if (!category) {
        category = await findCategoryByName(item.categoryName);
      }

      // 如果还是找不到，使用默认分类 "购物"
      if (!category) {
        console.warn(`分类 "${item.categoryName}" 未找到，尝试使用默认分类`);
        
        // 尝试按优先级查找默认分类
        const defaultCategoryNames = ['购物', '食品', 'Other', 'Grocery'];
        for (const defaultName of defaultCategoryNames) {
          category = categories.find((cat) => 
            cat.name === defaultName || cat.name.toLowerCase() === defaultName.toLowerCase()
          );
          if (category) break;
        }
        
        // 如果还是找不到，尝试找任何一个默认分类
        if (!category) {
          category = categories.find((cat) => cat.isDefault);
        }
        
        // 如果仍然找不到，尝试找第一个分类（至少有一个分类）
        if (!category && categories.length > 0) {
          category = categories[0];
          console.warn(`使用第一个可用分类: ${category.name}`);
        }
        
        if (!category) {
          throw new Error(
            '未找到默认分类。\n\n' +
            '请执行以下操作：\n' +
            '1. 在 Supabase SQL Editor 中执行 add-default-categories-for-existing-users.sql\n' +
            '2. 或者在应用中手动创建至少一个分类\n\n' +
            '当前用户的家庭ID: ' + (user.householdId || '未知')
          );
        }
      }

      return {
        name: item.name,
        categoryId: category.id,
        category: category,
        purpose: item.purpose,
        price: item.price,
        isAsset: item.isAsset,
        confidence: item.confidence,
      };
    })
  );

  return {
    householdId: user.householdId,
    storeName: result.storeName,
    totalAmount: result.totalAmount,
    date: result.date,
    paymentAccountId: paymentAccountId,
    status: result.confidence < 0.7 ? 'pending' : 'processing',
    items: items,
    confidence: result.confidence,
  };
}

