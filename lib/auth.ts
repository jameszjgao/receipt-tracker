import { supabase } from './supabase';
import { User, Household, UserHousehold } from '@/types';
import { createDefaultCategoriesAndAccounts } from './auth-helper';
import Constants from 'expo-constants';
import { getCachedUser, updateCachedUser, getCachedHousehold, updateCachedHousehold } from './auth-cache';

// 获取当前用户（优先使用缓存）
export async function getCurrentUser(forceRefresh: boolean = false): Promise<User | null> {
  // 如果强制刷新或缓存未初始化，从数据库读取
  if (!forceRefresh) {
    const cached = getCachedUser();
    if (cached) {
      return cached;
    }
  }

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      updateCachedUser(null);
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // 如果用户记录不存在，尝试创建（可能是新注册的用户，users 表记录还未创建）
    if (error || !data) {
      // 尝试创建用户记录
      // 尝试从 user_metadata 中获取用户名（注册时通过 data 参数传递）
      const userNameFromMetadata = authUser.user_metadata?.name;
      const userName = userNameFromMetadata || authUser.email?.split('@')[0] || 'User';
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          name: userName,
          current_household_id: null,
        });
      
      if (insertError) {
        // 如果插入失败，可能是记录已存在（并发情况），再次查询
        const { data: retryData, error: retryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (retryError || !retryData) {
          console.error('Error getting/creating user:', insertError || retryError);
          updateCachedUser(null);
          return null;
        }
        
        // 使用重试查询到的数据
        const user: User = {
          id: retryData.id,
          email: retryData.email,
          name: retryData.name,
          householdId: retryData.current_household_id || null,
          currentHouseholdId: retryData.current_household_id,
          createdAt: retryData.created_at,
        };
        updateCachedUser(user);
        return user;
      }
      
      // 插入成功，重新查询
      const { data: newData, error: newError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (newError || !newData) {
        console.error('Error getting newly created user:', newError);
        updateCachedUser(null);
        return null;
      }
      
      const user: User = {
        id: newData.id,
        email: newData.email,
        name: newData.name,
        householdId: newData.current_household_id || null,
        currentHouseholdId: newData.current_household_id,
        createdAt: newData.created_at,
      };
      updateCachedUser(user);
      return user;
    }

    // 使用 current_household_id（household_id 字段已删除）
    const user: User = {
      id: data.id,
      email: data.email,
      name: data.name,
      householdId: data.current_household_id || null, // 返回当前活动的家庭ID
      currentHouseholdId: data.current_household_id,
      createdAt: data.created_at,
    };

    // 更新缓存
    updateCachedUser(user);
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    updateCachedUser(null);
    return null;
  }
}

