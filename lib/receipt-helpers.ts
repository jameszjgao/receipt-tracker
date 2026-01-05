import { GeminiReceiptResult, Receipt, ReceiptStatus } from '@/types';
import { getCurrentUser } from './auth';
import { findCategoryByName, getCategories } from './categories';
import { findOrCreatePaymentAccount } from './payment-accounts';

// 将 Gemini 识别结果转换为 Receipt 格式
export async function convertGeminiResultToReceipt(result: GeminiReceiptResult): Promise<Receipt> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');

  // 获取所有分类
  const categories = await getCategories();

  // 处理支付账户
  let paymentAccountId: string | undefined;
  if (result.paymentAccountName) {
    const account = await findOrCreatePaymentAccount(result.paymentAccountName, true);
    paymentAccountId = account.id;
  }

  // 处理商品项，匹配分类
  // 确保 items 存在且是数组
  if (!result.items || !Array.isArray(result.items)) {
    console.warn('No items found in Gemini result, using empty array');
    result.items = [];
  }
  
  console.log('Processing items:', result.items.length, 'items found');
  
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
            'Default category not found.\n\n' +
            'Please do one of the following:\n' +
            '1. Execute add-default-categories-for-existing-users.sql in Supabase SQL Editor\n' +
            '2. Or manually create at least one category in the app\n\n' +
            'Current user household ID: ' + (user.householdId || 'Unknown')
          );
        }
      }

      return {
        name: item.name,
        categoryId: category.id,
        category: category,
        purpose: item.purpose || 'Personnel', // 默认值为 Personnel
        price: item.price,
        isAsset: item.isAsset || false, // 默认值为 false
        confidence: item.confidence,
      };
    })
  );

  // 计算调整后的置信度（基于多个因素）
  let adjustedConfidence = result.confidence || 0.5;
  
  // 1. 检查明细金额总和与总金额是否一致
  const itemsSum = items.reduce((sum, item) => sum + item.price, 0);
  const expectedTotal = itemsSum + (result.tax || 0);
  const totalAmount = result.totalAmount || 0;
  const amountDifference = Math.abs(expectedTotal - totalAmount);
  const amountMatches = amountDifference <= 0.01; // 允许 0.01 的误差
  
  // 2. 检查数据一致性
  const dataConsistency = result.dataConsistency;
  const itemsSumMatches = dataConsistency?.itemsSumMatchesTotal ?? amountMatches;
  const hasMissingItems = dataConsistency?.missingItems ?? (!amountMatches && itemsSum < totalAmount);
  
  // 3. 检查图片质量
  const imageQuality = result.imageQuality;
  const clarity = imageQuality?.clarity ?? 0.8;
  const completeness = imageQuality?.completeness ?? 0.8;
  
  // 4. 调整置信度
  // 如果明细金额不匹配，降低置信度
  if (!itemsSumMatches) {
    const differenceRatio = amountDifference / Math.max(totalAmount, 1);
    if (differenceRatio > 0.1) {
      // 差异超过 10%，大幅降低置信度
      adjustedConfidence = Math.max(0.2, adjustedConfidence - 0.3);
    } else if (differenceRatio > 0.05) {
      // 差异在 5-10%，中等降低
      adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.2);
    } else {
      // 差异在 5% 以内，轻微降低
      adjustedConfidence = Math.max(0.4, adjustedConfidence - 0.1);
    }
  }
  
  // 如果有遗漏的商品项，降低置信度
  if (hasMissingItems) {
    adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.15);
  }
  
  // 图片清晰度影响置信度
  if (clarity < 0.7) {
    adjustedConfidence = Math.max(0.2, adjustedConfidence - 0.1);
  }
  
  // 图片完整度影响置信度
  if (completeness < 0.8) {
    adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.1);
  }
  
  // 如果明细金额匹配且图片质量好，可以提高置信度
  if (itemsSumMatches && !hasMissingItems && clarity >= 0.8 && completeness >= 0.9) {
    adjustedConfidence = Math.min(0.95, adjustedConfidence + 0.05);
  }
  
  // 根据调整后的置信度自动设置状态
  // 置信度 >= 0.85: confirmed (已确认)
  // 置信度 < 0.4: needs_retake (需重拍)
  // 其他: pending (待确认)
  let status: ReceiptStatus = 'pending';
  
  if (adjustedConfidence >= 0.85) {
    status = 'confirmed';
  } else if (adjustedConfidence < 0.4) {
    status = 'needs_retake';
  } else {
    status = 'pending';
  }
  
  console.log('Confidence calculation:', {
    originalConfidence: result.confidence,
    adjustedConfidence,
    itemsSum,
    totalAmount,
    tax: result.tax || 0,
    expectedTotal,
    amountDifference,
    itemsSumMatches,
    hasMissingItems,
    clarity,
    completeness,
    finalStatus: status,
  });

  return {
    householdId: user.householdId,
    storeName: result.storeName,
    totalAmount: result.totalAmount,
    currency: result.currency,
    tax: result.tax,
    date: result.date,
    paymentAccountId: paymentAccountId,
    status: status,
    items: items,
    confidence: adjustedConfidence, // 使用调整后的置信度
  };
}

