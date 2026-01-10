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
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentHousehold, getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Household } from '@/types';

export default function HouseholdManageScreen() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [householdAddress, setHouseholdAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHousehold();
  }, []);

  const loadHousehold = async () => {
    try {
      setLoading(true);
      const data = await getCurrentHousehold();
      if (data) {
        setHousehold(data);
        setHouseholdName(data.name);
        setHouseholdAddress(data.address || '');
      }
    } catch (error) {
      console.error('Error loading household:', error);
      Alert.alert('Error', 'Failed to load household information');
    } finally {
      setLoading(false);
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

      // 优先使用 currentHouseholdId，如果没有则使用 householdId（向后兼容）
      const householdId = user.currentHouseholdId || user.householdId;
      if (!householdId) throw new Error('No household selected');

      const { error } = await supabase
        .from('households')
        .update({ 
          name: householdName.trim(),
          address: householdAddress.trim() || null,
        })
        .eq('id', householdId);

      if (error) throw error;

      Alert.alert('Success', 'Household information updated');
      setEditing(false);
      await loadHousehold();
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
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Household Information</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home-outline" size={18} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Household Name</Text>
          </View>
          
          {editing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={householdName}
                onChangeText={setHouseholdName}
                placeholder="Enter household name"
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.viewContainer}>
              <Text style={styles.householdName} numberOfLines={3}>{household?.name || 'N/A'}</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(true)}
              >
                <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={18} color="#6C5CE7" />
            <Text style={styles.cardTitle}>Address</Text>
          </View>
          
          {editing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={householdAddress}
                onChangeText={setHouseholdAddress}
                placeholder="Enter household address (optional)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          ) : (
            <View style={styles.viewContainer}>
              <Text style={styles.householdName} numberOfLines={5}>{household?.address || 'Not set'}</Text>
            </View>
          )}
        </View>

        {editing && (
          <View style={styles.card}>
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
        )}

        {household && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {household.createdAt ? new Date(household.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            {household.updatedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Updated:</Text>
                <Text style={styles.infoValue}>
                  {new Date(household.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    padding: 16,
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
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginLeft: 6,
  },
  viewContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  viewContent: {
    flex: 1,
    marginRight: 8,
  },
  householdName: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
    fontWeight: '400',
    lineHeight: 20,
  },
  householdAddress: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F0F4FF',
  },
  editButtonText: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '600',
    marginLeft: 4,
  },
  editContainer: {
    marginTop: 4,
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
    minHeight: 80,
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#636E72',
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '500',
  },
});

