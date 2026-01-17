import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, getCurrentHousehold, setCurrentHousehold, getUserHouseholds } from '@/lib/auth';
import { initializeAuthCache } from '@/lib/auth-cache';
import { getPendingInvitationsForUser, acceptInvitation, declineInvitation } from '@/lib/household-invitations';
import { supabase } from '@/lib/supabase';

export default function HandleInvitationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteHouseholdId, setInviteHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [inviterEmail, setInviterEmail] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<Array<{ id: string; householdId: string; name: string; inviterEmail?: string; householdName?: string }>>([]);
  const [currentInvitationIndex, setCurrentInvitationIndex] = useState(0);

  useEffect(() => {
    checkInvitations();
  }, []);

  const checkInvitations = async () => {
    try {
      setLoading(true);
      
      // 尝试获取邀请，如果失败则记录错误但继续流程
      let invitations: any[] = [];
      try {
        invitations = await getPendingInvitationsForUser();
      } catch (invError) {
        console.error('Error getting invitations:', invError);
        // 即使加载邀请失败，也继续流程
      }
      
      if (invitations.length === 0) {
        // 没有邀请，直接继续正常流程，不显示错误页面
        setLoading(false);
        await continueAfterInvitations();
        return;
      }

      // 直接使用邀请数据中的家庭名称和邀请者email（已经在 getPendingInvitationsForUser 中从数据库获取）
      // 不再需要查询households表，因为household_name已经存储在邀请记录中
      const invitationsWithNames: Array<{ id: string; householdId: string; name: string; inviterEmail?: string; householdName?: string }> = [];
      
      for (const invitation of invitations) {
        // 直接使用从数据库获取的household_name，不再查询households表
        const householdName = invitation.householdName || 'Unknown Space';
        
        console.log('Processing invitation:', {
          id: invitation.id,
          householdName: householdName,
          inviterEmail: invitation.inviterEmail,
        });
        
        invitationsWithNames.push({
          id: invitation.id,
          householdId: invitation.householdId,
          name: householdName, // 使用从数据库获取的家庭名称
          inviterEmail: invitation.inviterEmail,
          householdName: householdName, // 保存完整的家庭名称
        });
      }
      
      // 如果没有获取到家庭名称或邀请者email，记录警告
      const invitationsWithoutInfo = invitationsWithNames.filter(inv => inv.name === 'Unknown Space' || !inv.inviterEmail);
      if (invitationsWithoutInfo.length > 0) {
        console.warn('Some invitations missing info:', invitationsWithoutInfo);
      }
      
      // 保存所有邀请并显示第一个
      setPendingInvitations(invitationsWithNames);
      setCurrentInvitationIndex(0);
      setLoading(false);
      showNextInvitation(0, invitationsWithNames);
    } catch (error) {
      console.error('Error checking invitations:', error);
      setLoading(false);
      // 出错时直接继续流程，不显示错误页面
      await continueAfterInvitations();
    }
  };

  const showNextInvitation = (index: number, invitations: Array<{ id: string; householdId: string; name: string; inviterEmail?: string; householdName?: string }>) => {
    if (index < invitations.length) {
      const invitation = invitations[index];
      
      // 调试日志
      console.log('Showing invitation:', {
        index,
        name: invitation.name,
        householdName: invitation.householdName,
        inviterEmail: invitation.inviterEmail,
        householdId: invitation.householdId,
      });
      
      // 使用householdName字段（如果存在），否则使用name字段作为fallback
      setHouseholdName(invitation.householdName || invitation.name || 'Unknown Space');
      setInviterEmail(invitation.inviterEmail || '');
      setInviteId(invitation.id);
      setInviteHouseholdId(invitation.householdId);
      setShowInviteModal(true);
    } else {
      // 所有邀请都处理完了
      setShowInviteModal(false);
      setPendingInvitations([]);
      setCurrentInvitationIndex(0);
      // 继续正常的登录流程
      continueAfterInvitations();
    }
  };

  const continueAfterInvitations = async () => {
    try {
      console.log('continueAfterInvitations: Starting...');
      
      // 检查用户是否有当前家庭（使用缓存，如果缓存未初始化则从数据库读取）
      const user = await getCurrentUser(true); // 强制刷新，确保获取最新的currentHouseholdId
      console.log('continueAfterInvitations: User:', {
        id: user?.id,
        currentHouseholdId: user?.currentHouseholdId,
        householdId: user?.householdId,
      });
      
      if (!user) {
        console.log('continueAfterInvitations: No user, redirecting to setup-household');
        router.replace('/setup-household');
        return;
      }

      // 检查用户是否有家庭（区分新用户和老用户）
      const households = await getUserHouseholds();
      console.log('continueAfterInvitations: Households:', {
        count: households.length,
        householdIds: households.map(h => h.householdId),
      });
      
      // 新用户：没有家庭，跳转到设置家庭页面（创建家庭）
      if (households.length === 0) {
        console.log('continueAfterInvitations: No households, redirecting to setup-household');
        router.replace('/setup-household');
        return;
      }

      // 老用户：有家庭
      // 如果用户已经有当前家庭（currentHouseholdId 或 householdId），直接进入应用（登录到上次登录的家庭）
      // 即使有 pending invitations，也允许用户进入应用（用户可以通过 Later 按钮忽略邀请）
      if (user.currentHouseholdId || user.householdId) {
        const targetHouseholdId = user.currentHouseholdId || user.householdId;
        console.log('continueAfterInvitations: User has current household, redirecting to home (ignoring pending invitations):', targetHouseholdId);
        
        // 确保缓存已更新
        try {
          const updatedHousehold = await getCurrentHousehold(true);
          await initializeAuthCache(user, updatedHousehold);
        } catch (cacheError) {
          console.warn('continueAfterInvitations: Cache update failed, continuing:', cacheError);
        }
        
        router.replace('/');
        return;
      }

      // 老用户：有家庭但没有当前家庭
      if (households.length === 1) {
        // 只有一个家庭，自动设置并进入（这就是上次登录的家庭）
        console.log('continueAfterInvitations: Setting single household:', households[0].householdId);
        await setCurrentHousehold(households[0].householdId);
        
        // 更新缓存（强制刷新，确保获取最新的currentHouseholdId）
        try {
          const updatedUser = await getCurrentUser(true);
          const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
          await initializeAuthCache(updatedUser, updatedHousehold);
          console.log('continueAfterInvitations: Cache updated, redirecting to home');
        } catch (cacheError) {
          console.warn('continueAfterInvitations: Cache update failed, continuing:', cacheError);
        }
        
        router.replace('/');
        return;
      } else {
        // 多个家庭但没有当前家庭，跳转到家庭选择页面
        console.log('continueAfterInvitations: Multiple households, redirecting to household-select');
        router.replace('/household-select');
        return;
      }
    } catch (error) {
      console.error('Error in continueAfterInvitations:', error);
      // 如果出错，默认跳转到设置家庭页面
      router.replace('/setup-household');
    }
  };

  const handleAcceptInvitation = async () => {
    if (!inviteId || !inviteHouseholdId) return;

    setAcceptingInvite(true);
    try {
      const { error } = await acceptInvitation(inviteId);
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to join space');
        setAcceptingInvite(false);
        return;
      }

      // 接受邀请后，自动切换到新加入的家庭
      const { error: switchError } = await setCurrentHousehold(inviteHouseholdId);
      if (switchError) {
        // 即使切换失败，也继续，因为用户已经加入了家庭
      }

      // 更新缓存（不强制刷新，避免权限错误）
      try {
        const updatedUser = await getCurrentUser();
        const updatedHousehold = updatedUser ? await getCurrentHousehold() : null;
        await initializeAuthCache(updatedUser, updatedHousehold);
      } catch (cacheError) {
        // 继续流程，缓存错误不影响主流程
      }

      // 关闭当前邀请对话框
      setShowInviteModal(false);
      setInviteId(null);
      setInviteHouseholdId(null);
      setAcceptingInvite(false);

      // 接受邀请后，直接进入邀请家庭到index（acceptInvitation已经自动设置了当前家庭）
      console.log('handleAcceptInvitation: Invitation accepted, redirecting to index');
      
      // 更新缓存（强制刷新，确保获取最新的currentHouseholdId）
      try {
        const updatedUser = await getCurrentUser(true);
        const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
        await initializeAuthCache(updatedUser, updatedHousehold);
      } catch (cacheError) {
        console.warn('handleAcceptInvitation: Cache update failed, continuing:', cacheError);
      }
      
      // 检查是否还有更多邀请需要处理
      const nextIndex = currentInvitationIndex + 1;
      if (nextIndex < pendingInvitations.length) {
        // 还有更多邀请，显示下一个（但用户已经加入了家庭，可以继续处理其他邀请）
        setCurrentInvitationIndex(nextIndex);
        showNextInvitation(nextIndex, pendingInvitations);
      } else {
        // 所有邀请都处理完了，进入应用（进入邀请家庭）
        setPendingInvitations([]);
        setCurrentInvitationIndex(0);
        router.replace('/');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to join space');
      setAcceptingInvite(false);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!inviteId) {
      setShowInviteModal(false);
      setInviteId(null);
      setInviteHouseholdId(null);
      // 检查是否还有更多邀请
      const nextIndex = currentInvitationIndex + 1;
      if (nextIndex < pendingInvitations.length) {
        setCurrentInvitationIndex(nextIndex);
        showNextInvitation(nextIndex, pendingInvitations);
      } else {
        // 所有邀请都处理完了
        setPendingInvitations([]);
        setCurrentInvitationIndex(0);
        await continueAfterInvitations();
      }
      return;
    }

    try {
      const { error } = await declineInvitation(inviteId);
      if (error) {
        console.error('Error declining invitation:', error);
        // 即使失败也继续处理下一个邀请
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      // 关闭当前邀请对话框
      setShowInviteModal(false);
      setInviteId(null);
      setInviteHouseholdId(null);
      
      // 检查是否还有更多邀请需要处理
      const nextIndex = currentInvitationIndex + 1;
      if (nextIndex < pendingInvitations.length) {
        // 还有更多邀请，显示下一个
        setCurrentInvitationIndex(nextIndex);
        showNextInvitation(nextIndex, pendingInvitations);
      } else {
        // 所有邀请都处理完了
        setPendingInvitations([]);
        setCurrentInvitationIndex(0);
        await continueAfterInvitations();
      }
    }
  };

  const handleLaterInvitation = async () => {
    // 后续处理：关闭对话框，不处理邀请
    // 根据用户类型（新/老）执行不同流程：
    // - 新用户（无家庭）：跳转到创建家庭页面
    // - 老用户（有家庭）：登录到上次登录的家庭
    console.log('handleLaterInvitation: Called');
    
    setShowInviteModal(false);
    setInviteId(null);
    setInviteHouseholdId(null);
    
    // 检查用户是否已有关联家庭
    try {
      const user = await getCurrentUser(true);
      const households = await getUserHouseholds();
      
      // 如果用户已有关联家庭，直接跳转到 index（忽略 pending invitations）
      if (households.length > 0) {
        // 如果有当前家庭，直接进入
        if (user?.currentHouseholdId || user?.householdId) {
          console.log('handleLaterInvitation: User has current household, redirecting to index');
          // 更新缓存
          try {
            const updatedHousehold = await getCurrentHousehold(true);
            await initializeAuthCache(user, updatedHousehold);
          } catch (cacheError) {
            console.warn('handleLaterInvitation: Cache update failed, continuing:', cacheError);
          }
          router.replace('/');
          return;
        }
        
        // 如果只有一个家庭，自动设置并进入
        if (households.length === 1) {
          console.log('handleLaterInvitation: Setting single household and redirecting to index');
          await setCurrentHousehold(households[0].householdId);
          // 更新缓存
          try {
            const updatedUser = await getCurrentUser(true);
            const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
            await initializeAuthCache(updatedUser, updatedHousehold);
          } catch (cacheError) {
            console.warn('handleLaterInvitation: Cache update failed, continuing:', cacheError);
          }
          router.replace('/');
          return;
        }
        
        // 多个家庭，跳转到家庭选择页面
        if (households.length > 1) {
          console.log('handleLaterInvitation: Multiple households, redirecting to household-select');
          router.replace('/household-select');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking user households in handleLaterInvitation:', error);
    }
    
    // 如果没有家庭，继续处理邀请或跳转到 setup-household
    // 检查是否还有更多邀请
    const nextIndex = currentInvitationIndex + 1;
    if (nextIndex < pendingInvitations.length) {
      // 还有更多邀请，显示下一个
      console.log('handleLaterInvitation: More invitations, showing next');
      setCurrentInvitationIndex(nextIndex);
      showNextInvitation(nextIndex, pendingInvitations);
    } else {
      // 所有邀请都处理完了，跳转到 setup-household（新用户需要创建家庭）
      console.log('handleLaterInvitation: All invitations processed, redirecting to setup-household');
      setPendingInvitations([]);
      setCurrentInvitationIndex(0);
      router.replace('/setup-household');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>Loading invitations...</Text>
        </View>
      </View>
    );
  }

  // 移除错误页面，如果没有邀请或加载失败，直接继续流程
  // continueAfterInvitations 会在 checkInvitations 中自动调用

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 邀请确认浮窗 - 支持层叠卡片 */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeclineInvitation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentContainer}>
            {/* 如果有多个邀请，显示层叠卡片效果 */}
            {pendingInvitations.length > 1 && currentInvitationIndex < pendingInvitations.length - 1 && (
              <View style={styles.stackedCardsWrapper}>
                {pendingInvitations.slice(currentInvitationIndex + 1, Math.min(currentInvitationIndex + 4, pendingInvitations.length)).map((invitation, index) => (
                  <View
                    key={invitation.id}
                    style={[
                      styles.stackedCardBack,
                      {
                        transform: [
                          { translateY: (index + 1) * 8 },
                          { scale: 1 - (index + 1) * 0.05 },
                        ],
                        zIndex: -index - 1,
                        opacity: 0.5 - index * 0.15,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            
            {/* 当前邀请卡片 */}
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                {/* 顶部一行：左箭头、icon+序号、右箭头 */}
                <View style={styles.modalHeaderTop}>
                  {/* 左箭头 */}
                  {pendingInvitations.length > 1 ? (
                    <TouchableOpacity
                      style={[styles.navButtonInline, currentInvitationIndex === 0 && styles.navButtonDisabled]}
                      onPress={() => {
                        if (currentInvitationIndex > 0) {
                          const prevIndex = currentInvitationIndex - 1;
                          setCurrentInvitationIndex(prevIndex);
                          showNextInvitation(prevIndex, pendingInvitations);
                        }
                      }}
                      disabled={currentInvitationIndex === 0 || acceptingInvite}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name="chevron-back" 
                        size={24} 
                        color={currentInvitationIndex === 0 ? "#D1D5DB" : "#6C5CE7"} 
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navButtonPlaceholder} />
                  )}
                  
                  {/* Icon和序号（整体显示） */}
                  <View style={styles.iconWithCounter}>
                    <Ionicons name="mail-outline" size={48} color="#6C5CE7" />
                    {pendingInvitations.length > 1 && (
                      <View style={styles.invitationCounterBadge}>
                        <Text style={styles.invitationCounterText}>
                          {currentInvitationIndex + 1}/{pendingInvitations.length}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* 右箭头 */}
                  {pendingInvitations.length > 1 ? (
                    <TouchableOpacity
                      style={[styles.navButtonInline, currentInvitationIndex >= pendingInvitations.length - 1 && styles.navButtonDisabled]}
                      onPress={() => {
                        if (currentInvitationIndex < pendingInvitations.length - 1) {
                          const nextIndex = currentInvitationIndex + 1;
                          setCurrentInvitationIndex(nextIndex);
                          showNextInvitation(nextIndex, pendingInvitations);
                        }
                      }}
                      disabled={currentInvitationIndex >= pendingInvitations.length - 1 || acceptingInvite}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name="chevron-forward" 
                        size={24} 
                        color={currentInvitationIndex >= pendingInvitations.length - 1 ? "#D1D5DB" : "#6C5CE7"} 
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navButtonPlaceholder} />
                  )}
                </View>
                <Text style={styles.modalTitle}>New Invitation</Text>
              </View>
              {/* 突出显示邀请者email和家庭名称 */}
              <View style={styles.inviterEmailContainer}>
                {inviterEmail ? (
                  <Text style={styles.inviterEmailMain}>{inviterEmail}</Text>
                ) : (
                  <Text style={styles.inviterEmailMain}>Someone</Text>
                )}
                <Text style={styles.inviterEmailLabel}>has invited you to join Space</Text>
                {/* 突出显示家庭名称 */}
                {householdName && householdName !== 'Unknown Space' && (
                  <View style={styles.householdNameContainer}>
                    <Text style={styles.householdNameText}>{householdName}</Text>
                  </View>
                )}
              </View>
              <View style={styles.modalButtons}>
                {/* 第一个按钮：接受 - 主要操作按钮，绿色，突出 */}
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonAccept, acceptingInvite && styles.buttonDisabled]}
                  onPress={handleAcceptInvitation}
                  disabled={acceptingInvite}
                  activeOpacity={0.8}
                >
                  {acceptingInvite ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.modalButtonAcceptText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                {/* 第二个按钮：拒绝 - 次要操作按钮，红色边框，危险操作 */}
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDecline]}
                  onPress={handleDeclineInvitation}
                  disabled={acceptingInvite}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#E74C3C" style={{ marginRight: 8 }} />
                  <Text style={styles.modalButtonDeclineText}>Decline</Text>
                </TouchableOpacity>
                
                {/* 第三个按钮：后续处理 - 最轻的操作按钮，灰色，最低优先级 */}
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonLater]}
                  onPress={handleLaterInvitation}
                  disabled={acceptingInvite}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color="#95A5A6" style={{ marginRight: 6 }} />
                  <Text style={styles.modalButtonLaterText}>Deal with Later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#636E72',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 200,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#636E72',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContentContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stackedCardsWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stackedCardBack: {
    position: 'absolute',
    width: '100%',
    maxWidth: 400,
    height: 'auto',
    minHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    position: 'relative',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  modalHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  navButtonInline: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    flexShrink: 0,
  },
  navButtonPlaceholder: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  navButtonDisabled: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  iconWithCounter: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  invitationCounterBadge: {
    position: 'absolute',
    top: -6,
    right: -12,
    backgroundColor: '#6C5CE7',
    borderRadius: 11,
    minWidth: 36,
    height: 22,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  invitationCounterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 0,
    marginBottom: 0,
  },
  inviterEmailContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
  },
  inviterEmailMain: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 6,
  },
  inviterEmailLabel: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 12,
  },
  householdNameContainer: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  householdNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6C5CE7',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#95A5A6',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
  },
  // Accept 按钮 - 主要操作，绿色，突出显示
  modalButtonAccept: {
    backgroundColor: '#27AE60',
    shadowColor: '#27AE60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 4,
  },
  modalButtonAcceptText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  // Decline 按钮 - 次要操作，红色边框，危险操作
  modalButtonDecline: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#E74C3C',
    marginBottom: 4,
  },
  modalButtonDeclineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
  // Later 按钮 - 最轻的操作，灰色，最低优先级
  modalButtonLater: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 0,
  },
  modalButtonLaterText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#95A5A6',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

