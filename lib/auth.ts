import { supabase } from './supabase';
import { User, Household } from '@/types';

// 获取当前用户
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      householdId: data.household_id,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// 获取当前用户的家庭信息
export async function getCurrentHousehold(): Promise<Household | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', user.householdId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error getting current household:', error);
    return null;
  }
}

// 注册新用户（创建家庭账户）
export async function signUp(email: string, password: string, householdName?: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    // 创建认证用户
    // 注意：如果 Supabase 启用了邮箱确认，注册后需要确认邮箱才能登录
    // 在开发环境中，可以在 Supabase Dashboard > Authentication > Settings 中禁用邮箱确认
    // 详细步骤请参考 DISABLE_EMAIL_CONFIRMATION.md
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    // 处理邮箱已存在的错误
    if (authError) {
      const errorMsg = authError.message?.toLowerCase() || '';
      // 如果邮箱已存在，提供明确的错误信息
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('email already') ||
          errorMsg.includes('user already registered')) {
        throw new Error(
          'This email is already registered.\n\n' +
          'If this is your account, please sign in directly.\n\n' +
          'If you need to re-register, please delete the user in Supabase Dashboard > Authentication > Users first, then register again.\n\n' +
          'For detailed steps, please refer to cleanup-auth-users.md'
        );
      }
      throw authError;
    }
    
    if (!authData.user) {
      throw new Error('Registration failed: User not created');
    }
    
    console.log('Auth user created:', authData.user.id, authData.user.email);
    
    // 检查 users 表中是否已存在该用户（以防万一）
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, household_id')
      .eq('id', authData.user.id)
      .maybeSingle();
    
    if (existingUser) {
      // 用户记录已存在，直接返回
      console.log('User record already exists, returning existing user');
      const user: User = {
        id: authData.user.id,
        email: email,
        householdId: existingUser.household_id,
      };
      return { user, error: null };
    }

    // 等待一下确保会话建立（如果需要）
    // 然后使用数据库函数创建家庭和用户记录（绕过 RLS）
    const householdNameFinal = householdName || `${email.split('@')[0]}的家庭`;
    console.log('Creating household and user via RPC:', householdNameFinal);
    
    const { data: householdId, error: rpcError } = await supabase.rpc('create_user_with_household', {
      p_user_id: authData.user.id,
      p_email: email,
      p_household_name: householdNameFinal,
    });

    if (rpcError) {
      console.error('RPC error creating user/household:', rpcError);
      
      // 如果 RPC 函数不存在，回退到直接插入（尝试）
      if (rpcError.message?.includes('function') || rpcError.code === '42883') {
        console.log('RPC function not found, trying direct insert...');
        
        // 尝试直接插入（如果 RLS 策略允许）
        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .insert({ name: householdNameFinal })
          .select()
          .single();

        if (householdError) {
          console.error('Household creation error:', householdError);
          if (householdError.message?.includes('row-level security') || householdError.code === '42501') {
            throw new Error('Database permission error: Unable to create household account. Please execute create-user-function.sql script in Supabase first');
          }
          throw new Error(`Failed to create household account: ${householdError.message}`);
        }
        
        if (!householdData) {
          throw new Error('Registration failed: Household account not created');
        }

        // 创建用户记录
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            household_id: householdData.id,
          });

        if (userError) {
          console.error('User creation error:', userError);
          throw new Error(`Failed to create user record: ${userError.message}`);
        }
        
        console.log('User and household created via direct insert');
        
        // 使用创建的家庭数据
        const householdDataFinal = householdData;
        
        // 创建默认分类和支付账户
        // ... (继续执行后续代码)
        const user: User = {
          id: authData.user.id,
          email: email,
          householdId: householdDataFinal.id,
        };

        // 创建默认分类
        console.log('Creating default categories');
        const { error: categoriesError } = await supabase.rpc('create_default_categories', {
          p_household_id: householdDataFinal.id,
        });
        if (categoriesError) {
          console.warn('RPC创建默认分类失败:', categoriesError);
          const { error: manualCategoriesError } = await supabase.from('categories').insert([
            { household_id: householdDataFinal.id, name: '食品', color: '#FF6B6B', is_default: true },
            { household_id: householdDataFinal.id, name: '外餐', color: '#4ECDC4', is_default: true },
            { household_id: householdDataFinal.id, name: '居家', color: '#45B7D1', is_default: true },
            { household_id: householdDataFinal.id, name: '交通', color: '#FFA07A', is_default: true },
            { household_id: householdDataFinal.id, name: '购物', color: '#98D8C8', is_default: true },
            { household_id: householdDataFinal.id, name: '医疗', color: '#F7DC6F', is_default: true },
            { household_id: householdDataFinal.id, name: '教育', color: '#BB8FCE', is_default: true },
          ]);
          if (!manualCategoriesError) {
            console.log('默认分类创建成功');
          }
        }

        // 创建默认支付账户
        console.log('Creating default payment accounts');
        const { error: paymentAccountsError } = await supabase.rpc('create_default_payment_accounts', {
          p_household_id: householdDataFinal.id,
        });
        if (paymentAccountsError) {
          console.warn('RPC创建默认支付账户失败:', paymentAccountsError);
          const { error: manualPaymentAccountsError } = await supabase.from('payment_accounts').insert([
            { household_id: householdDataFinal.id, name: 'Cash', is_ai_recognized: true },
            { household_id: householdDataFinal.id, name: 'Credit Card', is_ai_recognized: true },
            { household_id: householdDataFinal.id, name: 'Debit Card', is_ai_recognized: true },
            { household_id: householdDataFinal.id, name: 'Alipay', is_ai_recognized: true },
            { household_id: householdDataFinal.id, name: 'WeChat Pay', is_ai_recognized: true },
          ]);
          if (!manualPaymentAccountsError) {
            console.log('默认支付账户创建成功');
          }
        }

        return { user, error: null };
      }
      
      throw new Error(`Failed to create user and household: ${rpcError.message}`);
    }

    if (!householdId) {
      throw new Error('注册失败：未创建家庭账户');
    }

    console.log('User and household created via RPC, household ID:', householdId);

    // 创建默认分类
    console.log('Creating default categories');
    const { error: categoriesError } = await supabase.rpc('create_default_categories', {
      p_household_id: householdId,
    });

    if (categoriesError) {
      console.warn('RPC创建默认分类失败，尝试手动创建:', categoriesError);
      // 如果RPC失败，手动创建默认分类
      const { error: manualCategoriesError } = await supabase.from('categories').insert([
        { household_id: householdId, name: '食品', color: '#FF6B6B', is_default: true },
        { household_id: householdId, name: '外餐', color: '#4ECDC4', is_default: true },
        { household_id: householdId, name: '居家', color: '#45B7D1', is_default: true },
        { household_id: householdId, name: '交通', color: '#FFA07A', is_default: true },
        { household_id: householdId, name: '购物', color: '#98D8C8', is_default: true },
        { household_id: householdId, name: '医疗', color: '#F7DC6F', is_default: true },
        { household_id: householdId, name: '教育', color: '#BB8FCE', is_default: true },
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

    const user: User = {
      id: authData.user.id,
      email: email,
      householdId: householdId,
    };

    return { user, error: null };
  } catch (error) {
    console.error('Error signing up:', error);
    return {
      user: null,
      error: error instanceof Error ? error : new Error('注册失败'),
    };
  }
}

// 登录
export async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 提供更友好的错误消息
      if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
        throw new Error('Email not confirmed: Please check your email and click the confirmation link.\n\nIf in development environment, you can disable email confirmation in Supabase Dashboard.');
      }
      throw error;
    }
    return { error: null };
  } catch (error) {
    console.error('Error signing in:', error);
    return {
      error: error instanceof Error ? error : new Error('登录失败'),
    };
  }
}

// 登出
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      error: error instanceof Error ? error : new Error('登出失败'),
    };
  }
}

// 检查是否已登录
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

