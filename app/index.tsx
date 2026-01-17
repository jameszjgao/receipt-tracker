import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { isAuthenticated, getCurrentUser, getCurrentHousehold, setCurrentHousehold, getUserHouseholds, createHousehold } from '@/lib/auth';
import { initializeAuthCache, isCacheInitialized } from '@/lib/auth-cache';
import { Household, UserHousehold } from '@/types';
import { getPendingInvitationsForUser } from '@/lib/household-invitations';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentHousehold, setCurrentHouseholdState] = useState<Household | null>(null);
  const [showHouseholdSwitch, setShowHouseholdSwitch] = useState(false);
  const [households, setHouseholds] = useState<UserHousehold[]>([]);
  const [switching, setSwitching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdAddress, setNewHouseholdAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const continueAfterAuth = async () => {
    // 检查用户是否有当前家庭（使用缓存，如果缓存未初始化则从数据库读取）
    const user = await getCurrentUser();
    if (!user) {
      router.replace('/setup-household');
      return;
    }

    // 检查用户是否有家庭（区分新用户和老用户）
    const { getUserHouseholds } = await import('@/lib/auth');
    const households = await getUserHouseholds();
    
    // 新用户：没有家庭，跳转到设置家庭页面（创建家庭）
    if (households.length === 0) {
      router.replace('/setup-household');
      return;
    }

    // 老用户：有家庭
    // 如果用户已经有当前家庭（currentHouseholdId 或 householdId），直接进入应用
    if (user.currentHouseholdId || user.householdId) {
      setIsLoggedIn(true);
      return;
    }

    // 老用户：有家庭但没有当前家庭
    if (households.length === 1) {
      // 只有一个家庭，自动设置并进入
      const { setCurrentHousehold } = await import('@/lib/auth');
      await setCurrentHousehold(households[0].householdId);
      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);
      setIsLoggedIn(true);
      return;
    } else {
      // 多个家庭但没有当前家庭，跳转到家庭选择页面
      router.replace('/household-select');
      return;
    }
  };

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      router.replace('/login');
      return;
    }

    // 如果缓存未初始化，后台异步初始化缓存（不阻塞页面渲染）
    if (!isCacheInitialized()) {
      // 后台异步加载，不阻塞，同时先尝试继续路由检查
      // 如果缓存加载完成前需要数据，会从数据库读取；完成后会使用缓存
      (async () => {
        try {
          const user = await getCurrentUser(true); // 强制刷新
          const household = user ? await getCurrentHousehold(true) : null; // 强制刷新
          await initializeAuthCache(user, household);
        } catch (error) {
          console.error('Error initializing auth cache:', error);
          // 错误不影响流程，目标页面会处理
        }
      })();
      
      // 不等待缓存加载，立即继续检查（会从数据库读取，但保证页面正常显示）
      continueAuthCheck();
    } else {
      // 缓存已初始化，直接继续
      continueAuthCheck();
    }
  };

  const continueAuthCheck = async () => {
    // 流程：登录成功 -> 判断是否已关联家庭 -> 有关联家庭 -> 进入上次登录的家庭的index
    // 如果用户已有关联家庭，即使有 pending invitations，也允许进入应用（用户可以通过 Later 按钮忽略邀请）
    
    // 首先检查用户是否有当前家庭（使用缓存，如果缓存未初始化则从数据库读取）
    let user;
    try {
      user = await getCurrentUser(true); // 强制刷新，确保获取最新的currentHouseholdId
    } catch (userError) {
      console.log('Index: Error getting user, redirecting to setup-household');
      router.replace('/setup-household');
      return;
    }
    
    if (!user) {
      console.log('Index: No user, redirecting to setup-household');
      router.replace('/setup-household');
      return;
    }

    // 如果用户已经有当前家庭（currentHouseholdId 或 householdId），直接进入应用（进入上次登录的家庭）
    // 即使有 pending invitations，也允许进入应用（用户可以通过 setup-household 页面的 Invitations 按钮处理）
    if (user.currentHouseholdId || user.householdId) {
      console.log('Index: User has current household, entering app (pending invitations can be handled later)');
      setIsLoggedIn(true);
      return;
    }

    // 用户没有当前家庭，检查用户是否有家庭（区分新用户和老用户）
    const { getUserHouseholds } = await import('@/lib/auth');
    const households = await getUserHouseholds();
    
    // 新用户：没有家庭，检查是否有待处理的邀请
    if (households.length === 0) {
      // 检查是否有待处理的邀请（新用户需要处理邀请）
      try {
        const { getPendingInvitationsForUser } = await import('@/lib/household-invitations');
        const invitations = await getPendingInvitationsForUser();
        
        if (invitations.length > 0) {
          // 新用户有邀请，跳转到邀请处理页面
          console.log('Index: New user with pending invitations, redirecting to handle-invitations');
          router.replace('/handle-invitations');
          return;
        }
      } catch (invError) {
        // 邀请检查失败不影响流程，静默继续
        console.log('Index: Invitation check failed (non-blocking):', invError);
      }
      
      // 新用户没有邀请，跳转到设置家庭页面（创建家庭）
      console.log('Index: No households, redirecting to setup-household');
      router.replace('/setup-household');
      return;
    }

    // 老用户：有家庭但没有当前家庭
    if (households.length === 1) {
      // 只有一个家庭，自动设置并进入（这就是上次登录的家庭）
      console.log('Index: Setting single household:', households[0].householdId);
      const { setCurrentHousehold } = await import('@/lib/auth');
      await setCurrentHousehold(households[0].householdId);
      // 更新缓存（使用已设置的家庭ID，避免再次查询）
      const updatedUser = await getCurrentUser(true); // 强制刷新
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null; // 强制刷新
      await initializeAuthCache(updatedUser, updatedHousehold);
      setIsLoggedIn(true);
      return;
    } else {
      // 多个家庭但没有当前家庭，跳转到家庭选择页面
      console.log('Index: Multiple households, redirecting to household-select');
      router.replace('/household-select');
      return;
    }
  };

  const checkPendingInvitations = async () => {
    // 只有已登录的用户才检查 pending invitations
    if (!isLoggedIn) {
      setPendingInvitationsCount(0);
      return;
    }

    try {
      const invitations = await getPendingInvitationsForUser();
      setPendingInvitationsCount(invitations.length);
    } catch (error) {
      console.error('Error checking pending invitations:', error);
      // 静默失败，不影响页面显示
      setPendingInvitationsCount(0);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadHousehold();
      // checkPendingInvitations 已在 loadHousehold 中调用
    } else {
      setPendingInvitationsCount(0);
    }
  }, [isLoggedIn]);

  // 使用 useFocusEffect 在页面获得焦点时检查 pending invitations 和重新加载家庭信息（用于从其他页面返回时刷新）
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        // 重新加载家庭信息（用于从管理页切换家庭后返回时更新）
        loadHousehold();
        checkPendingInvitations();
      }
    }, [isLoggedIn])
  );

  // 添加路由守卫：每次页面获得焦点时检查用户是否有家庭（防止通过回退路径进入）
  useFocusEffect(
    useCallback(() => {
      const checkUserHousehold = async () => {
        // 如果还没有完成登录检查，跳过
        if (isLoggedIn === null) {
          return;
        }
        
        // 如果已登录，检查用户是否有家庭
        if (isLoggedIn) {
          try {
            const user = await getCurrentUser(true);
            if (!user) {
              router.replace('/setup-household');
              return;
            }
            
            // 检查用户是否有家庭
            const households = await getUserHouseholds();
            if (households.length === 0) {
              // 没有家庭，重定向到 setup-household
              router.replace('/setup-household');
              return;
            }
            
            // 如果有家庭但没有当前家庭，也重定向到 setup-household
            if (!user.currentHouseholdId && !user.householdId) {
              router.replace('/setup-household');
              return;
            }
          } catch (error) {
            console.error('Error checking user household in focus effect:', error);
            router.replace('/setup-household');
          }
        }
      };
      
      checkUserHousehold();
    }, [isLoggedIn, router])
  );

  const loadHousehold = async () => {
    try {
      // 强制刷新，确保从管理页切换家庭后能获取最新数据
      const household = await getCurrentHousehold(true);
      setCurrentHouseholdState(household);
      
      // 加载家庭后检查 pending invitations（已有关联家庭的用户）
      await checkPendingInvitations();
    } catch (error) {
      console.error('Error loading household:', error);
    }
  };


  const ensureUserHasHousehold = async (isNewUser: boolean = false) => {
    // 确保用户有当前家庭，如果没有则设置到第一个家庭或创建新家庭
    const user = await getCurrentUser();
    if (!user) return;

    // 如果用户已经有当前家庭，不需要处理
    if (user.currentHouseholdId || user.householdId) {
      return;
    }

    // 检查用户有哪些家庭
    const households = await getUserHouseholds();
    if (households.length > 0) {
      // 有家庭但没有当前家庭，设置到第一个家庭
      const { error } = await setCurrentHousehold(households[0].householdId);
      if (!error) {
        // 更新缓存
        const updatedUser = await getCurrentUser(true);
        const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
        await initializeAuthCache(updatedUser, updatedHousehold);
        // 更新当前显示的家庭
        setCurrentHouseholdState(updatedHousehold);
      }
    } else if (isNewUser) {
      // 新用户没有家庭，跳转到创建家庭页面让用户手动创建
      router.replace('/setup-household');
      return;
    } else {
      // 老用户没有家庭的情况不应该发生，但如果有，也跳转到创建家庭页面
      router.replace('/setup-household');
    }
  };


  const loadHouseholds = async () => {
    try {
      const data = await getUserHouseholds();
      setHouseholds(data);
    } catch (error) {
      console.error('Error loading households:', error);
      Alert.alert('Error', 'Failed to load households');
    }
  };

  const handleSwitchHousehold = async (householdId: string) => {
    try {
      setSwitching(true);
      const { error } = await setCurrentHousehold(householdId);
      if (error) {
        Alert.alert('Error', error.message);
        setSwitching(false);
        return;
      }

      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);

      setShowHouseholdSwitch(false);
      
      // 更新本地状态
      if (updatedHousehold) {
        setCurrentHouseholdState(updatedHousehold);
      }
      
      // 切换家庭后检查邀请（需求：只在切换家庭时检查邀请）
      // 如果检查失败（如权限问题），静默继续，不阻塞切换流程
      try {
        const { getPendingInvitationsForUser } = await import('@/lib/household-invitations');
        const invitations = await getPendingInvitationsForUser();
        
        if (invitations.length > 0) {
          // 有邀请，跳转到邀请处理页面
          router.replace('/handle-invitations');
          return;
        }
      } catch (invError) {
        // 邀请检查失败不影响切换流程，静默继续（getPendingInvitationsForUser 已处理错误）
        // 不记录错误日志，避免日志噪音
      }
      
      // 重新加载家庭信息
      await loadHousehold();
    } catch (error) {
      console.error('Error switching household:', error);
      Alert.alert('Error', 'Failed to switch household');
    } finally {
      setSwitching(false);
    }
  };

  const openHouseholdSwitch = async () => {
    await loadHouseholds();
    setShowHouseholdSwitch(true);
  };

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) {
      Alert.alert('Error', 'Please enter household name');
      return;
    }

    try {
      setCreating(true);
      const { household, error } = await createHousehold(
        newHouseholdName.trim(),
        newHouseholdAddress.trim() || undefined
      );

      if (error) {
        Alert.alert('Error', error.message || 'Failed to create household');
        setCreating(false);
        return;
      }

      if (household) {
        setShowCreateModal(false);
        setNewHouseholdName('');
        setNewHouseholdAddress('');
        await loadHouseholds();
        await loadHousehold();
        setShowHouseholdSwitch(false);
        Alert.alert('Success', 'Space created successfully');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Error', 'Failed to create household');
    } finally {
      setCreating(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.title}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return null; // 会跳转到登录页或设置家庭页面
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 顶部栏：家庭名称和管理入口 */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {pendingInvitationsCount > 0 && (
            <TouchableOpacity
              style={styles.invitationsBadgeButton}
              onPress={() => router.push('/handle-invitations')}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={24} color="#6C5CE7" />
              <View style={styles.invitationsBadge}>
                <Text style={styles.invitationsBadgeText}>
                  {pendingInvitationsCount > 99 ? '99+' : pendingInvitationsCount}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.householdNameContainer}
          onPress={openHouseholdSwitch}
          activeOpacity={0.7}
        >
          <Text style={styles.householdName} numberOfLines={1}>
            {currentHousehold?.name || 'Loading...'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.managementButton}
          onPress={() => router.push('/management')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="#2D3436" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>📸 Cap Vouchers,</Text>
        <Text style={styles.subtitle}>Master Accounting.</Text>
        
        <TouchableOpacity 
          style={styles.iconContainer}
          onPress={() => router.push('/camera')}
          activeOpacity={0.8}
        >
          <View style={styles.circle}>
            <Ionicons name="camera" size={80} color="#6C5CE7" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatIconContainer}
          onPress={() => router.push('/voice-input')}
          activeOpacity={0.8}
        >
          <View style={styles.chatCircle}>
            <Ionicons name="chatbubble-outline" size={60} color="#6C5CE7" />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={() => router.push('/receipts')}
      >
        <Ionicons name="list-outline" size={20} color="#6C5CE7" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>View Receipts List</Text>
      </TouchableOpacity>

      {/* Space Switch Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showHouseholdSwitch}
        onRequestClose={() => setShowHouseholdSwitch(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowHouseholdSwitch(false)}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Switch Space</Text>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {households.map((userHousehold) => (
                <TouchableOpacity
                  key={userHousehold.householdId}
                  style={[
                    styles.pickerOption,
                    currentHousehold?.id === userHousehold.householdId && styles.pickerOptionSelected
                  ]}
                  onPress={() => handleSwitchHousehold(userHousehold.householdId)}
                  disabled={switching || currentHousehold?.id === userHousehold.householdId}
                >
                  <Ionicons 
                    name="home" 
                    size={20} 
                    color={currentHousehold?.id === userHousehold.householdId ? "#6C5CE7" : "#636E72"} 
                  />
                  <View style={styles.householdOptionContent}>
                    <Text style={[
                      styles.pickerOptionText,
                      currentHousehold?.id === userHousehold.householdId && styles.pickerOptionTextSelected
                    ]}>
                      {userHousehold.household?.name || 'Unnamed Space'}
                    </Text>
                    {userHousehold.household?.address && (
                      <Text style={styles.householdOptionAddress} numberOfLines={1}>
                        {userHousehold.household.address}
                      </Text>
                    )}
                  </View>
                  {currentHousehold?.id === userHousehold.householdId && (
                    <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                  )}
                </TouchableOpacity>
              ))}
              {switching && (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#6C5CE7" />
                </View>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.createHouseholdButton}
                onPress={() => {
                  setShowHouseholdSwitch(false);
                  setShowCreateModal(true);
                }}
                disabled={switching}
              >
                <Ionicons name="add-circle-outline" size={20} color="#6C5CE7" />
                <Text style={styles.createHouseholdButtonText}>Create a New</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Space Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.createModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Space</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setNewHouseholdName('');
                  setNewHouseholdAddress('');
                }}
                style={styles.modalCloseButton}
                disabled={creating}
              >
                <Ionicons name="close" size={24} color="#2D3436" />
              </TouchableOpacity>
            </View>
            <View style={styles.createModalBody}>
              <TextInput
                style={styles.createModalInput}
                placeholder="Space Name"
                placeholderTextColor="#95A5A6"
                value={newHouseholdName}
                onChangeText={setNewHouseholdName}
                autoCapitalize="words"
                editable={!creating}
              />
              <TextInput
                style={[styles.createModalInput, styles.createModalMultilineInput]}
                placeholder="Address (Optional)"
                placeholderTextColor="#95A5A6"
                value={newHouseholdAddress}
                onChangeText={setNewHouseholdAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!creating}
              />
              <View style={styles.createModalButtonRow}>
                <TouchableOpacity
                  style={[styles.createModalButton, styles.createModalCancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewHouseholdName('');
                    setNewHouseholdAddress('');
                  }}
                  disabled={creating}
                >
                  <Text style={styles.createModalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createModalButton, styles.createModalConfirmButton]}
                  onPress={handleCreateHousehold}
                  disabled={creating || !newHouseholdName.trim()}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createModalButtonText}>Create</Text>
                  )}
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    position: 'relative',
  },
  topBarLeft: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  invitationsBadgeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  invitationsBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  invitationsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  householdNameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  householdName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 30,
    textAlign: 'center',
  },
  iconContainer: {
    marginTop: 20,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIconContainer: {
    marginTop: 24,
  },
  chatCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  secondaryButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '600',
  },
  managementButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerBottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
  },
  pickerScrollView: {
    maxHeight: 500,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  pickerOptionSelected: {
    backgroundColor: '#E8F4FD',
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
  householdOptionContent: {
    flex: 1,
  },
  householdOptionAddress: {
    fontSize: 14,
    color: '#636E72',
  },
  modalLoading: {
    padding: 20,
    alignItems: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  createHouseholdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  createHouseholdButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  createModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  createModalBody: {
    padding: 20,
  },
  createModalInput: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3436',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 15,
  },
  createModalMultilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    gap: 12,
  },
  createModalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalCancelButton: {
    backgroundColor: '#E9ECEF',
  },
  createModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  createModalConfirmButton: {
    backgroundColor: '#6C5CE7',
  },
  createModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
});

