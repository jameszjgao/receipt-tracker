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
import {
  getPaymentAccounts,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
  mergePaymentAccount,
  PaymentAccount,
} from '@/lib/payment-accounts';

export default function PaymentAccountsManageScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await getPaymentAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
      Alert.alert('Error', 'Failed to load payment accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter payment account name');
      return;
    }

    try {
      await createPaymentAccount(newName.trim(), false);
      await loadAccounts();
      setNewName('');
      setShowAddForm(false);
      Alert.alert('Success', 'Payment account created');
    } catch (error: any) {
      console.error('Error creating payment account:', error);
      Alert.alert('Error', error.message || 'Failed to create payment account');
    }
  };

  const handleUpdateAccount = async (accountId: string) => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter payment account name');
      return;
    }

    try {
      await updatePaymentAccount(accountId, {
        name: editName.trim(),
      });
      await loadAccounts();
      setEditingId(null);
      setEditName('');
      Alert.alert('Success', 'Payment account updated');
    } catch (error: any) {
      console.error('Error updating payment account:', error);
      Alert.alert('Error', error.message || 'Failed to update payment account');
    }
  };

  const handleDeleteAccount = async (account: PaymentAccount) => {
    Alert.alert(
      'Delete Payment Account',
      `Are you sure you want to delete "${account.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePaymentAccount(account.id);
              await loadAccounts();
              Alert.alert('Success', 'Payment account deleted');
            } catch (error: any) {
              console.error('Error deleting payment account:', error);
              Alert.alert('Error', error.message || 'Failed to delete payment account');
            }
          },
        },
      ]
    );
  };

  const startEdit = (account: PaymentAccount) => {
    setEditingId(account.id);
    setEditName(account.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const toggleAccountSelection = (accountId: string) => {
    const newSelected = new Set(selectedAccountIds);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccountIds(newSelected);
  };

  const handleStartMerge = () => {
    setMergeMode(true);
    setSelectedAccountIds(new Set());
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleCancelMerge = () => {
    setMergeMode(false);
    setSelectedAccountIds(new Set());
  };

  const handleConfirmMerge = () => {
    if (selectedAccountIds.size < 2) {
      Alert.alert('Error', 'Please select at least 2 accounts to merge');
      return;
    }

    // 显示选择目标账户的对话框
    const selectedAccounts = accounts.filter(acc => selectedAccountIds.has(acc.id));
    const accountNames = selectedAccounts.map(acc => acc.name).join('\n');

    Alert.alert(
      'Select Target Account',
      `Select which account to keep (others will be merged into it):\n\n${accountNames}`,
      selectedAccounts.map(account => ({
        text: account.name,
        onPress: () => {
          const sourceIds = Array.from(selectedAccountIds).filter(id => id !== account.id);
          performMerge(sourceIds, account.id);
        },
      })).concat([
        { text: 'Cancel', style: 'cancel', onPress: handleCancelMerge },
      ])
    );
  };

  const performMerge = async (sourceAccountIds: string[], targetAccountId: string) => {
    try {
      await mergePaymentAccount(sourceAccountIds, targetAccountId);
      await loadAccounts();
      setMergeMode(false);
      setSelectedAccountIds(new Set());
      Alert.alert('Success', 'Payment accounts merged successfully');
    } catch (error: any) {
      console.error('Error merging payment accounts:', error);
      Alert.alert('Error', error.message || 'Failed to merge payment accounts');
    }
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
        <Text style={styles.headerTitle}>Manage Payment Accounts</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Accounts List */}
        <View style={styles.accountsList}>
          {/* Add New Account Button */}
          {!showAddForm && !mergeMode && (
            <TouchableOpacity
              style={styles.accountCard}
              onPress={() => setShowAddForm(true)}
            >
              <View style={styles.addAccountRow}>
                <Ionicons name="add-circle" size={20} color="#6C5CE7" />
                <Text style={styles.addAccountText}>Add Account</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Merge Mode Header */}
          {mergeMode && (
            <View style={styles.mergeHeaderCard}>
              <Text style={styles.mergeHeaderText}>
                Select accounts to merge ({selectedAccountIds.size} selected)
              </Text>
              <View style={styles.mergeHeaderButtons}>
                <TouchableOpacity
                  style={styles.mergeCancelButton}
                  onPress={handleCancelMerge}
                >
                  <Text style={styles.mergeCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.mergeConfirmButton,
                    selectedAccountIds.size < 2 && styles.mergeConfirmButtonDisabled,
                  ]}
                  onPress={handleConfirmMerge}
                  disabled={selectedAccountIds.size < 2}
                >
                  <Text style={styles.mergeConfirmButtonText}>Merge</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Add Account Form */}
          {showAddForm && (
            <View style={styles.formCard}>
              {/* 第一行：名称 */}
              <TextInput
                style={styles.editInputInline}
                value={newName}
                onChangeText={setNewName}
                placeholder="Payment account name"
                placeholderTextColor="#95A5A6"
              />

              {/* 第二行：确认取消按钮 */}
              <View style={styles.editButtonsInline}>
                <TouchableOpacity
                  style={styles.cancelButtonInline}
                  onPress={() => {
                    setShowAddForm(false);
                    setNewName('');
                  }}
                >
                  <Text style={styles.cancelButtonTextInline}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButtonInline}
                  onPress={handleAddAccount}
                >
                  <Text style={styles.confirmButtonTextInline}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {accounts.map((account) => (
            <View key={account.id} style={styles.accountCard}>
              {editingId === account.id ? (
                // Edit Mode
                <View style={styles.editRow}>
                  {/* 第一行：名称 */}
                  <TextInput
                    style={styles.editInputInline}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Payment account name"
                    placeholderTextColor="#95A5A6"
                  />
                  {/* 第二行：确认取消按钮 */}
                  <View style={styles.editButtonsInline}>
                    <TouchableOpacity
                      style={styles.cancelButtonInline}
                      onPress={cancelEdit}
                    >
                      <Text style={styles.cancelButtonTextInline}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmButtonInline}
                      onPress={() => handleUpdateAccount(account.id)}
                    >
                      <Text style={styles.confirmButtonTextInline}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Display Mode
                <TouchableOpacity
                  style={[
                    styles.accountRow,
                    mergeMode && selectedAccountIds.has(account.id) && styles.accountRowSelected,
                  ]}
                  onPress={() => {
                    if (mergeMode) {
                      toggleAccountSelection(account.id);
                    }
                  }}
                  disabled={!mergeMode}
                >
                  {mergeMode && (
                    <View style={styles.checkboxContainer}>
                      {selectedAccountIds.has(account.id) ? (
                        <Ionicons name="checkbox" size={24} color="#6C5CE7" />
                      ) : (
                        <Ionicons name="checkbox-outline" size={24} color="#BDC3C7" />
                      )}
                    </View>
                  )}
                  <View style={styles.accountIndicator}>
                    <Ionicons name="card-outline" size={16} color="#6C5CE7" />
                  </View>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {account.name}
                  </Text>
                  {account.isAiRecognized && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                  {!mergeMode && (
                    <View style={styles.accountActions}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => startEdit(account)}
                      >
                        <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeleteAccount(account)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Merge Accounts Button (at bottom) */}
        {!mergeMode && !showAddForm && (
          <TouchableOpacity
            style={styles.mergeAccountCard}
            onPress={handleStartMerge}
          >
            <View style={styles.addAccountRow}>
              <Ionicons name="git-merge-outline" size={20} color="#FF9500" />
              <Text style={styles.mergeAccountText}>Merge Accounts</Text>
            </View>
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
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
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  mergeAccountCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  accountName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#2D3436',
  },
  aiBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  mergeAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9500',
  },
  iconButton: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'column',
    gap: 8,
  },
  editInputInline: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 8,
    fontSize: 15,
    color: '#2D3436',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 8,
  },
  editButtonsInline: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    alignItems: 'center',
  },
  cancelButtonInline: {
    backgroundColor: '#E9ECEF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  confirmButtonInline: {
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButtonTextInline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#636E72',
  },
  confirmButtonTextInline: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  mergeHeaderCard: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  mergeHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
    textAlign: 'center',
  },
  mergeHeaderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mergeCancelButton: {
    flex: 1,
    backgroundColor: '#E9ECEF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mergeCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#636E72',
  },
  mergeConfirmButton: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mergeConfirmButtonDisabled: {
    backgroundColor: '#BDC3C7',
    opacity: 0.5,
  },
  mergeConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  checkboxContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  accountRowSelected: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 4,
  },
});

