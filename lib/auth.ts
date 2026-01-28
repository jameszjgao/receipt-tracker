import { supabase, validateSupabaseConfig } from './supabase';
import { User, Space, UserSpace } from '@/types';
import { createDefaultCategoriesAndAccounts } from './auth-helper';
import Constants from 'expo-constants';
import { getCachedUser, updateCachedUser, getCachedSpace, updateCachedSpace } from './auth-cache';

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

    // 优先使用 RPC 函数绕过 RLS 限制
    let data: any = null;
    let error: any = null;
    
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_user_by_id', { p_user_id: authUser.id });
      
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        // RPC 函数返回数组，取第一个元素
        data = rpcData[0];
      } else if (rpcError) {
        // RPC 函数出错，回退到直接查询
        console.log('RPC function failed, falling back to direct query:', rpcError);
        const { data: queryData, error: queryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        data = queryData;
        error = queryError;
      } else {
        // RPC 函数返回空结果，回退到直接查询
        const { data: queryData, error: queryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        data = queryData;
        error = queryError;
      }
    } catch (rpcErr) {
      // RPC 函数可能不存在，回退到直接查询
      console.log('RPC function not available, using direct query:', rpcErr);
      const { data: queryData, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      
      data = queryData;
      error = queryError;
    }

    // 如果是权限错误，记录错误信息
    if (error) {
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.error('Permission error accessing users table');
        updateCachedUser(null);
        return null;
      }
    }

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
          current_space_id: null,
        });
      
      if (insertError) {
        // 如果是重复键错误（用户已存在），静默处理，直接查询
        const errorCode = String(insertError.code || '');
        const isDuplicateKey = errorCode === '23505' || 
                               insertError.message?.includes('duplicate key') ||
                               insertError.message?.includes('unique constraint');
        
        // 如果插入失败，可能是记录已存在（并发情况），再次查询
        const { data: retryData, error: retryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (retryError || !retryData) {
          // 只有在不是重复键错误时才记录错误
          if (!isDuplicateKey) {
            console.error('Error getting/creating user:', insertError || retryError);
          }
          updateCachedUser(null);
          return null;
        }
        
        // 使用重试查询到的数据
        const user: User = {
          id: retryData.id,
          email: retryData.email,
          name: retryData.name,
          spaceId: retryData.current_space_id || null,
          currentSpaceId: retryData.current_space_id,
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
        spaceId: newData.current_space_id || null,
        currentSpaceId: newData.current_space_id,
        createdAt: newData.created_at,
      };
      updateCachedUser(user);
      return user;
    }

    // 使用 current_space_id（space_id 字段已删除）
    const user: User = {
      id: data.id,
      email: data.email,
      name: data.name,
      spaceId: data.current_space_id || null, // 返回当前活动的空间ID
      currentSpaceId: data.current_space_id,
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
export async function getCurrentSpace(forceRefresh: boolean = false): Promise<Space | null> {
  // 如果强制刷新或缓存未初始化，从数据库读取
  if (!forceRefresh) {
    const cached = getCachedSpace();
    if (cached) {
      return cached;
    }
  }

  try {
    // 尝试获取用户信息，如果失败（权限错误）则返回 null
    let user: User | null = null;
    try {
      user = await getCurrentUser();
    } catch (userError: any) {
      // 如果是权限错误，记录警告但继续
      if (userError?.code === '42501' || userError?.message?.includes('permission denied')) {
        console.warn('Permission error getting user, RLS policy may need to be fixed:', userError.message);
        updateCachedSpace(null);
        return null;
      }
      // 其他错误继续抛出
      throw userError;
    }
    
    if (!user) {
      updateCachedSpace(null);
      return null;
    }

    // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
    const spaceId = user.currentSpaceId || user.spaceId;
    if (!spaceId) {
      updateCachedSpace(null);
      return null;
    }

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .single();

    if (error) {
      // 如果是权限错误，记录但不抛出
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        updateCachedSpace(null);
        return null;
      }
      throw error;
    }
    
    if (!data) {
      updateCachedSpace(null);
      return null;
    }

    const space: Space = {
      id: data.id,
      name: data.name,
      address: data.address,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    // 更新缓存
    updateCachedSpace(space);
    return space;
  } catch (error) {
    console.error('Error getting current space:', error);
    updateCachedSpace(null);
    return null;
  }
}

// 获取用户的所有空间列表
export async function getUserSpaces(): Promise<UserSpace[]> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      console.log('getUserSpaces: No authenticated user');
      return [];
    }

    console.log('getUserSpaces: Querying for user_id:', authUser.id);

    const { data, error } = await supabase
      .from('user_spaces')
      .select(`
        *,
        spaces (*)
      `)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getUserSpaces: Query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    if (!data) {
      console.log('getUserSpaces: No data returned (null)');
      return [];
    }

    console.log('getUserSpaces: Found', data.length, 'spaces for user', authUser.id);

    const result = data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      spaceId: row.space_id,
      space: row.spaces ? {
        id: row.spaces.id,
        name: row.spaces.name,
        address: row.spaces.address,
        createdAt: row.spaces.created_at,
        updatedAt: row.spaces.updated_at,
      } : undefined,
      createdAt: row.created_at,
    }));

    // 记录每个space的详细信息
    result.forEach((userSpace, index) => {
      console.log(`getUserSpaces: Space ${index + 1}:`, {
        spaceId: userSpace.spaceId,
        spaceName: userSpace.space?.name || 'Unknown',
        hasSpaceData: !!userSpace.space,
      });
    });

    return result;
  } catch (error) {
    console.error('Error getting user spaces:', error);
    // 如果是权限错误，记录详细信息
    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as any;
      if (err.code === '42501' || err.message?.includes('permission denied')) {
        console.error('getUserSpaces: RLS permission error - user may not have access to user_spaces table');
      }
    }
    return [];
  }
}

