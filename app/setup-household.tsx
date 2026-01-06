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
import { createHousehold, getCurrentUser, getUserHouseholds } from '@/lib/auth';
import { getPendingInvitationsForUser, acceptInvitation, declineInvitation, HouseholdInvitation } from '@/lib/household-invitations';
import { supabase } from '@/lib/supabase';
import { initializeAuthCache } from '@/lib/auth-cache';

export default function SetupHouseholdScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteToken?: string }>();
  const [loading, setLoading] = useState(true);
  const [pendingInvitations, setPendingInvitations] = useState<HouseholdInvitation[]>([]);
  const [selectedInvitation, setSelectedInvitation] = useState<HouseholdInvitation | null>(null);
  const [householdNames, setHouseholdNames] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdAddress, setNewHouseholdAddress] = useState('');
  const [mode, setMode] = useState<'invite' | 'create'>('invite'); // 'invite' 显示邀请，'create' 显示创建表单

  useEffect(() => {
    loadInvitations();
  }, []);

  useEffect(() => {
    if (params.inviteToken && pendingInvitations.length > 0) {
      const invitation = pendingInvitations.find(inv => inv.token === params.inviteToken);
      if (invitation) {
        setSelectedInvitation(invitation);
        setMode('invite');
      }
    }
  }, [params.inviteToken, pendingInvitations]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const invitations = await getPendingInvitationsForUser();
      setPendingInvitations(invitations);

      // 加载家庭名称
      const names: Record<string, string> = {};
      for (const inv of invitations) {
        const { data: household } = await supabase
          .from('households')
          .select('name')
          .eq('id', inv.householdId)
          .single();
        if (household) {
          names[inv.householdId] = household.name;
        }
      }
      setHouseholdNames(names);

      // 如果有邀请，默认显示邀请模式；否则显示创建模式
      if (invitations.length > 0) {
        setMode('invite');
        if (invitations.length === 1) {
          setSelectedInvitation(invitations[0]);
        }
      } else {
        setMode('create');
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      setMode('create');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitation: HouseholdInvitation) => {
    setAccepting(true);
    try {
      const { error } = await acceptInvitation(invitation.token);
      if (error) {
        Alert.alert('Error', error.message || 'Failed to join household');
        setAccepting(false);
        return;
      }
      
      // 更新缓存
      const { getCurrentUser, getCurrentHousehold } = await import('@/lib/auth');
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);
      
      // 接受邀请后直接跳转，不显示 Alert（更流畅的体验）
      setAccepting(false);
      router.replace('/');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to join household');
      setAccepting(false);
    }
  };

  const handleDeclineInvitation = async (invitation: HouseholdInvitation) => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${householdNames[invitation.householdId] || 'this household'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await declineInvitation(invitation.token);
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
              
              // 检查用户是否有其他家庭（区分新用户和老用户）
              const households = await getUserHouseholds();
              
              if (households.length === 0) {
                // 新用户：没有家庭，切换到创建模式
                if (remainingInvitations.length === 0) {
                  // 没有更多邀请，直接显示创建表单
                  setMode('create');
                } else {
                  // 还有邀请，但用户选择拒绝，询问是否创建家庭
                  Alert.alert(
                    'Create Your Own Household',
                    'You declined the invitation. Would you like to create your own household?',
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
                // 老用户：有家庭，跳转回首页（登录到上次登录的家庭）
                // 更新缓存
                const updatedUser = await getCurrentUser(true);
                const { getCurrentHousehold } = await import('@/lib/auth');
                const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
                await initializeAuthCache(updatedUser, updatedHousehold);
                
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

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) {
      Alert.alert('Error', 'Please enter household name');
      return;
    }

    setCreating(true);
    try {
      const { household, error } = await createHousehold(
        newHouseholdName.trim(),
        newHouseholdAddress.trim() || undefined
      );

      if (error) {
        // 如果是需要邮箱确认的错误，显示友好提示
        if (error.message?.includes('confirm your email') || error.message?.includes('email confirmation')) {
          Alert.alert(
            'Email Confirmation Required',
            'Please confirm your email address first, then try creating a household again. Check your email inbox for the confirmation link.',
            [
              { text: 'OK', onPress: () => router.replace('/login') }
            ]
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to create household');
        }
        setCreating(false);
        return;
      }

      if (household) {
        // 更新缓存
        const { getCurrentUser } = await import('@/lib/auth');
        const updatedUser = await getCurrentUser(true);
        await initializeAuthCache(updatedUser, household);
        
        // 创建家庭后直接跳转，不显示 Alert（更流畅的体验）
        setCreating(false);
        router.replace('/');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Error', 'Failed to create household');
      setCreating(false);
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
          <Text style={styles.title}>Setup Household</Text>
          <Text style={styles.subtitle}>
            {mode === 'invite' 
              ? 'You have pending invitations' 
              : 'Create your household to get started'}
          </Text>
        </View>

        {/* 邀请模式 */}
        {mode === 'invite' && pendingInvitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <Text style={styles.sectionTitle}>Pending Invitations</Text>
            {pendingInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationCard}>
                <View style={styles.invitationHeader}>
                  <Ionicons name="people" size={24} color="#6C5CE7" />
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationHouseholdName}>
                      {householdNames[invitation.householdId] || 'Unknown Household'}
                    </Text>
                    <Text style={styles.invitationText}>
                      You've been invited to join this household
                    </Text>
                  </View>
                </View>
                <View style={styles.invitationButtons}>
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.declineButton]}
                    onPress={() => handleDeclineInvitation(invitation)}
                    disabled={accepting}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.invitationButton, styles.acceptButton, accepting && styles.buttonDisabled]}
                    onPress={() => handleAcceptInvitation(invitation)}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {pendingInvitations.length > 0 && (
              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => setMode('create')}
              >
                <Text style={styles.switchModeText}>
                  Or create your own household
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 创建模式 */}
        {mode === 'create' && (
          <View style={styles.createSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="home-outline" size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Household Name *"
                placeholderTextColor="#95A5A6"
                value={newHouseholdName}
                onChangeText={setNewHouseholdName}
                autoFocus
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#636E72" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Address (Optional)"
                placeholderTextColor="#95A5A6"
                value={newHouseholdAddress}
                onChangeText={setNewHouseholdAddress}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.buttonDisabled]}
              onPress={handleCreateHousehold}
              disabled={creating || !newHouseholdName.trim()}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Household</Text>
              )}
            </TouchableOpacity>

            {pendingInvitations.length > 0 && (
              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => setMode('invite')}
              >
                <Text style={styles.switchModeText}>
                  Or accept an invitation ({pendingInvitations.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
    flexDirection: 'row',
    gap: 12,
  },
  invitationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    paddingVertical: 0,
    minHeight: 24,
  },
  multilineInput: {
    minHeight: 80,
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
  switchModeButton: {
    alignItems: 'center',
    padding: 16,
  },
  switchModeText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
});

