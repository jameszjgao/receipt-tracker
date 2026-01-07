import { supabase } from './supabase';
import { getCurrentUser } from './auth';
import Constants from 'expo-constants';

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  inviterId: string;
  inviteeEmail: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
  householdName?: string; // 可选的家庭名称字段
}

// 生成邀请token
function generateInvitationToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// 创建邀请
export async function createInvitation(inviteeEmail: string): Promise<{ invitation: HouseholdInvitation | null; error: Error | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { invitation: null, error: new Error('Not logged in') };
    }

    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      return { invitation: null, error: new Error('No household selected') };
    }

    // 检查用户是否是管理员
    const { data: userHousehold, error: checkError } = await supabase
      .from('user_households')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .single();

    if (checkError || !userHousehold?.is_admin) {
      return { invitation: null, error: new Error('Only admins can invite members') };
    }

    // 检查被邀请者是否已经是家庭成员
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', inviteeEmail.toLowerCase().trim())
      .single();

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('user_households')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('household_id', householdId)
        .single();

      if (existingMember) {
        return { invitation: null, error: new Error('User is already a member of this household') };
      }
    }

    // 检查是否有未过期的邀请
    const { data: existingInvitation } = await supabase
      .from('household_invitations')
      .select('id')
      .eq('household_id', householdId)
      .eq('invitee_email', inviteeEmail.toLowerCase().trim())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvitation) {
      return { invitation: null, error: new Error('An invitation has already been sent to this email') };
    }

    // 创建邀请
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

    const { data, error } = await supabase
      .from('household_invitations')
      .insert({
        household_id: householdId,
        inviter_id: user.id,
        invitee_email: inviteeEmail.toLowerCase().trim(),
        token: token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 发送邀请邮件
    await sendInvitationEmail(inviteeEmail, token, existingUser !== null);

    return {
      invitation: {
        id: data.id,
        householdId: data.household_id,
        inviterId: data.inviter_id,
        inviteeEmail: data.invitee_email,
        token: data.token,
        status: data.status,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        acceptedAt: data.accepted_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return {
      invitation: null,
      error: error instanceof Error ? error : new Error('Failed to create invitation'),
    };
  }
}

// 发送邀请邮件（通过 Supabase Edge Function 或直接调用邮件服务）
async function sendInvitationEmail(email: string, token: string, isExistingUser: boolean): Promise<void> {
  try {
    const isDev = Constants.expoConfig?.extra?.supabaseUrl?.includes('localhost') || 
                  process.env.NODE_ENV === 'development';
    const baseUrl = isDev 
      ? 'exp://localhost:8081' // 开发环境
      : 'snapreceipt://'; // 生产环境

    const inviteUrl = `${baseUrl}/invite/${token}`;

    // 获取邀请者信息
    const user = await getCurrentUser();
    if (!user) return;

    const { data: household } = await supabase
      .from('households')
      .select('name')
      .eq('id', user.currentHouseholdId || user.householdId)
      .single();

    const householdName = household?.name || 'a household';
    const inviterName = user.name || user.email.split('@')[0];

    // 尝试调用 Supabase Edge Function 发送邮件
    // 如果 Edge Function 不存在，则使用 Supabase 的邮件功能
    try {
      const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email,
          inviteUrl,
          householdName,
          inviterName,
          isExistingUser,
        },
      });

      if (!edgeFunctionError) {
        return;
      }
    } catch (edgeError) {
    }

    // 备选方案：使用 Supabase 的邮件功能（需要配置 SMTP）
    // 注意：Supabase 的邮件功能主要用于认证邮件，可能不支持自定义邮件
    // 这里我们使用 Supabase Auth 的邮件功能作为备选
    try {
      // 如果 Supabase 配置了自定义邮件模板，可以在这里调用
      // 否则，我们需要手动发送邮件
      console.log('Invitation email details:', {
        to: email,
        inviteUrl,
        householdName,
        inviterName,
        isExistingUser,
      });

      // 在实际生产环境中，建议：
      // 1. 创建 Supabase Edge Function 来发送邮件
      // 2. 或者集成第三方邮件服务（SendGrid, AWS SES, Resend 等）
      // 3. 或者使用 Supabase 的邮件功能（如果已配置自定义模板）

      // 临时方案：显示邀请链接（开发/测试用）
      if (isDev) {
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // 不抛出错误，因为邀请记录已创建，用户可以稍后手动分享链接
    }
  } catch (error) {
    console.error('Error sending invitation email:', error);
    // 不抛出错误，因为邀请记录已创建
  }
}

