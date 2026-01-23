import { supabase } from './supabase';

// 创建默认分类和支付账户的辅助函数
export async function createDefaultCategoriesAndAccounts(spaceId: string): Promise<void> {
  // 创建默认分类
  console.log('Creating default categories');
  const { error: categoriesError } = await supabase.rpc('create_default_categories', {
    p_space_id: spaceId,
  });

  if (categoriesError) {
    console.warn('RPC创建默认分类失败，尝试手动创建:', categoriesError);
    // 如果RPC失败，手动创建默认分类
    const { error: manualCategoriesError } = await supabase.from('categories').insert([
      { space_id: spaceId, name: 'Groceries', color: '#FF6B6B', is_default: true },
      { space_id: spaceId, name: 'Dining Out', color: '#4ECDC4', is_default: true },
      { space_id: spaceId, name: 'Transportation', color: '#FFA07A', is_default: true },
      { space_id: spaceId, name: 'Personal Care', color: '#FFD93D', is_default: true },
      { space_id: spaceId, name: 'Health', color: '#F7DC6F', is_default: true },
      { space_id: spaceId, name: 'Entertainment', color: '#E17055', is_default: true },
      { space_id: spaceId, name: 'Education', color: '#BB8FCE', is_default: true },
      { space_id: spaceId, name: 'Housing', color: '#45B7D1', is_default: true },
      { space_id: spaceId, name: 'Utilities', color: '#74B9FF', is_default: true },
      { space_id: spaceId, name: 'Clothing', color: '#FD79A8', is_default: true },
      { space_id: spaceId, name: 'Subscriptions', color: '#55A3FF', is_default: true },
    ]);
    
    if (manualCategoriesError) {
      console.error('手动创建默认分类也失败:', manualCategoriesError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认分类创建成功');
    }
  }

  // 创建默认支付账户（只创建 Cash）
  console.log('Creating default payment account (Cash only)');
  const { error: paymentAccountsError } = await supabase.rpc('create_default_payment_accounts', {
    p_space_id: spaceId,
  });

  if (paymentAccountsError) {
    console.warn('RPC创建默认支付账户失败，尝试手动创建:', paymentAccountsError);
    // 如果RPC失败，手动创建默认支付账户（只创建 Cash）
    const { error: manualPaymentAccountsError } = await supabase.from('payment_accounts').insert([
      { space_id: spaceId, name: 'Cash', is_ai_recognized: true },
    ]);
    
    if (manualPaymentAccountsError) {
      console.error('手动创建默认支付账户也失败:', manualPaymentAccountsError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认支付账户（Cash）创建成功');
    }
  }

  // 创建默认用途
  console.log('Creating default purposes');
  const { error: purposesError } = await supabase.rpc('create_default_purposes', {
    p_space_id: spaceId,
  });

  if (purposesError) {
    console.warn('RPC创建默认用途失败，尝试手动创建:', purposesError);
    // 如果RPC失败，手动创建默认用途
    const { error: manualPurposesError } = await supabase.from('purposes').insert([
      { space_id: spaceId, name: 'Home', color: '#00B894', is_default: true },
      { space_id: spaceId, name: 'Gifts', color: '#E84393', is_default: true },
      { space_id: spaceId, name: 'Business', color: '#FF9500', is_default: true },
    ]);
    
    if (manualPurposesError) {
      console.error('手动创建默认用途也失败:', manualPurposesError);
      // 不抛出错误，允许继续，用户可以稍后手动创建
    } else {
      console.log('默认用途创建成功');
    }
  }
}

