import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { createSpace, getCurrentUser, getUserSpaces, signOut } from '@/lib/auth';
import { getPendingInvitationsForUser, acceptInvitation, declineInvitation, SpaceInvitation } from '@/lib/space-invitations';
import { supabase } from '@/lib/supabase';
import { initializeAuthCache } from '@/lib/auth-cache';

export default function SetupHouseholdScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteId?: string }>();
  const [loading, setLoading] = useState(true);
  const [pendingInvitations, setPendingInvitations] = useState<SpaceInvitation[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<SpaceInvitation | null>(null);
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceAddress, setNewSpaceAddress] = useState('');
  const [mode, setMode] = useState<'invite' | 'create'>('invite'); // 'invite' 显示邀请，'create' 显示创建表单

  useEffect(() => {
    loadInvitations();
  }, []);

  useEffect(() => {
    if (params.inviteId && pendingInvitations.length > 0) {
      const invitation = pendingInvitations.find(inv => inv.id === params.inviteId);
      if (invitation) {
        setSelectedInvitation(invitation);
        setMode('invite');
      }
    }
  }, [params.inviteId, pendingInvitations]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const invitations = await getPendingInvitationsForUser();
      setPendingInvitations(invitations);

      // 使用邀请数据中的空间名称（已经在 getPendingInvitationsForUser 中通过 join 获取）
      const names: Record<string, string> = {};
      invitations.forEach(invitation => {
        if (invitation.spaceName) {
          names[invitation.spaceId] = invitation.spaceName;
        }
      });
      
      // 如果某些邀请没有空间名称，尝试批量查询补充
      const invitationsWithoutName = invitations.filter(inv => !inv.spaceName);
      if (invitationsWithoutName.length > 0) {
        const spaceIds = invitationsWithoutName.map(inv => inv.spaceId);
        const { data: spaces } = await supabase
          .from('spaces')
          .select('id, name')
          .in('id', spaceIds);
        
        if (spaces) {
          spaces.forEach(space => {
            names[space.id] = space.name;
          });
        }
      }
      
      setSpaceNames(names);

      // 始终优先显示创建模式（首位展示创建新家庭）
      // 如果有邀请，可以通过按钮切换到邀请模式
      setMode('create');
    } catch (error) {
      console.error('Error loading invitations:', error);
      setMode('create');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitation: SpaceInvitation) => {
    setAccepting(true);
    try {
      const { error } = await acceptInvitation(invitation.id);
      if (error) {
        Alert.alert('Error', error.message || 'Failed to join space');
        setAccepting(false);
        return;
      }
      
      // 更新缓存
      const { getCurrentUser, getCurrentSpace } = await import('@/lib/auth');
      const updatedUser = await getCurrentUser(true);
      const updatedSpace = updatedUser ? await getCurrentSpace(true) : null;
      await initializeAuthCache(updatedUser, updatedSpace);
      
      // 接受邀请后直接跳转，不显示 Alert（更流畅的体验）
      setAccepting(false);
      router.replace('/');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to join space');
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = async (invitation: SpaceInvitation) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${spaceNames[invitation.spaceId] || 'this space'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await declineInvitation(invitation.id);
              if (error) {
                Alert.alert('Error', error.message || 'Failed to decline invitation');
                return;
              }
              
              // 从列表中移除该邀请
              const remainingInvitations = pendingInvitations.filter(inv => inv.id !== invitation.id);
              setPendingInvitations(remainingInvitations);
              
              // 如果当前选中的邀请被拒绝，清除选中状态
              if (selectedInvitation?.id === invitation.id) {
                setSelectedInvitation(null);
              }
              
              // 检查用户是否有其他空间（区分新用户和老用户）
              const spaces = await getUserSpaces();
              
              if (spaces.length === 0) {
                // 新用户：没有空间，切换到创建模式
                if (remainingInvitations.length === 0) {
                  // 没有更多邀请，直接显示创建表单
                  setMode('create');
                } else {
                  // 还有邀请，但用户选择拒绝，询问是否创建空间
                  Alert.alert(
                    'Create Your Own Space',
                    'You declined the invitation. Would you like to create your own space?',
                    [
                      { text: 'Later', style: 'cancel' },
                      {
                        text: 'Create',
                        onPress: () => setMode('create'),
                      },
                    ]
                  );
                }
              } else {
                // 老用户：有空间，跳转回首页（登录到上次登录的空间）
                // 更新缓存
                const updatedUser = await getCurrentUser(true);
                const { getCurrentSpace } = await import('@/lib/auth');
                const updatedSpace = updatedUser ? await getCurrentSpace(true) : null;
                await initializeAuthCache(updatedUser, updatedSpace);
                
                router.replace('/');
              }
            } catch (error) {
              console.error('Error declining invitation:', error);
              Alert.alert('Error', 'Failed to decline invitation');
            }
          },
        },
      ]
    );
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) {
      Alert.alert('Error', 'Please enter space name');
      return;
    }

    setCreating(true);
    try {
      const { space, error } = await createSpace(
        newSpaceName.trim(),
        newSpaceAddress.trim() || undefined
      );

      if (error) {
        // 如果是需要邮箱确认的错误，显示友好提示
        if (error.message?.includes('confirm your email') || error.message?.includes('email confirmation')) {
          Alert.alert(
            'Email Confirmation Required',
            'Please confirm your email address first, then try creating a space again. Check your email inbox for the confirmation link.',
            [
              { text: 'OK', onPress: () => router.replace('/login') }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to create space');
        }
        setCreating(false);
        return;
      }

      if (space) {
        // 更新缓存（使用已创建的空间，避免再次查询）
        const { getCurrentUser } = await import('@/lib/auth');
        const updatedUser = await getCurrentUser(); // 不强制刷新，使用缓存或快速查询
        await initializeAuthCache(updatedUser, space);
        
        // 创建空间后直接跳转，不显示 Alert（更流畅的体验）
        setCreating(false);
        router.replace('/');
      }
    } catch (error) {
      console.error('Error creating space:', error);
      Alert.alert('Error', 'Failed to create space');
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await signOut();
              if (error) {
                Alert.alert('Error', error.message || 'Failed to sign out');
                return;
              }
              // 退出成功后跳转到登录页面
              router.replace('/login');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={styles.circle}>
              <Ionicons name="home" size={60} color="#6C5CE7" />
            </View>
          </View>
          <Text style={styles.title}>Setup Space</Text>
          <Text style={styles.subtitle}>Create your space to get started</Text>
        </View>

        {/* 创建模式 - 首位展示 */}
        {mode === 'create' && (
          <View style={styles.createSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="home-outline" size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Space Name *"
                placeholderTextColor="#95A5A6"
                value={newSpaceName}
                onChangeText={setNewSpaceName}
              />
            </View>

            <View style={[styles.inputContainer, styles.addressInputContainer]}>
              <Ionicons name="location-outline" size={20} color="#636E72" style={styles.addressInputIcon} />
              <TextInput
                style={[styles.input, styles.addressInput]}
                placeholder="Address (Optional)"
                placeholderTextColor="#95A5A6"
                value={newSpaceAddress}
                onChangeText={setNewSpaceAddress}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.buttonDisabled]}
              onPress={handleCreateSpace}
              disabled={creating || !newSpaceName.trim()}
            >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Space</Text>
            )}
          </TouchableOpacity>
          </View>
        )}

        {/* Invitations Button - 如果有pending邀请 */}
        {pendingInvitations.length > 0 && (
          <TouchableOpacity
            style={styles.invitationsButton}
            onPress={() => router.push('/handle-invitations')}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={20} color="#6C5CE7" />
            <Text style={styles.invitationsButtonText}>
              Invitations ({pendingInvitations.length})
            </Text>
          </TouchableOpacity>
        )}

        {/* Sign Out Button - 底部 */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
  },
  invitationsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  invitationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  invitationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  invitationHouseholdName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  invitationText: {
    fontSize: 14,
    color: '#636E72',
  },
  invitationButtons: {
    flexDirection: 'column',
    width: '100%',
  },
  invitationButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 12,
  },
  declineButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  acceptButton: {
    backgroundColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  laterButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 0, // 最后一个按钮不需要底部间距
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  createSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 52,
  },
  addressInputContainer: {
    alignItems: 'flex-start',
  },
  inputIcon: {
    marginRight: 12,
  },
  addressInputIcon: {
    marginRight: 12,
    marginTop: 2, // 与第一行文字对齐
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    paddingVertical: 0,
    minHeight: 24,
  },
  addressInput: {
    minHeight: 24,
    maxHeight: 120, // 限制最大高度，避免占用太多空间
    paddingTop: 0,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
    minHeight: 52,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  invitationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  invitationsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
  },
});

