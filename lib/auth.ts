import { supabase } from './supabase';
import { User, Household, UserHousehold } from '@/types';
import { createDefaultCategoriesAndAccounts } from './auth-helper';
import Constants from 'expo-constants';

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

    // 优先使用 current_household_id，如果没有则使用 household_id（向后兼容）
    const currentHouseholdId = data.current_household_id || data.household_id;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      householdId: currentHouseholdId, // 返回当前活动的家庭ID（优先使用 currentHouseholdId）
      currentHouseholdId: data.current_household_id,
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

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) return null;

    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error getting current household:', error);
    return null;
  }
}

// 获取用户的所有家庭列表
export async function getUserHouseholds(): Promise<UserHousehold[]> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return [];

    const { data, error } = await supabase
      .from('user_households')
      .select(`
        *,
        households (*)
      `)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      householdId: row.household_id,
      household: row.households ? {
        id: row.households.id,
        name: row.households.name,
        address: row.households.address,
        createdAt: row.households.created_at,
        updatedAt: row.households.updated_at,
      } : undefined,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting user households:', error);
    return [];
  }
}

// 设置当前活动的家庭
export async function setCurrentHousehold(householdId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not authenticated') };
    }

    // 验证用户是否属于该家庭
    const { data: association, error: checkError } = await supabase
      .from('user_households')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('household_id', householdId)
      .single();

    if (checkError || !association) {
      return { error: new Error('User does not belong to this household') };
    }

    // 更新用户的当前家庭
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_household_id: householdId })
      .eq('id', authUser.id);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error setting current household:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to set current household'),
    };
  }
}

// 创建新家庭并加入
export async function createHousehold(name: string, address?: string): Promise<{ household: Household | null; error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { household: null, error: new Error('Not authenticated') };
    }

    // 创建家庭
    const insertData: { name: string; address?: string } = { name };
    if (address && address.trim()) {
      insertData.address = address.trim();
    }
    
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .insert(insertData)
      .select()
      .single();

    if (householdError) throw householdError;
    if (!householdData) {
      return { household: null, error: new Error('Failed to create household') };
    }

    // 将用户加入家庭，并设置为管理员（创建者）
    const { error: associationError } = await supabase
      .from('user_households')
      .insert({
        user_id: authUser.id,
        household_id: householdData.id,
        is_admin: true,
      });

    if (associationError) {
      // 如果关联失败，尝试删除刚创建的家庭
      await supabase.from('households').delete().eq('id', householdData.id);
      throw associationError;
    }

    // 设置为当前家庭
    const { error: setCurrentError } = await setCurrentHousehold(householdData.id);
    if (setCurrentError) {
      console.warn('Failed to set as current household:', setCurrentError);
      // 不阻止流程，用户可以稍后手动选择
    }

    // 创建默认分类和账户
    try {
      await createDefaultCategoriesAndAccounts(householdData.id);
    } catch (error) {
      console.warn('Failed to create default categories and accounts:', error);
      // 不阻止流程，用户可以稍后手动创建
    }

    const household: Household = {
      id: householdData.id,
      name: householdData.name,
      address: householdData.address,
      createdAt: householdData.created_at,
      updatedAt: householdData.updated_at,
    };

    return { household, error: null };
  } catch (error) {
    console.error('Error creating household:', error);
    return {
      household: null,
      error: error instanceof Error ? error : new Error('Failed to create household'),
    };
  }
}