// 设置当前活动的空间
export async function setCurrentSpace(spaceId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not authenticated') };
    }

    // 验证用户是否属于该空间
    const { data: association, error: checkError } = await supabase
      .from('user_spaces')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('space_id', spaceId)
      .single();

    if (checkError || !association) {
      return { error: new Error('User does not belong to this space') };
    }

    // 更新用户的当前空间
    // 优先使用 RPC 函数绕过 RLS 限制
    let updateError: any = null;
    try {
      const { error: rpcError } = await supabase
        .rpc('update_user_current_space', {
          p_user_id: authUser.id,
          p_space_id: spaceId
        });
      
      if (rpcError) {
        // 检查是否是函数不存在错误
        const isFunctionNotFound = rpcError.code === '42883' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist');
        if (isFunctionNotFound) {
          console.warn('⚠️  RPC function update_user_current_space not found. Please execute create-users-rpc-functions.sql');
        } else {
          console.error('❌ RPC function update_user_current_space failed:', rpcError);
        }
        // 回退到直接更新（会失败，因为 RLS 策略问题）
        console.log('⚠️  Falling back to direct update (may fail due to RLS)...');
        const { error: directError } = await supabase
          .from('users')
          .update({ current_space_id: spaceId })
          .eq('id', authUser.id);
        updateError = directError;
        if (directError) {
          console.error('❌ Direct update also failed:', directError);
        }
      }
    } catch (rpcErr) {
      // RPC 函数可能不存在，回退到直接更新
      console.log('RPC function not available, using direct update:', rpcErr);
      const { error: directError } = await supabase
        .from('users')
        .update({ current_space_id: spaceId })
        .eq('id', authUser.id);
      updateError = directError;
    }

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error setting current space:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to set current space'),
    };
  }
}

