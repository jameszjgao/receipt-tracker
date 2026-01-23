import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { ActionSheetIOS } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentSpace, getCurrentUser, getUserSpaces, setCurrentSpace, createSpace, signOut } from '@/lib/auth';
import { initializeAuthCache, updateCachedUser, updateCachedSpace } from '@/lib/auth-cache';
import { supabase } from '@/lib/supabase';
import { Space, UserSpace, User } from '@/types';

export default function ManagementScreen() {
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceAddress, setSpaceAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalName, setPersonalName] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [showSpaceSwitch, setShowSpaceSwitch] = useState(false);
  const [spaces, setSpaces] = useState<UserSpace[]>([]);
  const [switching, setSwitching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceAddress, setNewSpaceAddress] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // 使用缓存，不需要强制刷新（除非数据被修改了）
      const spaceData = await getCurrentSpace();
      if (spaceData) {
        setSpace(spaceData);
        setSpaceName(spaceData.name);
        setSpaceAddress(spaceData.address || '');
      }
      const userData = await getCurrentUser();
      setUser(userData);
      setPersonalName(userData?.name || '');
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load space information');
    } finally {
      setLoading(false);
    }
  };

  // 只加载空间信息
  const loadSpaceOnly = async () => {
    try {
      const spaceData = await getCurrentSpace();
      if (spaceData) {
        setSpace(spaceData);
        setSpaceName(spaceData.name);
        setSpaceAddress(spaceData.address || '');
      }
    } catch (error) {
      console.error('Error loading space:', error);
      // 失败时重新加载所有数据以确保一致性
      loadData();
    }
  };

  // 只加载用户信息
  const loadUserOnly = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setPersonalName(userData?.name || '');
    } catch (error) {
      console.error('Error loading user:', error);
      // 失败时重新加载所有数据以确保一致性
      loadData();
    }
  };

  // 当页面获得焦点时不再重新加载数据（数据已在登录时缓存）
  // useFocusEffect 已移除，避免重复从数据库读取

  const loadSpaces = async () => {
    try {
      const data = await getUserSpaces();
      setSpaces(data);
    } catch (error) {
      console.error('Error loading spaces:', error);
      Alert.alert('Error', 'Failed to load spaces');
    }
  };

  const handleSave = async () => {
    if (!space || !spaceName.trim()) {
      Alert.alert('Error', 'Space name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const user = await getCurrentUser();
      if (!user) throw new Error('Not logged in');

      // 优先使用 currentSpaceId，如果没有则使用 spaceId（向后兼容）
      const spaceId = user.currentSpaceId || user.spaceId;
      if (!spaceId) throw new Error('No space selected');

      const { error } = await supabase
        .from('spaces')
        .update({ 
          name: spaceName.trim(),
          address: spaceAddress.trim() || null,
        })
        .eq('id', spaceId);

      if (error) throw error;

      // 乐观更新：直接更新状态，不需要重新加载所有数据
      const updatedSpace = space ? {
        ...space,
        name: spaceName.trim(),
        address: spaceAddress.trim() || undefined,
      } : null;
      setSpace(updatedSpace);
      // 更新缓存
      if (updatedSpace) {
        updateCachedSpace(updatedSpace);
      }
      setEditing(false);
    } catch (error) {
      console.error('Error updating space:', error);
      Alert.alert('Error', 'Failed to update space information');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (space) {
      setSpaceName(space.name);
      setSpaceAddress(space.address || '');
    }
    setEditing(false);
  };

  const handleSavePersonal = async () => {
    if (!user) return;

    try {
      setSavingPersonal(true);
      
      // 优先使用 RPC 函数绕过 RLS 限制
      let error: any = null;
      try {
        const { error: rpcError } = await supabase
          .rpc('update_user_name', {
            p_user_id: user.id,
            p_name: personalName.trim() || null
          });
        
        if (rpcError) {
          // 如果 RPC 函数不存在或失败，回退到直接更新
          console.log('RPC function failed, falling back to direct update:', rpcError);
          const { error: directError } = await supabase
            .from('users')
            .update({ name: personalName.trim() || null })
            .eq('id', user.id);
          error = directError;
        }
      } catch (rpcErr) {
        // RPC 函数可能不存在，回退到直接更新
        console.log('RPC function not available, using direct update:', rpcErr);
        const { error: directError } = await supabase
          .from('users')
          .update({ name: personalName.trim() || null })
          .eq('id', user.id);
        error = directError;
      }

      if (error) throw error;

      // 乐观更新：直接更新状态，不需要重新加载所有数据
      const updatedUser = user ? {
        ...user,
        name: personalName.trim() || undefined,
      } : null;
      setUser(updatedUser);
      // 更新缓存
      if (updatedUser) {
        updateCachedUser(updatedUser);
      }
      setEditingPersonal(false);
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'Failed to update personal information');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleCancelPersonal = () => {
    setEditingPersonal(false);
    if (user) {
      setPersonalName(user.name || '');
    }
  };

  const handleSwitchSpace = async (spaceId: string) => {
    try {
      setSwitching(true);
      const { error } = await setCurrentSpace(spaceId);
      if (error) {
        Alert.alert('Error', error.message);
        setSwitching(false);
        return;
      }

      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedSpace = updatedUser ? await getCurrentSpace(true) : null;
      await initializeAuthCache(updatedUser, updatedSpace);

      setShowSpaceSwitch(false);
      
      // 更新本地状态
      if (updatedSpace) {
        setSpace(updatedSpace);
        setSpaceName(updatedSpace.name);
        setSpaceAddress(updatedSpace.address || '');
      }
      
      // 重新加载数据以确保一致性
      await loadData();
    } catch (error) {
      console.error('Error switching space:', error);
      Alert.alert('Error', 'Failed to switch space');
    } finally {
      setSwitching(false);
    }
  };

  const openSpaceSwitch = async () => {
    await loadSpaces();
    setShowSpaceSwitch(true);
  };

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) {
      Alert.alert('Error', 'Please enter space name');
      return;
    }

    try {
      setCreating(true);
      const { space, error } = await createSpace(
        newSpaceName.trim(),
        newSpaceAddress.trim() || undefined
      );

      if (error) {
        Alert.alert('Error', error.message || 'Failed to create space');
        setCreating(false);
        return;
      }

      if (space) {
        setShowCreateModal(false);
        setNewSpaceName('');
        setNewSpaceAddress('');
        await loadSpaces();
        await loadData();
        setShowSpaceSwitch(false);
        Alert.alert('Success', 'Space created successfully');
      }
    } catch (error) {
      console.error('Error creating space:', error);
      Alert.alert('Error', 'Failed to create space');
    } finally {
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

  const menuItems = [
    {
      id: 'members',
      title: 'Members',
      icon: 'people-outline',
      route: '/space-members',
      description: 'Manage space members',
    },
    {
      id: 'categories',
      title: 'Categories',
      icon: 'pricetags-outline',
      route: '/categories-manage',
      description: 'Manage expense categories',
    },
    {
      id: 'purposes',
      title: 'Purposes',
      icon: 'briefcase-outline',
      route: '/purposes-manage',
      description: 'Manage item purposes',
    },
    {
      id: 'accounts',
      title: 'Accounts',
      icon: 'wallet-outline',
      route: '/payment-accounts-manage',
      description: 'Manage payment accounts',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Personal Information Section */}
        <Text style={styles.sectionTag}>Personal Information</Text>
        <View style={[styles.spaceInfoCard, styles.personalInfoCard, { marginBottom: 10 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color="#6C5CE7" />
            {editingPersonal ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  value={personalName}
                  onChangeText={setPersonalName}
                  placeholder="Enter your name"
                  autoFocus
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleCancelPersonal}
                    disabled={savingPersonal}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={handleSavePersonal}
                    disabled={savingPersonal}
                  >
                    {savingPersonal ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.viewContainer}>
                <View style={styles.viewContent}>
                  <View style={styles.nameRow}>
                    {loading && !user ? (
                      <View style={styles.loadingPlaceholder}>
                        <ActivityIndicator size="small" color="#95A5A6" />
                        <Text style={styles.placeholderText}>Loading...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.spaceName}>{user?.name || user?.email || 'N/A'}</Text>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => setEditingPersonal(true)}
                        >
                          <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  {loading && !user ? (
                    <View style={styles.addressRow}>
                      <View style={{ width: 14, height: 14, marginTop: 2 }} />
                      <Text style={styles.spaceAddressPlaceholder}>Loading...</Text>
                    </View>
                  ) : (
                    user?.email ? (
                      <View style={styles.addressRow}>
                        <Ionicons name="mail-outline" size={14} color="#636E72" style={styles.addressIcon} />
                        <Text style={styles.spaceAddress}>{user.email}</Text>
                      </View>
                    ) : (
                      <Text style={styles.spaceAddressPlaceholder}>No email set</Text>
                    )
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Space Information Section */}
        <Text style={styles.sectionTag}>Space Information</Text>
        <View style={styles.spaceInfoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="home-outline" size={20} color="#6C5CE7" />
            {editing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  value={spaceName}
                  onChangeText={setSpaceName}
                  placeholder="Enter space name"
                  autoFocus
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={spaceAddress}
                  onChangeText={setSpaceAddress}
                  placeholder="Enter space address (optional)"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleCancel}
                    disabled={saving}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={handleSave}
                    disabled={saving || !spaceName.trim()}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.viewContainer}>
                <View style={styles.viewContent}>
                  <View style={styles.nameRow}>
                    {loading && !space ? (
                      <View style={styles.loadingPlaceholder}>
                        <ActivityIndicator size="small" color="#95A5A6" />
                        <Text style={styles.placeholderText}>Loading...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.spaceName}>{space?.name || 'N/A'}</Text>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => setEditing(true)}
                        >
                          <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  {loading && !space ? (
                    <View style={styles.addressRow}>
                      <View style={{ width: 14, height: 14, marginTop: 2 }} />
                      <Text style={styles.spaceAddressPlaceholder}>Loading...</Text>
                    </View>
                  ) : (
                    space?.address ? (
                      <View style={styles.addressRow}>
                        <Ionicons name="location-outline" size={14} color="#636E72" style={styles.addressIcon} />
                        <Text style={styles.spaceAddress}>{space.address}</Text>
                      </View>
                    ) : (
                      <Text style={styles.spaceAddressPlaceholder}>No address set</Text>
                    )
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Menu Items */}
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemIcon}>
              <Ionicons name={item.icon as any} size={24} color="#6C5CE7" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>{item.title}</Text>
              <Text style={styles.menuItemDescription}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Switch Space Button and Sign Out Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.switchHouseholdButton}
          onPress={openSpaceSwitch}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color="#6C5CE7" />
          <Text style={styles.switchHouseholdButtonText}>Switch Space</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Space Switch Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSpaceSwitch}
        onRequestClose={() => setShowSpaceSwitch(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowSpaceSwitch(false)}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Switch Space</Text>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {spaces.map((userSpace) => (
                <TouchableOpacity
                  key={userSpace.spaceId}
                  style={[
                    styles.pickerOption,
                    space?.id === userSpace.spaceId && styles.pickerOptionSelected
                  ]}
                  onPress={() => handleSwitchSpace(userSpace.spaceId)}
                  disabled={switching || space?.id === userSpace.spaceId}
                >
                  <Ionicons 
                    name="home" 
                    size={20} 
                    color={space?.id === userSpace.spaceId ? "#6C5CE7" : "#636E72"} 
                  />
                  <View style={styles.spaceOptionContent}>
                    <Text style={[
                      styles.pickerOptionText,
                      space?.id === userSpace.spaceId && styles.pickerOptionTextSelected
                    ]}>
                      {userSpace.space?.name || 'Unnamed Space'}
                    </Text>
                    {userSpace.space?.address && (
                      <Text style={styles.spaceOptionAddress} numberOfLines={1}>
                        {userSpace.space.address}
                      </Text>
                    )}
                  </View>
                  {space?.id === userSpace.spaceId && (
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
                style={styles.createSpaceButton}
                onPress={() => {
                  setShowSpaceSwitch(false);
                  setShowCreateModal(true);
                }}
                disabled={switching}
              >
                <Ionicons name="add-circle-outline" size={20} color="#6C5CE7" />
                <Text style={styles.createSpaceButtonText}>Create a New</Text>
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
                  setNewSpaceName('');
                  setNewSpaceAddress('');
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
                value={newSpaceName}
                onChangeText={setNewSpaceName}
                autoCapitalize="words"
                editable={!creating}
              />
              <TextInput
                style={[styles.createModalInput, styles.createModalMultilineInput]}
                placeholder="Address (Optional)"
                placeholderTextColor="#95A5A6"
                value={newSpaceAddress}
                onChangeText={setNewSpaceAddress}
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
                    setNewSpaceName('');
                    setNewSpaceAddress('');
                  }}
                  disabled={creating}
                >
                  <Text style={styles.createModalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createModalButton, styles.createModalConfirmButton]}
                  onPress={handleCreateSpace}
                  disabled={creating || !newSpaceName.trim()}
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
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    height: 20, // 固定高度匹配spaceName的行高
  },
  placeholderText: {
    fontSize: 15,
    color: '#95A5A6',
    fontStyle: 'italic',
    lineHeight: 20, // 匹配spaceName的lineHeight
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  sectionTag: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 6,
    marginTop: 6,
  },
  spaceInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 0,
    marginLeft: 0,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  personalInfoCard: {
    backgroundColor: '#fff',
    borderColor: '#E9ECEF',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  viewContainer: {
    flex: 1,
  },
  viewContent: {
    flex: 1,
    minHeight: 44, // 固定最小高度：nameRow (24) + addressRow (20) = 44
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  spaceName: {
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '600',
    flex: 1,
    lineHeight: 20, // 固定行高，确保高度一致
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 0,
    minHeight: 20, // 固定最小高度匹配spaceAddress的lineHeight
  },
  addressIcon: {
    marginTop: 2,
  },
  spaceAddress: {
    flex: 1,
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
  },
  spaceAddressPlaceholder: {
    fontSize: 14,
    color: '#95A5A6',
    fontStyle: 'italic',
    lineHeight: 20, // 匹配spaceAddress的lineHeight
    minHeight: 20, // 固定最小高度
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#2D3436',
    backgroundColor: '#F8F9FA',
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#E9ECEF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginLeft: 32,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#636E72',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  switchHouseholdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  switchHouseholdButtonText: {
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
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
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
  pickerManageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  createSpacePickerOption: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  spaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  spaceOptionActive: {
    backgroundColor: '#F0F4FF',
  },
  spaceOptionContent: {
    flex: 1,
  },
  spaceOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3436',
    marginBottom: 4,
  },
  spaceOptionAddress: {
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
  createSpaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  createSpaceButtonText: {
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
});
