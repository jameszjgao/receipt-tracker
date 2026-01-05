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
import { getCurrentHousehold, getCurrentUser, getUserHouseholds, setCurrentHousehold, createHousehold, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Household, UserHousehold, User } from '@/types';

export default function ManagementScreen() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdAddress, setHouseholdAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalName, setPersonalName] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [showHouseholdSwitch, setShowHouseholdSwitch] = useState(false);
  const [households, setHouseholds] = useState<UserHousehold[]>([]);
  const [switching, setSwitching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdAddress, setNewHouseholdAddress] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

    const loadData = async () => {
      try {
        setLoading(true);
        const householdData = await getCurrentHousehold();
        if (householdData) {
          setHousehold(householdData);
          setHouseholdName(householdData.name);
          setHouseholdAddress(householdData.address || '');
        }
        const userData = await getCurrentUser();
        setUser(userData);
        setPersonalName(userData?.name || '');
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Error', 'Failed to load household information');
      } finally {
        setLoading(false);
      }
    };

  // 当页面获得焦点时重新加载数据
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadHouseholds = async () => {
    try {
      const data = await getUserHouseholds();
      setHouseholds(data);
    } catch (error) {
      console.error('Error loading households:', error);
      Alert.alert('Error', 'Failed to load households');
    }
  };

  const handleSave = async () => {
    if (!household || !householdName.trim()) {
      Alert.alert('Error', 'Household name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const user = await getCurrentUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase
        .from('households')
        .update({ 
          name: householdName.trim(),
          address: householdAddress.trim() || null,
        })
        .eq('id', user.householdId);

      if (error) throw error;

      setEditing(false);
      await loadData();
    } catch (error) {
      console.error('Error updating household:', error);
      Alert.alert('Error', 'Failed to update household information');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (household) {
      setHouseholdName(household.name);
      setHouseholdAddress(household.address || '');
    }
    setEditing(false);
  };

  const handleSavePersonal = async () => {
    if (!user) return;

    try {
      setSavingPersonal(true);
      const { error } = await supabase
        .from('users')
        .update({ name: personalName.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      setEditingPersonal(false);
      await loadData();
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

  const handleSwitchHousehold = async (householdId: string) => {
    try {
      setSwitching(true);
      const { error } = await setCurrentHousehold(householdId);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setShowHouseholdSwitch(false);
      await loadData();
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
        await loadData();
        setShowHouseholdSwitch(false);
        Alert.alert('Success', 'Household created successfully');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Error', 'Failed to create household');
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
      route: '/household-members',
      description: 'Manage household members',
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

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Personal Information Section */}
        <Text style={styles.sectionTag}>Personal Information</Text>
        <View style={[styles.householdInfoCard, styles.personalInfoCard, { marginBottom: 16 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={24} color="#6C5CE7" />
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
                    <Text style={styles.householdName}>{user?.name || user?.email || 'N/A'}</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setEditingPersonal(true)}
                    >
                      <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                    </TouchableOpacity>
                  </View>
                  {user?.email && (
                    <View style={styles.addressRow}>
                      <Ionicons name="mail-outline" size={14} color="#636E72" style={styles.addressIcon} />
                      <Text style={styles.householdAddress}>{user.email}</Text>
                    </View>
                  )}
                  {!user?.email && (
                    <Text style={styles.householdAddressPlaceholder}>No email set</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Household Information Section */}
        <Text style={styles.sectionTag}>Household Information</Text>
        <View style={styles.householdInfoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="home-outline" size={24} color="#6C5CE7" />
            {editing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={styles.input}
                  value={householdName}
                  onChangeText={setHouseholdName}
                  placeholder="Enter household name"
                  autoFocus
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={householdAddress}
                  onChangeText={setHouseholdAddress}
                  placeholder="Enter household address (optional)"
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
                    disabled={saving || !householdName.trim()}
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
                    <Text style={styles.householdName}>{household?.name || 'N/A'}</Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => setEditing(true)}
                    >
                      <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                    </TouchableOpacity>
                  </View>
                  {household?.address && (
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color="#636E72" style={styles.addressIcon} />
                      <Text style={styles.householdAddress}>{household.address}</Text>
                    </View>
                  )}
                  {!household?.address && (
                    <Text style={styles.householdAddressPlaceholder}>No address set</Text>
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

      {/* Switch Household Button and Sign Out Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.switchHouseholdButton}
          onPress={openHouseholdSwitch}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color="#6C5CE7" />
          <Text style={styles.switchHouseholdButtonText}>Switch Household</Text>
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

      {/* Household Switch Modal */}
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
              <Text style={styles.pickerTitle}>Switch Household</Text>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {households.map((userHousehold) => (
                <TouchableOpacity
                  key={userHousehold.householdId}
                  style={[
                    styles.pickerOption,
                    household?.id === userHousehold.householdId && styles.pickerOptionSelected
                  ]}
                  onPress={() => handleSwitchHousehold(userHousehold.householdId)}
                  disabled={switching || household?.id === userHousehold.householdId}
                >
                  <Ionicons 
                    name="home" 
                    size={20} 
                    color={household?.id === userHousehold.householdId ? "#6C5CE7" : "#636E72"} 
                  />
                  <View style={styles.householdOptionContent}>
                    <Text style={[
                      styles.pickerOptionText,
                      household?.id === userHousehold.householdId && styles.pickerOptionTextSelected
                    ]}>
                      {userHousehold.household?.name || 'Unnamed Household'}
                    </Text>
                    {userHousehold.household?.address && (
                      <Text style={styles.householdOptionAddress} numberOfLines={1}>
                        {userHousehold.household.address}
                      </Text>
                    )}
                  </View>
                  {household?.id === userHousehold.householdId && (
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

      {/* Create Household Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCreateModal}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.createModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Household</Text>
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
                placeholder="Household Name"
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 16,
    paddingBottom: 80,
  },
  sectionTag: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 8,
    marginTop: 8,
  },
  householdInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    gap: 16,
  },
  viewContainer: {
    flex: 1,
  },
  viewContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  householdName: {
    fontSize: 17,
    color: '#2D3436',
    fontWeight: '600',
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressIcon: {
    marginTop: 2,
  },
  householdAddress: {
    flex: 1,
    fontSize: 15,
    color: '#636E72',
    lineHeight: 22,
  },
  householdAddressPlaceholder: {
    fontSize: 14,
    color: '#95A5A6',
    fontStyle: 'italic',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  createHouseholdPickerOption: {
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
  householdOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  householdOptionActive: {
    backgroundColor: '#F0F4FF',
  },
  householdOptionContent: {
    flex: 1,
  },
  householdOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3436',
    marginBottom: 4,
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
});