// 创建新空间并加入
export async function createSpace(name: string, address?: string): Promise<{ space: Space | null; error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { space: null, error: new Error('Not authenticated') };
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
          current_space_id: null,
        });
      
      if (userInsertError) {
        // 区分不同类型的错误
        const errorCode = String(userInsertError.code || '');
        const isRLSError = errorCode === '42501' || 
                          userInsertError.message?.includes('row-level security') ||
                          userInsertError.message?.includes('permission denied');
        
        if (isRLSError) {
          // RLS 策略错误，返回更准确的错误信息
          console.error('RLS error creating user record:', userInsertError);
          return { 
            space: null, 
            error: new Error(
              '无法创建用户记录：数据库权限错误。\n\n' +
              '这可能是 RLS 策略配置问题。请检查：\n' +
              '1. users 表的 INSERT RLS 策略是否正确\n' +
              '2. 用户是否已通过邮箱确认（如果启用了邮箱确认）\n\n' +
              `错误代码: ${errorCode}\n` +
              `错误信息: ${userInsertError.message}`
            ) 
          };
        } else {
          // 其他错误（如重复键等），尝试再次查询用户记录
          console.warn('User insert error (non-RLS):', userInsertError);
          // 可能是并发创建，尝试再次查询
          const retryUser = await getCurrentUser(true);
          if (!retryUser) {
            return { 
              space: null, 
              error: new Error(
                `无法创建用户记录：${userInsertError.message}\n\n` +
                `错误代码: ${errorCode}`
              ) 
            };
          }
          // 如果重试成功，继续执行
        }
      }
    }

    // 验证认证状态
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No active session when trying to create space');
      return { 
        space: null, 
        error: new Error('Not authenticated: Please sign in again') 
      };
    }
    
    // 解析 JWT token 检查 role（用于调试）
    let tokenRole = 'unknown';
    try {
      if (session.access_token) {
        const tokenParts = session.access_token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          tokenRole = payload.role || 'unknown';
        }
      }
    } catch (e) {
      console.warn('Failed to parse JWT token:', e);
    }
    
    console.log('Session info:', {
      userId: session.user.id,
      userEmail: session.user.email,
      accessToken: session.access_token ? 'Present' : 'Missing',
      tokenRole: tokenRole,
      expiresAt: session.expires_at,
      expiresIn: session.expires_at ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000) : null,
    });

    // 创建家庭
    const insertData: { name: string; address?: string } = { name };
    if (address && address.trim()) {
      insertData.address = address.trim();
    }
    
    // 添加详细的调试信息
    console.log('Attempting to create space:', {
      name: insertData.name,
      address: insertData.address,
      userId: authUser.id,
      userEmail: authUser.email,
      hasSession: !!session,
    });
    
    // 确保 Supabase 客户端使用当前的 session
    // 如果 session 存在但客户端没有使用，尝试刷新
    if (session) {
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (setSessionError) {
        console.warn('Failed to set session:', setSessionError);
      }
    }
    
    // 再次验证 session（确保 token 有效）
    const { data: { session: verifySession }, error: verifyError } = await supabase.auth.getSession();
    if (!verifySession) {
      console.error('Session verification failed:', verifyError);
      return { 
        space: null, 
        error: new Error('Session expired or invalid. Please sign in again.') 
      };
    }
    
    
    // 使用 getUser() 确保获取最新的用户信息和 token（这会自动刷新 token）
    const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
    if (getUserError || !currentUser) {
      console.error('Failed to get current user (token may be expired):', getUserError);
      return { 
        space: null, 
        error: new Error('Authentication token expired. Please sign in again.') 
      };
    }
    
    console.log('Current user verified:', {
      userId: currentUser.id,
      email: currentUser.email,
      matchesAuthUser: currentUser.id === authUser.id,
    });
    
    // 在插入前再次确认 session 和 token
    const { data: { session: finalSession } } = await supabase.auth.getSession();
    if (!finalSession) {
      console.error('Final session check failed - no session');
      return { 
        space: null, 
        error: new Error('Session lost. Please sign in again.') 
      };
    }
    
    console.log('Final session check before insert:', {
      hasAccessToken: !!finalSession.access_token,
      tokenLength: finalSession.access_token?.length || 0,
      expiresAt: finalSession.expires_at,
      expiresIn: finalSession.expires_at ? Math.floor((finalSession.expires_at * 1000 - Date.now()) / 1000) : null,
    });
    
    // 尝试使用 RPC 函数插入（如果存在，可以绕过 RLS）
    // 如果 RPC 函数不存在，会回退到直接插入
    let spaceData = null;
    let spaceError = null;
    
    // 先尝试使用 RPC 函数（如果存在）
    const { data: rpcSpaceId, error: rpcError } = await supabase.rpc('create_space_with_user', {
      p_space_name: insertData.name,
      p_space_address: insertData.address || null,
      p_user_id: currentUser.id,
    });
    
    if (!rpcError && rpcSpaceId) {
      // RPC 成功，查询创建的 space
      const { data: fetchedSpace, error: fetchError } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', rpcSpaceId)
        .single();
      
      if (!fetchError && fetchedSpace) {
        spaceData = fetchedSpace;
      } else {
        spaceError = fetchError;
      }
    } else {
      // RPC 失败或不存在，尝试直接插入
      // 检查是否是函数不存在的错误（42883）还是其他错误
      const isFunctionNotFound = rpcError?.code === '42883' || rpcError?.message?.includes('function') || rpcError?.message?.includes('does not exist');
      
      if (rpcError && !isFunctionNotFound) {
        // RPC 函数存在但执行失败，记录错误但继续尝试直接插入
        console.warn('RPC function error (will try direct insert):', rpcError.message, rpcError.code);
      } else if (isFunctionNotFound) {
        console.log('RPC function not available, trying direct insert...');
      } else {
        console.log('RPC returned no data, trying direct insert...');
      }
      
      // 直接插入 spaces 表
      const insertResult = await supabase
        .from('spaces')
        .insert(insertData)
        .select()
        .single();
      
      spaceData = insertResult.data;
      spaceError = insertResult.error;
      
      // 如果直接插入成功，需要手动创建 user_spaces 关联和更新 current_space_id
      if (!spaceError && spaceData) {
        
        // 创建 user_spaces 关联
        const { error: associationError } = await supabase
          .from('user_spaces')
          .insert({
            user_id: currentUser.id,
            space_id: spaceData.id,
            is_admin: true,
          });
        
        if (associationError) {
          console.error('Failed to create user_spaces association:', associationError);
          // 如果关联失败，尝试删除刚创建的空间
          try {
            await supabase.from('spaces').delete().eq('id', spaceData.id);
            console.warn('Cleaned up space after association error');
          } catch (deleteError) {
            console.warn('Failed to cleanup space after association error:', deleteError);
          }
          spaceError = associationError;
          spaceData = null;
        } else {
          // 更新用户的 current_space_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ current_space_id: spaceData.id })
            .eq('id', currentUser.id);
          
          if (updateError) {
            console.warn('Failed to update current_space_id:', updateError);
            // 不阻止流程，用户可以稍后手动选择
          }
        }
      }
    }
    
    // 如果直接插入失败，记录详细的请求信息
    if (spaceError) {
    }

    if (spaceError) {
      // 详细记录错误信息
      console.error('Space creation error details:', {
        code: spaceError.code,
        message: spaceError.message,
        details: spaceError.details,
        hint: spaceError.hint,
        userId: authUser.id,
        userEmail: authUser.email,
      });
      
      // 如果是 RLS 错误，提供详细的错误信息和修复建议
      if (spaceError.code === '42501' || spaceError.message?.includes('row-level security') || spaceError.message?.includes('permission denied')) {
        
        // 解析 JWT token 检查 role
        let tokenRole = 'unknown';
        try {
          if (session?.access_token) {
            const tokenParts = session.access_token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              tokenRole = payload.role || 'unknown';
            }
          }
        } catch (e) {
          console.error('Failed to parse JWT token:', e);
        }
        
        
        return { 
          space: null, 
          error: new Error(
            `无法创建空间：数据库安全策略错误 (错误代码: ${spaceError.code})。` +
            `\n\n请执行以下脚本之一修复 RLS 策略：` +
            `\n1. fix-households-insert-direct.sql (使用 authenticated 角色)` +
            `\n2. fix-households-insert-public.sql (使用 public 角色)` +
            `\n\n错误详情: ${spaceError.message}` +
            `\n\n提示: 如果策略已设置为 public 仍然失败，请检查策略是否正确创建，并查看 Supabase SQL Editor 中的验证查询结果。`
          ) 
        };
      }
      
      // 其他错误也记录详细信息
      console.error('Other error when creating space:', spaceError);
      throw spaceError;
    }
    
    if (!spaceData) {
      return { space: null, error: new Error('Failed to create space') };
    }

    // 检查 user_spaces 关联是否已存在（RPC 函数可能已创建）
    // 注意：如果使用直接插入，关联已经在上面创建了
    const { data: existingAssociation } = await supabase
      .from('user_spaces')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('space_id', spaceData.id)
      .maybeSingle();

    // 如果关联不存在（RPC 函数可能没有创建），创建关联
    if (!existingAssociation) {
      const { error: associationError } = await supabase
        .from('user_spaces')
        .insert({
          user_id: authUser.id,
          space_id: spaceData.id,
          is_admin: true,
        });

      if (associationError) {
        // 如果关联失败，尝试删除刚创建的空间
        // 注意：删除可能也会失败（RLS 错误），但不影响主要错误信息
        try {
          await supabase.from('spaces').delete().eq('id', spaceData.id);
          console.warn('Cleaned up space after association error');
        } catch (deleteError) {
          console.warn('Failed to cleanup space after association error:', deleteError);
        }
        
        // 返回更友好的错误信息
        return {
          space: null,
          error: new Error(
            `创建空间成功，但关联用户失败。错误代码: ${associationError.code || 'unknown'}\n` +
            `错误信息: ${associationError.message}\n\n` +
            `请检查 user_spaces 表的 INSERT RLS 策略是否正确。`
          ),
        };
      }
    }

    // 设置为当前家庭（RPC 函数可能已设置，但确保设置正确）
    // 如果直接插入时已经更新了，这里会再次更新（不会出错）
    const { error: setCurrentError } = await setCurrentSpace(spaceData.id);
    if (setCurrentError) {
      console.warn('Failed to set as current space:', setCurrentError);
      // 不阻止流程，用户可以稍后手动选择
    }

    // 创建默认分类和账户
    try {
      await createDefaultCategoriesAndAccounts(spaceData.id);
    } catch (error) {
      console.warn('Failed to create default categories and accounts:', error);
      // 不阻止流程，用户可以稍后手动创建
    }

    const space: Space = {
      id: spaceData.id,
      name: spaceData.name,
      address: spaceData.address,
      createdAt: spaceData.created_at,
      updatedAt: spaceData.updated_at,
    };

    return { space, error: null };
  } catch (error) {
    console.error('Error creating space:', error);
    return {
      space: null,
      error: error instanceof Error ? error : new Error('Failed to create space'),
    };
  }
}

