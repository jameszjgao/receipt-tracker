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
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteHouseholdId, setInviteHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<Array<{ id: string; householdId: string; token: string; name: string }>>([]);
  const [currentInvitationIndex, setCurrentInvitationIndex] = useState(0);

  useEffect(() => {
    checkInvitations();
  }, []);

  const checkInvitations = async () => {
    try {
      setLoading(true);
      const invitations = await getPendingInvitationsForUser();
      
      if (invitations.length === 0) {
        // 没有邀请，继续正常流程
        await continueAfterInvitations();
        return;
      }

      // 有邀请，加载所有邀请的家庭名称
      const invitationsWithNames: Array<{ id: string; householdId: string; token: string; name: string }> = [];
      
      for (const invitation of invitations) {
        const { data: householdData } = await supabase
          .from('households')
          .select('name')
          .eq('id', invitation.householdId)
          .maybeSingle();
        
        invitationsWithNames.push({
          id: invitation.id,
          householdId: invitation.householdId,
          token: invitation.token,
          name: householdData?.name || 'Unknown Household',
        });
      }
      
      // 保存所有邀请并显示第一个
      setPendingInvitations(invitationsWithNames);
      setCurrentInvitationIndex(0);
      showNextInvitation(0, invitationsWithNames);
    } catch (error) {
      console.error('Error checking invitations:', error);
      await continueAfterInvitations();
    } finally {
      setLoading(false);
    }
  };

  const showNextInvitation = (index: number, invitations: Array<{ id: string; householdId: string; token: string; name: string }>) => {
    if (index < invitations.length) {
      const invitation = invitations[index];
      setHouseholdName(invitation.name);
      setInviteToken(invitation.token);
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
    // 检查用户是否有当前家庭（使用缓存，如果缓存未初始化则从数据库读取）
    const user = await getCurrentUser();
    if (!user) {
      router.replace('/setup-household');
      return;
    }

    // 检查用户是否有家庭（区分新用户和老用户）
    const households = await getUserHouseholds();
    
    // 新用户：没有家庭，跳转到设置家庭页面（创建家庭）
    if (households.length === 0) {
      router.replace('/setup-household');
      return;
    }

    // 老用户：有家庭
    // 如果用户已经有当前家庭（currentHouseholdId 或 householdId），直接进入应用
    if (user.currentHouseholdId || user.householdId) {
      router.replace('/');
      return;
    }

    // 老用户：有家庭但没有当前家庭
    if (households.length === 1) {
      // 只有一个家庭，自动设置并进入
      await setCurrentHousehold(households[0].householdId);
      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);
      router.replace('/');
      return;
    } else {
      // 多个家庭但没有当前家庭，跳转到家庭选择页面
      router.replace('/household-select');
      return;
    }
  };

  const handleAcceptInvitation = async () => {
    if (!inviteToken || !inviteHouseholdId) return;

    setAcceptingInvite(true);
    try {
      const { error } = await acceptInvitation(inviteToken);
      
      if (error) {
        Alert.alert('Error', error.message || 'Failed to join household');
        setAcceptingInvite(false);
        return;
      }

      // 接受邀请后，自动切换到新加入的家庭
      const { error: switchError } = await setCurrentHousehold(inviteHouseholdId);
      if (switchError) {
        console.error('Error switching household:', switchError);
        // 即使切换失败，也继续，因为用户已经加入了家庭
      }

      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);

      // 关闭当前邀请对话框
      setShowInviteModal(false);
      setInviteToken(null);
      setInviteHouseholdId(null);
      setAcceptingInvite(false);

      // 检查是否还有更多邀请需要处理
      const nextIndex = currentInvitationIndex + 1;
      if (nextIndex < pendingInvitations.length) {
        // 还有更多邀请，显示下一个
        setCurrentInvitationIndex(nextIndex);
        showNextInvitation(nextIndex, pendingInvitations);
      } else {
        // 所有邀请都处理完了，进入应用
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
    if (!inviteToken) {
      setShowInviteModal(false);
      setInviteToken(null);
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
      const { error } = await declineInvitation(inviteToken);
      if (error) {
        console.error('Error declining invitation:', error);
        // 即使失败也继续处理下一个邀请
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      // 关闭当前邀请对话框
      setShowInviteModal(false);
      setInviteToken(null);
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
    setShowInviteModal(false);
    setInviteToken(null);
    setInviteHouseholdId(null);
    
    // 检查是否还有更多邀请
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
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
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
              <Text style={styles.modalTitle}>Join Household</Text>
            </View>
            <Text style={styles.modalText}>
              You've been invited to join <Text style={styles.householdNameText}>{householdName || 'a household'}</Text>.
            </Text>
            <Text style={styles.modalSubtext}>
              Do you want to join this household?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAccept]}
                onPress={handleAcceptInvitation}
                disabled={acceptingInvite}
              >
                {acceptingInvite ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonAcceptText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleDeclineInvitation}
                disabled={acceptingInvite}
              >
                <Text style={styles.modalButtonCancelText}>Decline</Text>
              </TouchableOpacity>
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
  householdNameText: {
    fontWeight: '600',
    color: '#6C5CE7',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonCancel: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  modalButtonLater: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  modalButtonLaterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  modalButtonAccept: {
    backgroundColor: '#6C5CE7',
  },
  modalButtonAcceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

