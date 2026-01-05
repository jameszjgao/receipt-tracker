import { supabase } from './supabase';

// 创建默认分类和支付账户的辅助函数
export async function createDefaultCategoriesAndAccounts(householdId: string): Promise<void> {
  // 创建默认分类
  console.log('Creating default categories');
  const { error: categoriesError } = await supabase.rpc('create_default_categories', {
    p_household_id: householdId,
  });

  if (categoriesError) {
    console.warn('RPC创建默认分类失败，尝试手动创建:', categoriesError);
    // 如果RPC失败，手动创建默认分类
    const { error: manualCategoriesError } = await supabase.from('categories').insert([
      { household_id: householdId, name: 'Groceries', color: '#FF6B6B', is_default: true },
      { household_id: householdId, name: 'Dining Out', color: '#4ECDC4', is_default: true },
      { household_id: householdId, name: 'Transportation', color: '#FFA07A', is_default: true },
      { household_id: householdId, name: 'Personal Care', color: '#FFD93D', is_default: true },
      { household_id: householdId, name: 'Health', color: '#F7DC6F', is_default: true },
      { household_id: householdId, name: 'Entertainment', color: '#E17055', is_default: true },
      { household_id: householdId, name: 'Education', color: '#BB8FCE', is_default: true },
      { household_id: householdId, name: 'Housing', color: '#45B7D1', is_default: true },
      { household_id: householdId, name: 'Utilities', color: '#74B9FF', is_default: true },
      { household_id: householdId, name: 'Clothing', color: '#FD79A8', is_default: true },
      { household_id: householdId, name: 'Subscriptions', color: '#55A3FF', is_default: true },
    ]);
    
    if (manualCategoriesError) {
      console.error('手动创建默认分类也失败:', manualCategoriesError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认分类创建成功');
    }
  }

  // 创建默认支付账户（AI识别的账户）
  console.log('Creating default payment accounts');
  const { error: paymentAccountsError } = await supabase.rpc('create_default_payment_accounts', {
    p_household_id: householdId,
  });

  if (paymentAccountsError) {
    console.warn('RPC创建默认支付账户失败，尝试手动创建:', paymentAccountsError);
    // 如果RPC失败，手动创建默认支付账户
    const { error: manualPaymentAccountsError } = await supabase.from('payment_accounts').insert([
      { household_id: householdId, name: 'Cash', is_ai_recognized: true },
      { household_id: householdId, name: 'Credit Card', is_ai_recognized: true },
      { household_id: householdId, name: 'Debit Card', is_ai_recognized: true },
      { household_id: householdId, name: 'Alipay', is_ai_recognized: true },
      { household_id: householdId, name: 'WeChat Pay', is_ai_recognized: true },
    ]);
    
    if (manualPaymentAccountsError) {
      console.error('手动创建默认支付账户也失败:', manualPaymentAccountsError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认支付账户创建成功');
    }
  }

  // 创建默认用途
  console.log('Creating default purposes');
  const { error: purposesError } = await supabase.rpc('create_default_purposes', {
    p_household_id: householdId,
  });

  if (purposesError) {
    console.warn('RPC创建默认用途失败，尝试手动创建:', purposesError);
    // 如果RPC失败，手动创建默认用途
    const { error: manualPurposesError } = await supabase.from('purposes').insert([
      { household_id: householdId, name: 'Home', color: '#00B894', is_default: true },
      { household_id: householdId, name: 'Gifts', color: '#E84393', is_default: true },
      { household_id: householdId, name: 'Business', color: '#FF9500', is_default: true },
    ]);
    
    if (manualPurposesError) {
      console.error('手动创建默认用途也失败:', manualPurposesError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认用途创建成功');
    }
  }
}