// 根据token获取邀请信息
export async function getInvitationByToken(token: string): Promise<HouseholdInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('household_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    if (!data) return null;

    // 检查是否过期
    if (new Date(data.expires_at) < new Date() && data.status === 'pending') {
      // 自动更新为过期状态
      await supabase
        .from('household_invitations')
        .update({ status: 'expired' })
        .eq('id', data.id);
      return null;
    }

    return {
      id: data.id,
      householdId: data.household_id,
      inviterId: data.inviter_id,
      inviteeEmail: data.invitee_email,
      token: data.token,
      status: data.status,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      acceptedAt: data.accepted_at,
    };
  } catch (error) {
    console.error('Error getting invitation by token:', error);
    return null;
  }
}

// 获取用户待处理的邀请（包含家庭名称）
export async function getPendingInvitationsForUser(): Promise<HouseholdInvitation[]> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !authUser.email) return [];

    // 优先从 users 表获取 email，如果不存在或查询失败则使用 auth 用户的 email
    let userEmail = authUser.email;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (userData?.email) {
        userEmail = userData.email;
      }
    } catch (userQueryError) {
      // 使用 auth 用户的 email 继续
    }
    if (!userEmail) return [];

    // 通过 join 查询邀请和家庭信息
    // 如果 join 查询失败（可能是 RLS 策略问题），尝试只查询邀请，不 join 家庭信息
    let data: any[] | null = null;
    let error: any = null;
    
    try {
      const result = await supabase
        .from('household_invitations')
        .select(`
          *,
          households (
            id,
            name
          )
        `)
        .eq('invitee_email', userEmail.toLowerCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
    } catch (joinError: any) {
      // 如果 join 查询失败（可能是 RLS 策略问题），尝试只查询邀请表
      try {
        const fallbackResult = await supabase
          .from('household_invitations')
          .select('*')
          .eq('invitee_email', userEmail.toLowerCase())
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      } catch (fallbackError) {
        return [];
      }
    }

    if (error) {
      // 如果是权限错误，记录详细信息
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.error('Permission error getting invitations');
      } else {
        console.error('Error getting pending invitations:', error);
      }
      return [];
    }

    if (!data) return [];

    return data.map((row: any) => {
      // 提取家庭名称（可能是对象或数组）
      let householdName: string | undefined = undefined;
      if (row.households) {
        if (Array.isArray(row.households) && row.households.length > 0) {
          householdName = row.households[0].name;
        } else if (typeof row.households === 'object' && row.households.name) {
          householdName = row.households.name;
        }
      }

      return {
        id: row.id,
        householdId: row.household_id,
        inviterId: row.inviter_id,
        inviteeEmail: row.invitee_email,
        token: row.token,
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at,
        householdName: householdName, // 添加家庭名称字段
      };
    });
  } catch (error) {
    console.error('Error getting pending invitations for user:', error);
    return [];
  }
}

