import { supabase } from './supabase';
import { getCurrentUser, getCurrentHousehold } from './auth';
import Constants from 'expo-constants';

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  inviterId: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'declined' | 'removed';
  createdAt: string;
  acceptedAt?: string;
  householdName?: string; // 可选的家庭名称字段
  inviterEmail?: string; // 邀请者的email
}

// 创建邀请（极简版本：只使用缓存数据，不查询数据库）
// 业务逻辑：家庭管理员创建邀请，包含自己的id和email（来自缓存）、当前家庭id、被邀请者email、创建时间、状态
export async function createInvitation(inviteeEmail: string): Promise<{ invitation: HouseholdInvitation | null; error: Error | null }> {
  try {
    // 1. 获取认证用户ID（不查询数据库）
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.id) {
      return { invitation: null, error: new Error('Not logged in') };
    }

    // 2. 从缓存获取用户信息（包含当前家庭ID和email）
    const user = await getCurrentUser();
    if (!user) {
      return { invitation: null, error: new Error('User not found in cache') };
    }

    // 3. 使用缓存的当前家庭ID（前端已确保用户是管理员）
    const householdId = user.currentHouseholdId || user.householdId;
    if (!householdId) {
      return { invitation: null, error: new Error('No household selected') };
    }

    // 4. 使用缓存的用户email
    const inviterEmail = user.email || authUser.email || '';
    if (!inviterEmail) {
      return { invitation: null, error: new Error('Inviter email not found') };
    }

    // 5. 准备插入数据（所有数据来自缓存，不查询数据库）
    const createdAt = new Date().toISOString();
    const insertData = {
      household_id: householdId,
      inviter_id: authUser.id, // 来自认证系统
      inviter_email: inviterEmail, // 来自缓存
      invitee_email: inviteeEmail.toLowerCase().trim(), // 用户输入
      status: 'pending', // 自动生成的状态
      created_at: createdAt, // 创建时间
    };

    // 6. 获取家庭名称（从缓存，不查询数据库）
    const household = await getCurrentHousehold();
    const householdName = household?.name || 'a household';

    // 7. 使用 RPC 函数插入邀请记录（绕过 RLS，避免权限问题）
    // 这样就不需要查询数据库，也不会触发 RLS 策略
    const { data: invitationId, error: rpcError } = await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
      p_inviter_id: authUser.id,
      p_inviter_email: inviterEmail,
      p_invitee_email: inviteeEmail.toLowerCase().trim(),
    });

    if (rpcError || !invitationId) {
      console.error('Error creating invitation via RPC:', rpcError);
      // 如果 RPC 函数不存在或失败，回退到直接插入（可能失败）
      console.log('RPC function failed, falling back to direct insert');
      const { data: insertResult, error: insertError } = await supabase
        .from('household_invitations')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError || !insertResult?.id) {
        return {
          invitation: null,
          error: new Error(insertError?.message || rpcError?.message || 'Failed to create invitation'),
        };
      }
      
      const finalInvitationId = insertResult.id;
      
      // 返回邀请信息
      return {
        invitation: {
          id: finalInvitationId,
          householdId: householdId,
          inviterId: authUser.id,
          inviteeEmail: inviteeEmail.toLowerCase().trim(),
          status: 'pending',
          createdAt: createdAt,
          acceptedAt: undefined,
          inviterEmail: inviterEmail,
          householdName: householdName,
        },
        error: null,
      };
    }

    // 8. 发送邀请邮件（异步，不阻塞返回，失败不影响邀请创建）
    sendInvitationEmail(
      inviteeEmail, 
      invitationId,
      false,
      householdId,
      inviterEmail.split('@')[0] || 'Someone',
      householdName
    ).catch(err => {
      console.warn('Failed to send invitation email:', err);
    });

    // 9. 返回邀请信息（使用已知数据，不查询数据库）
    return {
      invitation: {
        id: invitationId,
        householdId: householdId,
        inviterId: authUser.id,
        inviteeEmail: inviteeEmail.toLowerCase().trim(),
        status: 'pending',
        createdAt: createdAt,
        acceptedAt: undefined,
        inviterEmail: inviterEmail,
        householdName: householdName,
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

// 发送邀请邮件（简化版本：使用传入的参数，不查询数据库）
async function sendInvitationEmail(
  email: string, 
  invitationId: string,
  isExistingUser: boolean,
  householdId?: string,
  inviterName?: string,
  householdName?: string // 新增参数，从缓存传入
): Promise<void> {
  try {
    const isDev = Constants.expoConfig?.extra?.supabaseUrl?.includes('localhost') || 
                  process.env.NODE_ENV === 'development';
    const baseUrl = isDev 
      ? 'exp://localhost:8081' // 开发环境
      : 'snapreceipt://'; // 生产环境

    const inviteUrl = `${baseUrl}/invite/${invitationId}`;

    // 使用传入的参数，不查询数据库
    const finalHouseholdName = householdName || 'a household';
    const finalInviterName = inviterName || 'Someone';

    // 尝试调用 Supabase Edge Function 发送邮件
    // 如果 Edge Function 不存在，则使用 Supabase 的邮件功能
    try {
      const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email,
          inviteUrl,
          householdName,
          inviterName: finalInviterName,
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
        inviterName: finalInviterName,
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

// 根据ID获取邀请信息
export async function getInvitationById(invitationId: string): Promise<HouseholdInvitation | null> {
  try {
    const { data, error } = await supabase
      .from('household_invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      householdId: data.household_id,
      inviterId: data.inviter_id,
      inviteeEmail: data.invitee_email,
      status: data.status,
      createdAt: data.created_at,
      acceptedAt: data.accepted_at,
    };
  } catch (error) {
    console.error('Error getting invitation by id:', error);
    return null;
  }
}

// 获取用户待处理的邀请（包含家庭名称）
// 如果查询失败（如 RLS 权限问题），静默返回空数组，不阻塞登录流程
export async function getPendingInvitationsForUser(): Promise<HouseholdInvitation[]> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !authUser.email) return [];

    // 直接使用 auth.users 的 email，避免查询 users 表触发 RLS 权限检查
    // RLS 策略会使用 auth.users 表的 email 来匹配 invitee_email
    const userEmail = authUser.email.toLowerCase();
    if (!userEmail) return [];

    // 直接查询邀请数据（不使用 join，因为 RLS 策略可能阻止 join）
    let data: any[] | null = null;
    let error: any = null;
    
    try {
      const result = await supabase
        .from('household_invitations')
        .select('*')
        .eq('invitee_email', userEmail.toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
      
      // 如果查询失败（权限错误），静默返回空数组，不阻塞登录流程
      if (error) {
        // 如果是权限错误，静默处理，不记录错误日志（避免日志噪音）
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          // 权限错误时，静默返回空数组，不阻塞登录流程
          return [];
        }
        // 其他错误也静默处理
        console.log('Invitations query failed (non-blocking):', error.code);
        return [];
      }
      
      // 如果没有数据，直接返回空数组
      if (!data || data.length === 0) {
        return [];
      }
      
      // 如果查询成功，直接使用 inviter_email 字段（已存储在邀请记录中）
      // 不再需要查询 users 表，避免 RLS 权限问题
      if (data && data.length > 0 && !error) {
        const householdIds = [...new Set(data.map((row: any) => row.household_id))];
        
        console.log('Fetching additional data:', {
          householdIds,
          dataLength: data.length,
        });
        
        // 不再需要查询邀请者信息，因为 inviter_email 已经存储在邀请记录中
        
        // 获取家庭名称（仍然需要查询 households 表）
        let households: any[] = [];
        if (householdIds.length > 0) {
          try {
            const { data: householdsData, error: householdsError } = await supabase
              .from('households')
              .select('id, name')
              .in('id', householdIds);
            
            console.log('Households query result:', {
              hasData: !!householdsData,
              dataLength: householdsData?.length || 0,
              hasError: !!householdsError,
              errorCode: householdsError?.code,
              errorMessage: householdsError?.message,
              households: householdsData,
            });
            
            households = householdsData || [];
          } catch (householdsErr) {
            console.error('Error fetching households:', householdsErr);
            households = [];
          }
        }
        
        // 将家庭名称添加到数据中（inviter_email 已经存储在邀请记录中，不需要合并）
        if (data) {
          data = data.map((row: any) => {
            const household = households.find((h: any) => h.id === row.household_id);
            
            console.log('Merging data for row:', {
              rowId: row.id,
              householdId: row.household_id,
              hasHousehold: !!household,
              householdName: household?.name,
              inviterEmail: row.inviter_email, // 直接使用 inviter_email 字段
            });
            
            return {
              ...row,
              households: household ? { name: household.name } : null,
            };
          });
        }
      }
    } catch (queryError: any) {
      // 查询异常时，静默返回空数组，不阻塞登录流程
      console.log('Invitations query exception (non-blocking):', queryError.message);
      return [];
    }

    // 如果没有数据，直接返回空数组
    if (!data || data.length === 0) {
      return [];
    }

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

      // 直接使用 inviter_email 字段（已存储在邀请记录中，不需要查询 users 表）
      const inviterEmail: string | undefined = row.inviter_email || undefined;

      // 调试日志
      console.log('Invitation data processed:', {
        id: row.id,
        householdName,
        inviterEmail,
        hasHouseholds: !!row.households,
        householdsType: typeof row.households,
        rawHouseholds: row.households,
      });

      const result = {
        id: row.id,
        householdId: row.household_id,
        inviterId: row.inviter_id,
        inviteeEmail: row.invitee_email,
        status: row.status,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at,
        householdName: householdName || undefined, // 添加家庭名称字段
        inviterEmail: inviterEmail || undefined, // 直接使用 inviter_email 字段
      };
      
      console.log('Final invitation result:', result);
      return result;
    });
  } catch (error) {
    console.error('Error getting pending invitations for user:', error);
    return [];
  }
}

