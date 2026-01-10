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
  const [pendingInvitations, setPendingInvitations] = useState<Array<{ id: string; householdId: string; name: string; inviterEmail?: string }>>([]);
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

      // 直接使用邀请数据中的家庭名称和邀请者email（已经在 getPendingInvitationsForUser 中获取）
      // 如果家庭名称为空，尝试通过household_id查询补充
      const invitationsWithNames: Array<{ id: string; householdId: string; name: string; inviterEmail?: string }> = [];
      
      for (const invitation of invitations) {
        let householdName = invitation.householdName;
        
        // 如果家庭名称为空，尝试查询补充
        if (!householdName && invitation.householdId) {
          try {
            const { data: householdData } = await supabase
              .from('households')
              .select('name')
              .eq('id', invitation.householdId)
              .single();
            
            if (householdData?.name) {
              householdName = householdData.name;
            }
          } catch (err) {
            console.log('Failed to fetch household name for invitation:', invitation.id, err);
          }
        }
        
        console.log('Processing invitation:', {
          id: invitation.id,
          householdName: householdName || invitation.householdName,
          inviterEmail: invitation.inviterEmail,
        });
        
        invitationsWithNames.push({
          id: invitation.id,
          householdId: invitation.householdId,
          name: householdName || invitation.householdName || 'Unknown Household',
          inviterEmail: invitation.inviterEmail,
        });
      }
      
      // 如果没有获取到家庭名称或邀请者email，记录警告
      const invitationsWithoutInfo = invitationsWithNames.filter(inv => inv.name === 'Unknown Household' || !inv.inviterEmail);
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

  const showNextInvitation = (index: number, invitations: Array<{ id: string; householdId: string; name: string; inviterEmail?: string }>) => {
    if (index < invitations.length) {
      const invitation = invitations[index];
      
      // 调试日志
      console.log('Showing invitation:', {
        index,
        name: invitation.name,
        inviterEmail: invitation.inviterEmail,
        householdId: invitation.householdId,
      });
      
      setHouseholdName(invitation.name);
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
      if (user.currentHouseholdId || user.householdId) {
        const targetHouseholdId = user.currentHouseholdId || user.householdId;
        console.log('continueAfterInvitations: User has current household, redirecting to home:', targetHouseholdId);
        
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
        Alert.alert('Error', error.message || 'Failed to join household');
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
      Alert.alert('Error', 'Failed to join household');
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
    
    // 检查是否还有更多邀请
    const nextIndex = currentInvitationIndex + 1;
    if (nextIndex < pendingInvitations.length) {
      // 还有更多邀请，显示下一个
      console.log('handleLaterInvitation: More invitations, showing next');
      setCurrentInvitationIndex(nextIndex);
      showNextInvitation(nextIndex, pendingInvitations);
    } else {
      // 所有邀请都处理完了，直接继续流程（会登录到上次登录的家庭）
      console.log('handleLaterInvitation: All invitations processed, continuing to login');
      setPendingInvitations([]);
      setCurrentInvitationIndex(0);
      await continueAfterInvitations();
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
      
      {/* 显示层叠的邀请卡片（如果有多个邀请且没有打开modal） */}
      {pendingInvitations.length > 0 && !showInviteModal && (
        <View style={styles.stackedCardsContainer}>
          {pendingInvitations.slice(currentInvitationIndex, currentInvitationIndex + 3).map((invitation, idx) => {
            const actualIndex = currentInvitationIndex + idx;
            const isTopCard = idx === 0;
            const remainingCount = pendingInvitations.length - actualIndex;
            const cardOpacity = 1 - idx * 0.4;
            const cardScale = 1 - idx * 0.08;
            const cardTranslateY = idx * 12;
            const shadowOpacity = idx === 0 ? 0.15 : 0.08;
            const cardElevation = idx === 0 ? 5 : 2;
            
            return (
              <TouchableOpacity
                key={invitation.id}
                style={[
                  styles.stackedCard,
                  { 
                    zIndex: 100 - idx, // 确保顶层卡片在最上面
                    transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
                    opacity: cardOpacity,
                    shadowOpacity: shadowOpacity,
                    elevation: cardElevation,
                  }
                ]}
                onPress={() => {
                  if (isTopCard) {
                    showNextInvitation(actualIndex, pendingInvitations);
                  }
                }}
                disabled={!isTopCard}
                activeOpacity={isTopCard ? 0.7 : 1}
              >
                <View style={styles.stackedCardContent}>
                  <View style={styles.stackedCardIconContainer}>
                    <Ionicons name="people" size={28} color="#6C5CE7" />
                    {remainingCount > 1 && isTopCard && (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{remainingCount}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.stackedCardInfo}>
                    <Text style={styles.stackedCardName}>{invitation.name || 'Unknown Household'}</Text>
                    <Text style={styles.stackedCardEmail}>
                      {invitation.inviterEmail || 'Someone'} invited you
                    </Text>
                  </View>
                  {isTopCard && (
                    <Ionicons name="chevron-forward" size={20} color="#636E72" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      
      {/* 如果没有更多邀请且没有打开modal，显示提示 */}
      {pendingInvitations.length === 0 && !showInviteModal && !loading && (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No pending invitations</Text>
        </View>
      )}
      
      {/* 邀请确认浮窗 */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeclineInvitation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="people" size={48} color="#6C5CE7" />
              <Text style={styles.modalTitle}>Invitation to Join</Text>
            </View>
            {/* 明确显示家庭名称 */}
            <View style={styles.householdNameContainer}>
              <Text style={styles.householdNameLabel}>Household:</Text>
              <Text style={styles.householdNameText}>
                {householdName || 'Unknown Household'}
              </Text>
            </View>
            <Text style={styles.modalText}>
              {inviterEmail ? (
                <>
                  <Text style={styles.inviterEmailText}>{inviterEmail}</Text> has invited you to join this household.
                </>
              ) : (
                'You have been invited to join this household.'
              )}
            </Text>
            <Text style={styles.modalSubtext}>
              Do you want to join this household?
            </Text>
            {/* 显示剩余邀请数量（如果有多个邀请） */}
            {pendingInvitations.length > 1 && (
              <Text style={styles.remainingInvitationsText}>
                {pendingInvitations.length - currentInvitationIndex - 1} more invitation(s) waiting
              </Text>
            )}
            <View style={styles.modalButtons}>
              {/* 第一个按钮：接受 */}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAccept, acceptingInvite && styles.buttonDisabled]}
                onPress={handleAcceptInvitation}
                disabled={acceptingInvite}
              >
                {acceptingInvite ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonAcceptText}>Accept</Text>
                )}
              </TouchableOpacity>
              
              {/* 第二个按钮：拒绝 */}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDecline]}
                onPress={handleDeclineInvitation}
                disabled={acceptingInvite}
              >
                <Text style={styles.modalButtonDeclineText}>Decline</Text>
              </TouchableOpacity>
              
              {/* 第三个按钮：后续处理 */}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonLater]}
                onPress={handleLaterInvitation}
                disabled={acceptingInvite}
              >
                <Text style={styles.modalButtonLaterText}>Deal with Later</Text>
              </TouchableOpacity>
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  householdNameContainer: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    width: '100%',
  },
  householdNameLabel: {
    fontSize: 12,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  householdNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6C5CE7',
    textAlign: 'center',
  },
  inviterEmailText: {
    fontWeight: '600',
    color: '#2D3436',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginBottom: 16,
  },
  remainingInvitationsText: {
    fontSize: 12,
    color: '#6C5CE7',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    fontWeight: '500',
  },
  stackedCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 100,
    position: 'relative',
  },
  stackedCard: {
    position: 'absolute',
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  stackedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stackedCardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  stackedCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 6,
  },
  stackedCardEmail: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
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
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 12,
  },
  modalButtonDecline: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalButtonDeclineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalButtonLater: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 0, // 最后一个按钮不需要底部间距
  },
  modalButtonLaterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  modalButtonAccept: {
    backgroundColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalButtonAcceptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