// 注册新用户（创建家庭账户）
export async function signUp(email: string, password: string, householdName?: string, userName?: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    // 创建认证用户
    // 注意：如果 Supabase 启用了邮箱确认，注册后需要确认邮箱才能登录
    // 邮箱确认后，用户会被重定向到应用的登录页面
    // 详细配置请参考 EMAIL_CONFIRMATION_SETUP.md
    const isDev = Constants.expoConfig?.extra?.supabaseUrl?.includes('localhost') || 
                  process.env.NODE_ENV === 'development';
    const redirectUrl = isDev 
      ? 'exp://localhost:8081/--/auth/confirm' // 开发环境
      : 'snapreceipt://auth/confirm'; // 生产环境
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
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
      .select('id, household_id, current_household_id, name')
      .eq('id', authData.user.id)
      .maybeSingle();
    
    if (existingUser) {
      // 用户记录已存在，如果提供了用户名，更新用户的name字段
      if (userName && userName.trim()) {
        await supabase
          .from('users')
          .update({ name: userName.trim() })
          .eq('id', authData.user.id);
      }
      const householdIdFinal = existingUser.current_household_id || existingUser.household_id;
      const user: User = {
        id: authData.user.id,
        email: email,
        name: userName && userName.trim() ? userName.trim() : undefined,
        householdId: householdIdFinal || '', // 返回当前活动的家庭ID，如果没有则为空
        currentHouseholdId: existingUser.current_household_id,
      };
      return { user, error: null };
    }

    // 创建家庭和用户记录
    const householdNameFinal = householdName || `${email.split('@')[0]}'s Household`;
    const userNameFinal = userName || email.split('@')[0];
    console.log('Creating household and user via RPC:', householdNameFinal, 'User Name:', userNameFinal);
    
    const { data: householdId, error: rpcError } = await supabase.rpc('create_user_with_household', {
      p_user_id: authData.user.id,
      p_email: email,
      p_household_name: householdNameFinal,
      p_user_name: userNameFinal,
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
        const userNameFinal = userName || email.split('@')[0];
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            name: userNameFinal,
            household_id: householdData.id,
            current_household_id: householdData.id,
          });

        if (userError) {
          console.error('User creation error:', userError);
          throw new Error(`Failed to create user record: ${userError.message}`);
        }
        
        console.log('User and household created via direct insert');
        
        // 创建 user_households 关联记录
        const { error: associationError } = await supabase
          .from('user_households')
          .insert({
            user_id: authData.user.id,
            household_id: householdData.id,
          });

        if (associationError) {
          console.warn('Failed to create user_household association:', associationError);
        }
        
        // 创建默认分类和支付账户
        await createDefaultCategoriesAndAccounts(householdData.id);

        const user: User = {
          id: authData.user.id,
          email: email,
          name: userName && userName.trim() ? userName.trim() : undefined,
          householdId: householdData.id,
          currentHouseholdId: householdData.id,
        };

        return { user, error: null };
      }
      
      throw new Error(`Failed to create user and household: ${rpcError.message}`);
    }

    if (!householdId) {
      throw new Error('Registration failed: Household account not created');
    }

    console.log('User and household created via RPC, household ID:', householdId);

    // 创建默认分类和支付账户
    await createDefaultCategoriesAndAccounts(householdId);

    // 创建 user_households 关联记录（如果不存在）
    // 注意：RPC 函数应该已经创建了这个记录，但为了保险起见，我们在这里也创建
    const { error: associationError } = await supabase
      .from('user_households')
      .insert({
        user_id: authData.user.id,
        household_id: householdId,
        is_admin: true, // Creator is admin
      })
      .select();
      
    if (associationError) {
      // 如果记录已存在（由 RPC 创建），这是正常的，不需要报错
      if (!associationError.message?.includes('duplicate') && !associationError.code?.includes('23505')) {
        console.warn('Failed to create user_household association:', associationError);
      }
    }

    // 设置当前家庭和用户名
    const updateData: { current_household_id: string; name?: string } = {
      current_household_id: householdId,
    };
    if (userName && userName.trim()) {
      updateData.name = userName.trim();
    }
    const { error: setCurrentError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authData.user.id);

    if (setCurrentError) {
      console.warn('Failed to set current_household_id/name:', setCurrentError);
    }

    const user: User = {
      id: authData.user.id,
      email: email,
      name: userName && userName.trim() ? userName.trim() : undefined,
      householdId: householdId,
      currentHouseholdId: householdId,
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