// 接受邀请（加入家庭）
export async function acceptInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not logged in') };
    }

    // 获取邀请信息
    const invitation = await getInvitationById(invitationId);
    if (!invitation) {
      return { error: new Error('Invitation not found or expired') };
    }

    if (invitation.status !== 'pending') {
      return { error: new Error('Invitation has already been used or cancelled') };
    }

    // 验证邮箱是否匹配（使用 auth.users，避免查询 users 表触发 RLS 权限问题）
    const userEmail = authUser.email?.toLowerCase();
    if (!userEmail || userEmail !== invitation.inviteeEmail.toLowerCase()) {
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

      // 切换到该家庭（使用 RPC 函数，避免 RLS 权限问题）
      try {
        const { error: rpcError } = await supabase.rpc('update_user_current_household', {
          p_user_id: authUser.id,
          p_household_id: invitation.householdId,
        });
        if (rpcError) {
          // 如果 RPC 函数不存在或失败，回退到直接更新（可能失败）
          console.log('RPC function failed, falling back to direct update:', rpcError);
          await supabase
            .from('users')
            .update({ current_household_id: invitation.householdId })
            .eq('id', authUser.id);
        }
      } catch (updateErr) {
        console.log('Error updating current household:', updateErr);
      }

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

    // 切换到该家庭（使用 RPC 函数，避免 RLS 权限问题）
    try {
      const { error: rpcError } = await supabase.rpc('update_user_current_household', {
        p_user_id: authUser.id,
        p_household_id: invitation.householdId,
      });
      if (rpcError) {
        // 如果 RPC 函数不存在或失败，回退到直接更新（可能失败）
        console.log('RPC function failed, falling back to direct update:', rpcError);
        await supabase
          .from('users')
          .update({ current_household_id: invitation.householdId })
          .eq('id', authUser.id);
      }
    } catch (updateErr) {
      console.log('Error updating current household:', updateErr);
    }

    return { error: null };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to accept invitation'),
    };
  }
}

