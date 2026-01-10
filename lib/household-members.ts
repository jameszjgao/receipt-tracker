import { supabase } from './supabase';
import { getCurrentUser } from './auth';

export interface HouseholdMember {
  userId: string;
  email: string;
  name?: string;
  lastSignInAt: string | null;
  createdAt: string;
  isAdmin?: boolean;
}

// 获取当前家庭的所有成员
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  try {
    const user = await getCurrentUser(true); // 强制刷新，确保获取最新的householdId
    if (!user) {
      console.error('getHouseholdMembers: Not logged in');
      throw new Error('Not logged in');
    }

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      console.error('getHouseholdMembers: No household selected', {
        currentHouseholdId: user.currentHouseholdId,
        householdId: user.householdId,
      });
      throw new Error('No household selected');
    }

    console.log('getHouseholdMembers: Fetching members for household:', householdId);

    // 获取家庭中的所有用户关联
    // 注意：user_households表的RLS策略应该允许用户查看同一家庭的所有成员
    const { data: userHouseholds, error: userHouseholdsError } = await supabase
      .from('user_households')
      .select('user_id, created_at, is_admin')
      .eq('household_id', householdId);

    if (userHouseholdsError) {
      console.error('getHouseholdMembers: Error fetching user_households:', {
        code: userHouseholdsError.code,
        message: userHouseholdsError.message,
        details: userHouseholdsError.details,
      });
      throw userHouseholdsError;
    }
    
    if (!userHouseholds || userHouseholds.length === 0) {
      console.log('getHouseholdMembers: No members found for household:', householdId);
      return [];
    }
    
    console.log('getHouseholdMembers: Found', userHouseholds.length, 'members in user_households');

    // 获取所有用户的邮箱和名字
    // 优先使用 RPC 函数绕过 RLS 限制
    let users: any[] = [];
    let usersError: any = null;
    
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_household_member_users', {
          p_household_id: householdId
        });
      
      if (!rpcError && rpcData) {
        users = rpcData;
        console.log('✅ Successfully fetched household members via RPC:', users.length);
      } else if (rpcError) {
        // 如果 RPC 函数不存在或失败，检查是否是函数不存在错误
        const isFunctionNotFound = rpcError.code === '42883' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist');
        if (isFunctionNotFound) {
          console.warn('⚠️  RPC function get_household_member_users not found. Please execute create-users-rpc-functions.sql');
        } else {
          console.error('❌ RPC function get_household_member_users failed:', rpcError);
        }
        // 回退到直接查询（会失败，因为 RLS 策略问题）
        console.log('⚠️  Falling back to direct query (may fail due to RLS)...');
        const userIds = userHouseholds.map(uh => uh.user_id);
        const { data: queryData, error: queryError } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', userIds);
        users = queryData || [];
        usersError = queryError;
        if (queryError) {
          console.error('❌ Direct query also failed:', queryError);
        }
      }
    } catch (rpcErr: any) {
      // RPC 函数可能不存在，回退到直接查询
      console.error('❌ RPC function exception:', rpcErr);
      const userIds = userHouseholds.map(uh => uh.user_id);
      const { data: queryData, error: queryError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', userIds);
      users = queryData || [];
      usersError = queryError;
    }

    if (usersError) throw usersError;

    // 尝试通过 RPC 函数获取最后登录时间
    let membersWithLastSignIn: Array<{ user_id: string; email: string; last_sign_in_at: string | null }> = [];
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_household_members_with_last_signin', {
        p_household_id: householdId,
      });

      if (!rpcError && rpcData) {
        membersWithLastSignIn = rpcData;
      }
    } catch (e) {
      console.log('RPC function not available, using basic query:', e);
    }

    // 构建成员列表
    const members: HouseholdMember[] = userHouseholds.map(uh => {
      const userInfo = users?.find(u => u.id === uh.user_id);
      const rpcInfo = membersWithLastSignIn.find(r => r.user_id === uh.user_id);
      
      return {
        userId: uh.user_id,
        email: userInfo?.email || 'Unknown',
        name: userInfo?.name || undefined,
        lastSignInAt: rpcInfo?.last_sign_in_at || null,
        createdAt: uh.created_at,
        isAdmin: uh.is_admin || false,
      };
    });

    return members;
  } catch (error) {
    console.error('Error getting household members:', error);
    throw error;
  }
}