// 接受邀请（加入家庭）
export async function acceptInvitation(token: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not logged in') };
    }

    // 获取邀请信息
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      return { error: new Error('Invitation not found or expired') };
    }

    if (invitation.status !== 'pending') {
      return { error: new Error('Invitation has already been used or cancelled') };
    }

    // 验证邮箱是否匹配
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', authUser.id)
      .single();

    if (!userData || userData.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
      return { error: new Error('Email does not match invitation') };
    }

    // 检查用户是否已经是该家庭的成员
    const { data: existingMember } = await supabase
      .from('user_households')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('household_id', invitation.householdId)
      .single();

    if (existingMember) {
      // 用户已经是成员，只更新邀请状态
      await supabase
        .from('household_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      // 切换到该家庭
      await supabase
        .from('users')
        .update({ current_household_id: invitation.householdId })
        .eq('id', authUser.id);

      return { error: null };
    }

    // 添加用户到家庭
    const { error: insertError } = await supabase
      .from('user_households')
      .insert({
        user_id: authUser.id,
        household_id: invitation.householdId,
        is_admin: false,
      });

    if (insertError) throw insertError;

    // 更新邀请状态
    const { error: updateError } = await supabase
      .from('household_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    // 切换到该家庭
    await supabase
      .from('users')
      .update({ current_household_id: invitation.householdId })
      .eq('id', authUser.id);

    return { error: null };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to accept invitation'),
    };
  }
}

// 拒绝邀请
export async function declineInvitation(token: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not logged in') };
    }

    // 获取邀请信息
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      return { error: new Error('Invitation not found or expired') };
    }

    if (invitation.status !== 'pending') {
      return { error: new Error('Invitation has already been used or cancelled') };
    }

    // 验证邮箱是否匹配
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', authUser.id)
      .single();

    if (!userData || userData.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
      return { error: new Error('Email does not match invitation') };
    }

    // 更新邀请状态为已取消
    const { error: updateError } = await supabase
      .from('household_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error declining invitation:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to decline invitation'),
    };
  }
}

// 获取家庭的所有邀请（管理员使用）
export async function getHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    // 检查用户是否是管理员
    const { data: userHousehold, error: checkError } = await supabase
      .from('user_households')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .single();

    if (checkError || !userHousehold?.is_admin) {
      return [];
    }

    // 获取所有邀请（包括pending, cancelled, accepted状态）
    const { data, error } = await supabase
      .from('household_invitations')
      .select('*')
      .eq('household_id', householdId)
      .in('status', ['pending', 'cancelled', 'accepted'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting household invitations:', error);
      return [];
    }

    if (!data) return [];

    // 获取已经加入家庭的用户邮箱列表
    const { data: existingMembers } = await supabase
      .from('user_households')
      .select('user_id')
      .eq('household_id', householdId);

    const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || []);

    // 获取用户邮箱
    let existingEmails = new Set<string>();
    if (existingUserIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('email, id')
        .in('id', Array.from(existingUserIds));
      
      existingEmails = new Set(users?.map(u => u.email.toLowerCase()) || []);
    }

    // 不过滤任何邀请，返回所有邀请（包括已加入和已移除的）
    // 在UI中根据状态和是否在user_households中来分类显示
    const filteredData = data;

    return filteredData.map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
    }));
  } catch (error) {
    console.error('Error getting household invitations:', error);
    return [];
  }
}

// 撤销邀请（管理员使用）
export async function cancelInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: new Error('Not logged in') };
    }

    // 获取邀请信息
    const { data: invitation, error: fetchError } = await supabase
      .from('household_invitations')
      .select('household_id, status')
      .eq('id', invitationId)
      .single();

    if (fetchError || !invitation) {
      return { error: new Error('Invitation not found') };
    }

    if (invitation.status !== 'pending') {
      return { error: new Error('Can only cancel pending invitations') };
    }

    // 检查用户是否是管理员
    const { data: userHousehold, error: checkError } = await supabase
      .from('user_households')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('household_id', invitation.household_id)
      .single();

    if (checkError || !userHousehold?.is_admin) {
      return { error: new Error('Only admins can cancel invitations') };
    }

    // 更新邀请状态为已取消
    const { error: updateError } = await supabase
      .from('household_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (updateError) throw updateError;

    return { error: null };
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to cancel invitation'),
    };
  }
}

