import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { saveReceipt } from '@/lib/database';
import { getPaymentAccounts } from '@/lib/payment-accounts';
import { Receipt, ReceiptStatus, PaymentAccount } from '@/types';
import { format } from 'date-fns';

export default function ManualEntryScreen() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState<string | undefined>(undefined);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [showPaymentAccountPicker, setShowPaymentAccountPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPaymentAccounts();
  }, []);

  const loadPaymentAccounts = async () => {
    try {
      const accounts = await getPaymentAccounts();
      setPaymentAccounts(accounts);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  const handleSave = async () => {
    // 验证必填字段
    if (!storeName.trim()) {
      Alert.alert('Error', 'Please enter store name');
      return;
    }

    if (!totalAmount.trim()) {
      Alert.alert('Error', 'Please enter total amount');
      return;
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setIsSaving(true);

      const receipt: Receipt = {
        householdId: '', // 会在 saveReceipt 中自动获取
        storeName: storeName.trim(),
        totalAmount: amount,
        date: date,
        status: 'confirmed' as ReceiptStatus,
        items: [],
        currency: 'USD',
        tax: 0,
        paymentAccountId: paymentAccountId,
      };

      const receiptId = await saveReceipt(receipt);

      Alert.alert(
        'Success',
        'Receipt saved successfully',
        [
          {
            text: 'Add Another',
            onPress: () => {
              // 重置表单
              setStoreName('');
              setDate(format(new Date(), 'yyyy-MM-dd'));
              setTotalAmount('');
              setPaymentAccountId(undefined);
            },
            style: 'cancel',
          },
          {
            text: 'Done',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPaymentAccount = paymentAccounts.find(acc => acc.id === paymentAccountId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Voucher</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Store Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter store name"
              placeholderTextColor="#95A5A6"
              value={storeName}
              onChangeText={setStoreName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#95A5A6"
              value={date}
              onChangeText={setDate}
              keyboardType="default"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Amount *</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#95A5A6"
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Account</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowPaymentAccountPicker(true)}
            >
              <Text style={[
                styles.pickerText,
                !selectedPaymentAccount && styles.pickerPlaceholder
              ]}>
                {selectedPaymentAccount ? selectedPaymentAccount.name : 'Select payment account'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#636E72" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" style={styles.saveButtonIcon} />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Payment Account Picker Modal */}
      {showPaymentAccountPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Account</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentAccountPicker(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#2D3436" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setPaymentAccountId(undefined);
                  setShowPaymentAccountPicker(false);
                }}
              >
                <Text style={[
                  styles.modalItemText,
                  !paymentAccountId && styles.modalItemTextSelected
                ]}>
                  None
                </Text>
                {!paymentAccountId && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>
              {paymentAccounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setPaymentAccountId(account.id);
                    setShowPaymentAccountPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    paymentAccountId === account.id && styles.modalItemTextSelected
                  ]}>
                    {account.name}
                  </Text>
                  {paymentAccountId === account.id && (
                    <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D3436',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pickerButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pickerText: {
    fontSize: 16,
    color: '#2D3436',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#95A5A6',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 0,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2D3436',
  },
  modalItemTextSelected: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
});