// 拒绝邀请
export async function declineInvitation(invitationId: string): Promise<{ error: Error | null }> {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return { error: new Error('Not logged in') };
    }

    // 获取邀请信息
    const invitation = await getInvitationById(invitationId);
    if (!invitation) {
      return { error: new Error('Invitation not found or expired') };
    }

    if (invitation.status !== 'pending') {
      return { error: new Error('Invitation has already been used or cancelled') };
    }

    // 验证邮箱是否匹配（使用 auth.users，避免查询 users 表触发 RLS 权限问题）
    const userEmail = authUser.email?.toLowerCase();
    if (!userEmail || userEmail !== invitation.inviteeEmail.toLowerCase()) {
      return { error: new Error('Email does not match invitation') };
    }

    // 更新邀请状态为已拒绝（declined）
    const { error: updateError } = await supabase
      .from('household_invitations')
      .update({ status: 'declined' })
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
    // 直接从 auth.users 获取用户信息，避免查询 users 表
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !authUser.id) {
      return [];
    }

    // 检查用户是否是管理员
    const { data: userHousehold, error: checkError } = await supabase
      .from('user_households')
      .select('is_admin')
      .eq('user_id', authUser.id)
      .eq('household_id', householdId)
      .single();

    if (checkError || !userHousehold?.is_admin) {
      return [];
    }

    // 获取所有邀请（包括pending, declined, cancelled, accepted状态）
    const { data, error } = await supabase
      .from('household_invitations')
      .select('*')
      .eq('household_id', householdId)
      .in('status', ['pending', 'declined', 'cancelled', 'accepted', 'removed'])
      .order('created_at', { ascending: false });

    if (error) {
      // 如果是权限错误，静默处理，不记录错误日志（避免日志噪音）
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        // 权限错误时，静默返回空数组
        return [];
      }
      // 其他错误才记录
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
    // 注意：不查询 users 表，因为 RLS 策略可能阻止查询
    // 直接使用 invitee_email 来过滤，不依赖 users 表
    let existingEmails = new Set<string>();
    // 如果确实需要用户邮箱，可以通过 auth.users 表或其他方式获取
    // 但为了简化，这里暂时跳过，直接使用 invitee_email

    // 不过滤任何邀请，返回所有邀请（包括已加入和已移除的）
    // 在UI中根据状态和是否在user_households中来分类显示
    const filteredData = data;

    return filteredData.map((row: any) => ({
      id: row.id,
      householdId: row.household_id,
      inviterId: row.inviter_id,
      inviteeEmail: row.invitee_email,
      status: row.status,
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
    // 直接从 auth.users 获取用户信息，避免查询 users 表
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !authUser.id) {
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
      .eq('user_id', authUser.id)
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

