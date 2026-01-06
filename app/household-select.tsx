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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getUserHouseholds, setCurrentHousehold, createHousehold, getCurrentUser } from '@/lib/auth';
import { UserHousehold } from '@/types';

export default function HouseholdSelectScreen() {
  const router = useRouter();
  const [households, setHouseholds] = useState<UserHousehold[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [newHouseholdAddress, setNewHouseholdAddress] = useState('');

  useEffect(() => {
    loadHouseholds();
  }, []);

  const loadHouseholds = async () => {
    try {
      setLoading(true);
      const data = await getUserHouseholds();
      setHouseholds(data);
      
      // 如果用户只有一个家庭，自动设置并跳转
      if (data.length === 1) {
        const householdId = data[0].householdId;
        const { error } = await setCurrentHousehold(householdId);
        if (!error) {
          router.replace('/');
          return;
        }
      } else if (data.length > 1) {
        // 多个家庭，显示选择页面（即使有当前家庭，也显示让用户选择）
        // 不自动跳转，让用户主动选择
      }
      // 如果没有家庭或需要选择，显示选择页面
    } catch (error) {
      console.error('Error loading households:', error);
      Alert.alert('Error', 'Failed to load households');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHousehold = async (householdId: string) => {
    try {
      const { error } = await setCurrentHousehold(householdId);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      
      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedHousehold = updatedUser ? await getCurrentHousehold(true) : null;
      await initializeAuthCache(updatedUser, updatedHousehold);
      
      router.replace('/');
    } catch (error) {
      console.error('Error selecting household:', error);
      Alert.alert('Error', 'Failed to select household');
    }
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
        Alert.alert('Error', error.message);
        return;
      }

      if (household) {
        // 更新缓存
        const updatedUser = await getCurrentUser(true);
        await initializeAuthCache(updatedUser, household);
        
        setShowCreateModal(false);
        setNewHouseholdName('');
        setNewHouseholdAddress('');
        await loadHouseholds();
        // createHousehold 已经设置了当前家庭，直接进入应用
        router.replace('/');
      }
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Error', 'Failed to create household');
    } finally {
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
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={styles.circle}>
              <Ionicons name="home" size={60} color="#6C5CE7" />
            </View>
          </View>
          <Text style={styles.title}>Select Household</Text>
          <Text style={styles.subtitle}>Choose or create a household to continue</Text>
        </View>

        {households.length > 0 && (
          <View style={styles.householdsList}>
            <Text style={styles.sectionTitle}>Your Households</Text>
            {households.map((userHousehold) => (
              <TouchableOpacity
                key={userHousehold.id}
                style={styles.householdCard}
                onPress={() => handleSelectHousehold(userHousehold.householdId)}
                activeOpacity={0.7}
              >
                <View style={styles.householdIcon}>
                  <Ionicons name="home-outline" size={24} color="#6C5CE7" />
                </View>
                <View style={styles.householdInfo}>
                  <Text style={styles.householdName}>
                    {userHousehold.household?.name || 'Unknown Household'}
                  </Text>
                  {userHousehold.household?.address && (
                    <Text style={styles.householdAddress} numberOfLines={1}>
                      {userHousehold.household.address}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#6C5CE7" />
          <Text style={styles.createButtonText}>Create New Household</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            const { signOut } = await import('@/lib/auth');
            await signOut();
            router.replace('/login');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Create Household Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Household</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#2D3436" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Ionicons name="home-outline" size={20} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Household Name"
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
                style={[styles.modalButton, creating && styles.modalButtonDisabled]}
                onPress={handleCreateHousehold}
                disabled={creating || !newHouseholdName.trim()}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Create</Text>
                )}
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
  householdsList: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  householdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  householdIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  householdInfo: {
    flex: 1,
  },
  householdName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  householdAddress: {
    fontSize: 14,
    color: '#636E72',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderStyle: 'dashed',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
    marginLeft: 8,
  },
  signOutButton: {
    alignItems: 'center',
    padding: 16,
  },
  signOutButtonText: {
    fontSize: 16,
    color: '#E74C3C',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
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
  closeButton: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

