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
import { getUserSpaces, setCurrentSpace, createSpace, getCurrentUser, getCurrentSpace } from '@/lib/auth';
import { UserSpace } from '@/types';
import { initializeAuthCache } from '@/lib/auth-cache';

export default function SpaceSelectScreen() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<UserSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceAddress, setNewSpaceAddress] = useState('');

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const data = await getUserSpaces();
      setSpaces(data);
      
      // 如果用户只有一个空间，自动设置并跳转
      if (data.length === 1) {
        const spaceId = data[0].spaceId;
        const { error } = await setCurrentSpace(spaceId);
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
      console.error('Error loading spaces:', error);
      Alert.alert('Error', 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSpace = async (spaceId: string) => {
    try {
      const { error } = await setCurrentSpace(spaceId);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      
      // 更新缓存
      const updatedUser = await getCurrentUser(true);
      const updatedSpace = updatedUser ? await getCurrentSpace(true) : null;
      await initializeAuthCache(updatedUser, updatedSpace);
      
      router.replace('/');
    } catch (error) {
      console.error('Error selecting space:', error);
      Alert.alert('Error', 'Failed to select space');
    }
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
        Alert.alert('Error', error.message);
        return;
      }

      if (space) {
        // 更新缓存
        const updatedUser = await getCurrentUser(true);
        await initializeAuthCache(updatedUser, space);
        
        setShowCreateModal(false);
        setNewSpaceName('');
        setNewSpaceAddress('');
        await loadSpaces();
        // createSpace 已经设置了当前空间，直接进入应用
        router.replace('/');
      }
    } catch (error) {
      console.error('Error creating space:', error);
      Alert.alert('Error', 'Failed to create space');
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
          <Text style={styles.title}>Select Space</Text>
          <Text style={styles.subtitle}>Choose or create a space to continue</Text>
        </View>

        {spaces.length > 0 && (
          <View style={styles.spacesList}>
            <Text style={styles.sectionTitle}>Your Spaces</Text>
            {spaces.map((userSpace) => (
              <TouchableOpacity
                key={userSpace.id}
                style={styles.spaceCard}
                onPress={() => handleSelectSpace(userSpace.spaceId)}
                activeOpacity={0.7}
              >
                <View style={styles.spaceIcon}>
                  <Ionicons name="home-outline" size={24} color="#6C5CE7" />
                </View>
                <View style={styles.spaceInfo}>
                  <Text style={styles.spaceName}>
                    {userSpace.space?.name || 'Unknown Space'}
                  </Text>
                  {userSpace.space?.address && (
                    <Text style={styles.spaceAddress} numberOfLines={1}>
                      {userSpace.space.address}
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
          <Text style={styles.createButtonText}>Create New Space</Text>
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

      {/* Create Space Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Space</Text>
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
                  placeholder="Space Name"
                  placeholderTextColor="#95A5A6"
                  value={newSpaceName}
                  onChangeText={setNewSpaceName}
                  autoFocus
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#636E72" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Address (Optional)"
                  placeholderTextColor="#95A5A6"
                  value={newSpaceAddress}
                  onChangeText={setNewSpaceAddress}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.modalButton, creating && styles.modalButtonDisabled]}
                onPress={handleCreateSpace}
                disabled={creating || !newSpaceName.trim()}
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
  spacesList: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  spaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  spaceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  spaceInfo: {
    flex: 1,
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  spaceAddress: {
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