// 注册新用户（两步注册：第一步只创建用户，不创建空间）
export async function signUp(email: string, password: string, householdName?: string, userName?: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    // 验证 Supabase 配置
    const config = validateSupabaseConfig();
    if (!config.valid) {
      return {
        user: null,
        error: new Error(
          '网络配置错误：Supabase 未正确配置。\n\n' +
          '请在 EAS Secrets 中设置：\n' +
          '- EXPO_PUBLIC_SUPABASE_URL\n' +
          '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n' +
          '然后重新构建应用。'
        ),
      };
    }

    // 创建认证用户
    // 注意：如果 Supabase 启用了邮箱确认，注册后需要确认邮箱才能登录
    // 邮箱确认后，用户会被重定向到应用的登录页面
    // 详细配置请参考 EMAIL_CONFIRMATION_SETUP.md
    const isDev = Constants.expoConfig?.extra?.supabaseUrl?.includes('localhost') || 
                  process.env.NODE_ENV === 'development';
    const redirectUrl = isDev 
      ? 'exp://localhost:8081/--/auth/confirm' // 开发环境
      : 'vouchap://auth/confirm'; // 生产环境
    
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
    
    // 两步注册：只创建用户，不创建空间
    // 用户将在首次登录时设置家庭或接受邀请
    if (householdName === undefined) {
      
      // 如果启用了邮箱确认，authData.user 可能为 null，但 auth.users 记录已经创建
      // 我们需要尝试创建 users 表记录
      if (!authData.user) {
        // 注册成功，但需要邮箱确认，auth.users 记录已创建但无法获取 user.id
        // 在这种情况下，用户记录将在邮箱确认时或首次登录时创建
        // 返回需要邮箱确认的标记
        return { 
          user: null, 
          error: new Error('EMAIL_CONFIRMATION_REQUIRED') 
        };
      }
      
      
      // 检查 users 表中是否已存在该用户（以防万一）
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, current_space_id, name')
        .eq('id', authData.user!.id)  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
        .maybeSingle();
      
      if (existingUser) {
        // 用户记录已存在，如果提供了用户名，更新用户的name字段
        if (userName && userName.trim()) {
          await supabase
            .from('users')
            .update({ name: userName.trim() })
            .eq('id', authData.user!.id);  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
        }
        const user: User = {
          id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
          email: email,
          name: userName && userName.trim() ? userName.trim() : undefined,
          spaceId: existingUser.current_space_id || null, // 返回当前活动的空间ID，如果没有则为 null
          currentSpaceId: existingUser.current_space_id || undefined,
        };
        return { user, error: null };
      }
      
      // 创建用户记录（不设置 current_space_id，等待首次登录时设置）
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
          email: email,
          name: userNameFinal,
          current_space_id: null,
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

      const user: User = {
        id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
        email: email,
        name: userNameFinal,
        spaceId: null,  // 类型为 string | null
        currentSpaceId: undefined,  // 类型为 string | undefined
      };
      return { user, error: null };
    }

    // 创建空间和用户记录
    // 确保 authData.user 存在
    if (!authData.user) {
      return { 
        user: null, 
        error: new Error('User authentication failed') 
      };
    }
    
    const spaceNameFinal = householdName || `${email.split('@')[0]}'s Space`;
    // userNameFinal 已在函数开始处声明（第 338 行），直接使用
    
    const { data: spaceId, error: rpcError } = await supabase.rpc('create_user_with_space', {
      p_user_id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
      p_email: email,
      p_space_name: spaceNameFinal,
      p_user_name: userNameFinal,
    });

    if (rpcError) {
      console.error('RPC error creating user/space:', rpcError);
      
      // 如果 RPC 函数不存在，回退到直接插入（尝试）
      if (rpcError.message?.includes('function') || rpcError.code === '42883') {
        
        // 尝试直接插入（如果 RLS 策略允许）
        const { data: spaceData, error: spaceError } = await supabase
          .from('spaces')
          .insert({ name: spaceNameFinal })
          .select()
          .single();

        if (spaceError) {
          console.error('Space creation error:', spaceError);
          if (spaceError.message?.includes('row-level security') || spaceError.code === '42501') {
            throw new Error('Database permission error: Unable to create space account. Please execute create-user-function.sql script in Supabase first');
          }
          throw new Error(`Failed to create space account: ${spaceError.message}`);
        }
        
        if (!spaceData) {
          throw new Error('Registration failed: Space account not created');
        }

        // 创建用户记录
        // userNameFinal 已在函数开始处声明（第 338 行），直接使用
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
            email: email,
            name: userNameFinal,
            current_space_id: spaceData.id,
          });

        if (userError) {
          console.error('User creation error:', userError);
          throw new Error(`Failed to create user record: ${userError.message}`);
        }
        
        
        // 创建 user_spaces 关联记录
        const { error: associationError } = await supabase
          .from('user_spaces')
          .insert({
            user_id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
            space_id: spaceData.id,
          });

        if (associationError) {
          console.warn('Failed to create user_space association:', associationError);
        }
        
        // 创建默认分类和支付账户
        await createDefaultCategoriesAndAccounts(spaceData.id);

        const user: User = {
          id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
          email: email,
          name: userName && userName.trim() ? userName.trim() : undefined,
          spaceId: spaceData.id,
          currentSpaceId: spaceData.id,
        };

        return { user, error: null };
      }
      
      throw new Error(`Failed to create user and space: ${rpcError.message}`);
    }

    if (!spaceId) {
      throw new Error('Registration failed: Space account not created');
    }


    // 创建默认分类和支付账户
    await createDefaultCategoriesAndAccounts(spaceId);

    // 创建 user_spaces 关联记录（如果不存在）
    // 注意：RPC 函数应该已经创建了这个记录，但为了保险起见，我们在这里也创建
    const { error: associationError } = await supabase
      .from('user_spaces')
      .insert({
        user_id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
        space_id: spaceId,
        is_admin: true, // Creator is admin
      })
      .select();
      
    if (associationError) {
      // 如果记录已存在（由 RPC 创建），这是正常的，不需要报错
      if (!associationError.message?.includes('duplicate') && !associationError.code?.includes('23505')) {
        console.warn('Failed to create user_space association:', associationError);
      }
    }

    // 设置当前空间和用户名
    const updateData: { current_space_id: string; name?: string } = {
      current_space_id: spaceId,
    };
    if (userName && userName.trim()) {
      updateData.name = userName.trim();
    }
    const { error: setCurrentError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authData.user!.id);  // 使用 ! 断言，因为已经检查过 authData.user 不为 null

    if (setCurrentError) {
      console.warn('Failed to set current_space_id/name:', setCurrentError);
    }

    const user: User = {
      id: authData.user!.id,  // 使用 ! 断言，因为已经检查过 authData.user 不为 null
      email: email,
      name: userName && userName.trim() ? userName.trim() : undefined,
      spaceId: spaceId,
      currentSpaceId: spaceId,
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
    // 验证 Supabase 配置
    const config = validateSupabaseConfig();
    if (!config.valid) {
      return {
        error: new Error(
          '网络配置错误：Supabase 未正确配置。\n\n' +
          '请在 EAS Secrets 中设置：\n' +
          '- EXPO_PUBLIC_SUPABASE_URL\n' +
          '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n' +
          '然后重新构建应用。'
        ),
      };
    }

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
              current_space_id: null,
            });
          
          if (insertError) {
            // 如果是重复键错误（用户已存在），静默忽略
            // 检查错误代码（可能是字符串）和错误消息
            const errorCode = String(insertError.code || '');
            const isDuplicateKey = errorCode === '23505' || 
                                   insertError.message?.includes('duplicate key') ||
                                   insertError.message?.includes('unique constraint');
            
            if (isDuplicateKey) {
              // 用户记录已存在，这是正常的（可能是并发创建），完全静默，不记录任何日志
              // 什么都不做，直接继续
            } else {
              // 其他错误才记录
              console.error('Error creating user record after login:', insertError);
              console.error('Error details:', {
                code: insertError.code,
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
              });
            }
            // 即使创建失败，也继续登录流程（getCurrentUser 会再次尝试创建）
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

// 发送密码重置邮件
export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  try {
    // 验证 Supabase 配置
    const config = validateSupabaseConfig();
    if (!config.valid) {
      return {
        error: new Error(
          '网络配置错误：Supabase 未正确配置。\n\n' +
          '请在 EAS Secrets 中设置：\n' +
          '- EXPO_PUBLIC_SUPABASE_URL\n' +
          '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n' +
          '然后重新构建应用。'
        ),
      };
    }

    // 构建重置密码的重定向 URL
    const isDev = Constants.expoConfig?.extra?.supabaseUrl?.includes('localhost') || 
                  process.env.NODE_ENV === 'development';
    const redirectUrl = isDev 
      ? 'exp://localhost:8081/--/auth/confirm' // 开发环境
      : 'vouchap://auth/confirm'; // 生产环境

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      error: error instanceof Error ? error : new Error('发送密码重置邮件失败'),
    };
  }
}

// 更新密码（用于密码重置后设置新密码）
export async function updatePassword(newPassword: string): Promise<{ error: Error | null }> {
  try {
    // 验证 Supabase 配置
    const config = validateSupabaseConfig();
    if (!config.valid) {
      return {
        error: new Error(
          '网络配置错误：Supabase 未正确配置。\n\n' +
          '请在 EAS Secrets 中设置：\n' +
          '- EXPO_PUBLIC_SUPABASE_URL\n' +
          '- EXPO_PUBLIC_SUPABASE_ANON_KEY\n\n' +
          '然后重新构建应用。'
        ),
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Error updating password:', error);
    return {
      error: error instanceof Error ? error : new Error('更新密码失败'),
    };
  }
}