// 获取当前用户的家庭信息（优先使用缓存）
export async function getCurrentHousehold(forceRefresh: boolean = false): Promise<Household | null> {
  // 如果强制刷新或缓存未初始化，从数据库读取
  if (!forceRefresh) {
    const cached = getCachedHousehold();
    if (cached) {
      return cached;
    }
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      updateCachedHousehold(null);
      return null;
    }

    // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      updateCachedHousehold(null);
      return null;
    }

    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single();

    if (error) throw error;
    if (!data) {
      updateCachedHousehold(null);
      return null;
    }

    const household: Household = {
      id: data.id,
      name: data.name,
      address: data.address,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // 更新缓存
    updateCachedHousehold(household);
    return household;
  } catch (error) {
    console.error('Error getting current household:', error);
    updateCachedHousehold(null);
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

    // 确保用户记录存在（如果不存在则创建）
    const user = await getCurrentUser();
    if (!user) {
      // 用户记录不存在，尝试创建
      const userNameFromMetadata = authUser.user_metadata?.name;
      const userName = userNameFromMetadata || authUser.email?.split('@')[0] || 'User';
      
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          name: userName,
          current_household_id: null,
        });
      
      if (userInsertError) {
        // 如果创建用户记录失败（可能是 RLS 错误），返回友好错误
        console.log('User record creation failed, this may require email confirmation:', userInsertError.code);
        return { 
          household: null, 
          error: new Error('Please confirm your email first, then try creating a household again.') 
        };
      }
    }

    // 验证认证状态
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No active session when trying to create household');
      return { 
        household: null, 
        error: new Error('Not authenticated: Please sign in again') 
      };
    }
    
    console.log('Session info:', {
      userId: session.user.id,
      userEmail: session.user.email,
      accessToken: session.access_token ? 'Present' : 'Missing',
    });

    // 创建家庭
    const insertData: { name: string; address?: string } = { name };
    if (address && address.trim()) {
      insertData.address = address.trim();
    }
    
    // 添加详细的调试信息
    console.log('Attempting to create household:', {
      name: insertData.name,
      address: insertData.address,
      userId: authUser.id,
      userEmail: authUser.email,
      hasSession: !!session,
    });
    
    const { data: householdData, error: householdError } = await supabase
      .from('households')
      .insert(insertData)
      .select()
      .single();

    if (householdError) {
      // 详细记录错误信息
      console.error('Household creation error details:', {
        code: householdError.code,
        message: householdError.message,
        details: householdError.details,
        hint: householdError.hint,
        userId: authUser.id,
        userEmail: authUser.email,
      });
      
      // 如果是 RLS 错误，提供详细的错误信息和修复建议
      if (householdError.code === '42501' || householdError.message?.includes('row-level security') || householdError.message?.includes('permission denied')) {
        console.error('=== RLS POLICY ERROR DETAILS ===');
        console.error('Error Code:', householdError.code);
        console.error('Error Message:', householdError.message);
        console.error('Error Details:', householdError.details);
        console.error('Error Hint:', householdError.hint);
        console.error('Current User ID:', authUser.id);
        console.error('Current User Email:', authUser.email);
        console.error('Has Active Session:', !!session);
        console.error('Session User ID:', session?.user?.id);
        console.error('================================');
        console.error('Troubleshooting steps:');
        console.error('1. Check if RLS is enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = \'households\';');
        console.error('2. Check if policy exists: SELECT * FROM pg_policies WHERE tablename = \'households\' AND cmd = \'INSERT\';');
        console.error('3. Verify policy roles: Should include \'authenticated\' or \'public\'');
        console.error('4. Verify WITH CHECK clause: Should be \'true\'');
        console.error('5. Execute fix-households-insert-direct.sql (for authenticated) or fix-households-insert-public.sql (for public) in Supabase SQL Editor');
        console.error('================================');
        
        return { 
          household: null, 
          error: new Error(
            `无法创建家庭：数据库安全策略错误 (错误代码: ${householdError.code})。` +
            `\n\n请执行以下脚本之一修复 RLS 策略：` +
            `\n1. fix-households-insert-direct.sql (使用 authenticated 角色)` +
            `\n2. fix-households-insert-public.sql (使用 public 角色)` +
            `\n\n错误详情: ${householdError.message}` +
            `\n\n提示: 如果策略已设置为 public 仍然失败，请检查策略是否正确创建，并查看 Supabase SQL Editor 中的验证查询结果。`
          ) 
        };
      }
      
      // 其他错误也记录详细信息
      console.error('Other error when creating household:', householdError);
      throw householdError;
    }
    
    if (!householdData) {
      return { household: null, error: new Error('Failed to create household') };
    }

    // 检查 user_households 关联是否已存在（RPC 函数可能已创建）
    const { data: existingAssociation } = await supabase
      .from('user_households')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('household_id', householdData.id)
      .maybeSingle();

    // 如果关联不存在，创建关联
    if (!existingAssociation) {
      const { error: associationError } = await supabase
        .from('user_households')
        .insert({
          user_id: authUser.id,
          household_id: householdData.id,
          is_admin: true,
        });

      if (associationError) {
        // 如果关联失败，尝试删除刚创建的家庭
        // 注意：删除可能也会失败（RLS 错误），但不影响主要错误信息
        try {
          await supabase.from('households').delete().eq('id', householdData.id);
        } catch (deleteError) {
          console.warn('Failed to cleanup household after association error:', deleteError);
        }
        throw associationError;
      }
    }

    // 设置为当前家庭（RPC 函数可能已设置，但确保设置正确）
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

