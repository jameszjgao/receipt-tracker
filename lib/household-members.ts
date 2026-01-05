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
    const user = await getCurrentUser();
    if (!user) throw new Error('Not logged in');

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) throw new Error('No household selected');

    // 获取家庭中的所有用户关联
    const { data: userHouseholds, error: userHouseholdsError } = await supabase
      .from('user_households')
      .select('user_id, created_at, is_admin')
      .eq('household_id', householdId);

    if (userHouseholdsError) throw userHouseholdsError;
    if (!userHouseholds || userHouseholds.length === 0) return [];

    // 获取所有用户的邮箱和名字
    const userIds = userHouseholds.map(uh => uh.user_id);
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .in('id', userIds);

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