// 注册新用户（两步注册：第一步只创建用户，不创建家庭）
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
    
    // 准备用户信息，用于在 data 中传递（即使需要邮箱确认也能使用）
    const userNameFinal = userName || email.split('@')[0];
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          // 在 metadata 中存储用户信息，即使需要邮箱确认也能访问
          name: userNameFinal,
          email: email,
        },
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
    
    // 两步注册：只创建用户，不创建家庭
    // 用户将在首次登录时设置家庭或接受邀请
    if (householdName === undefined) {
      console.log('Two-step registration: Creating user without household');
      
      // 如果启用了邮箱确认，authData.user 可能为 null，但 auth.users 记录已经创建
      // 我们需要尝试创建 users 表记录
      if (!authData.user) {
        // 注册成功，但需要邮箱确认，auth.users 记录已创建但无法获取 user.id
        // 在这种情况下，用户记录将在邮箱确认时或首次登录时创建
        // 返回需要邮箱确认的标记
        console.log('Email confirmation required: auth.users record created but user.id not available yet');
        return { 
          user: null, 
          error: new Error('EMAIL_CONFIRMATION_REQUIRED') 
        };
      }
      
      console.log('Auth user created:', authData.user.id, authData.user.email);
      
      // 检查 users 表中是否已存在该用户（以防万一）
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, current_household_id, name')
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
        const user: User = {
          id: authData.user.id,
          email: email,
          name: userName && userName.trim() ? userName.trim() : undefined,
          householdId: existingUser.current_household_id || null, // 返回当前活动的家庭ID，如果没有则为 null
          currentHouseholdId: existingUser.current_household_id,
        };
        return { user, error: null };
      }
      
      // 创建用户记录（不设置 current_household_id，等待首次登录时设置）
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          name: userNameFinal,
          current_household_id: null,
        });

      if (userError) {
        console.log('User record creation failed (this is expected if email confirmation is required):', userError.code);
        console.log('Error details:', {
          code: userError.code,
          message: userError.message,
        });
        
        // 如果遇到 RLS 策略问题或其他权限问题，说明可能需要邮箱确认后才能创建 users 表记录
        // 这是正常情况，不抛出错误，返回需要邮箱确认的状态
        // 用户记录将在首次登录时自动创建
        if (userError.code === '42501' || 
            userError.message?.includes('row-level security') || 
            userError.message?.includes('permission denied') ||
            userError.code === '23503' ||
            userError.message?.includes('foreign key constraint')) {
          // 返回需要邮箱确认的状态（即使 authData.user 存在，users 表记录也会在登录时创建）
          return { 
            user: null, 
            error: new Error('EMAIL_CONFIRMATION_REQUIRED') 
          };
        }
        
        // 其他未知错误，也视为需要邮箱确认（保守处理）
        // 用户记录将在首次登录时自动创建
        return { 
          user: null, 
          error: new Error('EMAIL_CONFIRMATION_REQUIRED') 
        };
      }

      console.log('User record created successfully in users table');
      const user: User = {
        id: authData.user.id,
        email: email,
        name: userNameFinal,
        householdId: null,
        currentHouseholdId: null,
      };
      return { user, error: null };
    }

    // 创建家庭和用户记录
    const householdNameFinal = householdName || `${email.split('@')[0]}'s Household`;
    // userNameFinal 已在函数开始处声明（第 338 行），直接使用
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
        // userNameFinal 已在函数开始处声明（第 338 行），直接使用
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            name: userNameFinal,
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

    // 登录成功后，确保 users 表中有用户记录
    // 这对于邮箱确认后首次登录的用户很重要
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', authUser.id)
          .maybeSingle();
        
        // 如果不存在，创建用户记录
        if (!existingUser) {
          // 尝试从 user_metadata 中获取用户名（注册时通过 data 参数传递）
          const userNameFromMetadata = authUser.user_metadata?.name;
          const userName = userNameFromMetadata || authUser.email?.split('@')[0] || 'User';
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              name: userName,
              current_household_id: null,
            });
          
          if (insertError) {
            console.error('Error creating user record after login:', insertError);
            console.error('Error details:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
            });
            // 即使创建失败，也继续登录流程（getCurrentUser 会再次尝试创建）
          } else {
            console.log('User record created successfully after login');
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring user record exists after login:', error);
      // 即使出错，也继续登录流程（getCurrentUser 会再次尝试创建）
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
    
    // 清除缓存
    const { clearAuthCache } = await import('./auth-cache');
    clearAuthCache();
    
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

