import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReceipts, deleteReceipt } from '@/lib/database';
import { Receipt, ReceiptStatus } from '@/types';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { SwipeableRow } from './SwipeableRow';

const statusColors: Record<ReceiptStatus, string> = {
  pending: '#FF9500',
  processing: '#9B59B6',
  confirmed: '#00B894',
  needs_retake: '#E74C3C',
  duplicate: '#95A5A6',
};

const statusLabels: Record<ReceiptStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  confirmed: 'Confirmed',
  needs_retake: 'Needs Retake',
  duplicate: 'Duplicate',
};

interface SectionData {
  title: string;
  monthKey: string;
  data: Receipt[];
  originalData?: Receipt[]; // 用于统计的原始数据
}

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const router = useRouter();

  const loadReceipts = useCallback(async () => {
    try {
      const data = await getAllReceipts();
      setReceipts(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load receipts');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 设置 Supabase Realtime 订阅监听所有相关表的变化
  useEffect(() => {
    let receiptsChannel: any = null;
    let receiptItemsChannel: any = null;
    let paymentAccountsChannel: any = null;
    let refreshTimeout: NodeJS.Timeout | null = null;

    const setupSubscriptions = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        // 防抖函数：避免频繁刷新
        const debouncedRefresh = () => {
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
          }
          refreshTimeout = setTimeout(() => {
            console.log('Refreshing receipts list due to database changes');
    loadReceipts();
          }, 300); // 300ms 防抖延迟
        };

        // 1. 监听 receipts 表的变化（入库、状态变化、主要信息更新）
        receiptsChannel = supabase
          .channel(`receipts-changes-${user.householdId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'receipts',
              filter: `household_id=eq.${user.householdId}`,
            },
            (payload) => {
              const receiptId = (payload.new as any)?.id || (payload.old as any)?.id;
              console.log('Receipt changed:', payload.eventType, receiptId);
              
              if (payload.eventType === 'INSERT') {
                console.log('New receipt added - refreshing list');
              } else if (payload.eventType === 'UPDATE') {
                console.log('Receipt updated - status or content changed');
                // 检查状态是否变化
                if (payload.new?.status !== payload.old?.status) {
                  console.log(`Status changed: ${payload.old?.status} -> ${payload.new?.status}`);
                }
              } else if (payload.eventType === 'DELETE') {
                console.log('Receipt deleted - refreshing list');
              }
              
              debouncedRefresh();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscribed to receipts changes');
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Channel error - Realtime may not be enabled for receipts table');
            }
          });

        // 2. 监听 receipt_items 表的变化（商品项的变化会影响列表显示）
        receiptItemsChannel = supabase
          .channel(`receipt-items-changes-${user.householdId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'receipt_items',
            },
            (payload) => {
              console.log('Receipt item changed:', payload.eventType);
              // 商品项变化时也需要刷新列表（虽然列表不直接显示商品项，但可能影响排序等）
              debouncedRefresh();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscribed to receipt_items changes');
            }
          });

        // 3. 监听 payment_accounts 表的变化（支付账户名称变化会影响显示）
        paymentAccountsChannel = supabase
          .channel(`payment-accounts-changes-${user.householdId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'payment_accounts',
              filter: `household_id=eq.${user.householdId}`,
            },
            (payload) => {
              console.log('Payment account changed:', payload.eventType);
              // 支付账户变化时刷新列表
              debouncedRefresh();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscribed to payment_accounts changes');
            }
          });

      } catch (error) {
        console.error('Error setting up subscriptions:', error);
      }
    };

    setupSubscriptions();

    // 清理函数：组件卸载时取消所有订阅
    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      if (receiptsChannel) {
        supabase.removeChannel(receiptsChannel);
      }
      if (receiptItemsChannel) {
        supabase.removeChannel(receiptItemsChannel);
      }
      if (paymentAccountsChannel) {
        supabase.removeChannel(paymentAccountsChannel);
      }
    };
  }, [loadReceipts]);

  // 页面聚焦时重新加载数据
  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setSelectedIds(new Set());
    loadReceipts();
  };

  const handleToggleSelect = (receiptId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receiptId)) {
        newSet.delete(receiptId);
      } else {
        newSet.add(receiptId);
      }
      return newSet;
    });
  };

  const handleDeleteSingle = async (receiptId: string) => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
              try {
              await deleteReceipt(receiptId);
                loadReceipts();
              } catch (error) {
              Alert.alert('Error', 'Failed to delete receipt');
              }
          },
        },
      ]
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    Alert.alert(
      'Delete Receipts',
      `Are you sure you want to delete ${selectedIds.size} receipt(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = Array.from(selectedIds).map(id => deleteReceipt(id));
              await Promise.all(deletePromises);
              setSelectedIds(new Set());
              loadReceipts();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete some receipts');
              loadReceipts();
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} minutes ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else {
        return formatDate(dateString);
      }
    } catch {
      return dateString;
    }
  };

  // 按月份分组小票
  const groupReceiptsByMonth = useCallback((receipts: Receipt[]): SectionData[] => {
    const grouped = new Map<string, Receipt[]>();
    
    receipts.forEach(receipt => {
      try {
        const date = new Date(receipt.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthTitle = format(date, 'MMMM yyyy');
        
        if (!grouped.has(monthKey)) {
          grouped.set(monthKey, []);
        }
        grouped.get(monthKey)!.push(receipt);
      } catch (error) {
        console.error('Error parsing date:', receipt.date, error);
      }
    });

    // 转换为数组并按月份倒序排列（最新的在前）
    return Array.from(grouped.entries())
      .map(([monthKey, data]) => {
        const date = new Date(data[0].date);
        return {
          title: format(date, 'MMMM yyyy'),
          monthKey,
          data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, []);

  const sections = groupReceiptsByMonth(receipts);

  const toggleSection = (monthKey: string) => {
    setCollapsedSections((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {selectedIds.size > 0 ? (
            <>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setSelectedIds(new Set())}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
              <View style={styles.selectedCountContainer}>
                <Text style={styles.selectedCountText}>{selectedIds.size} selected</Text>
        </View>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleBatchDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Filter</Text>
            <Ionicons name="chevron-down" size={16} color="#636E72" />
          </TouchableOpacity>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#636E72" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor="#95A5A6"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <Text style={styles.countText}>{receipts.length}</Text>
            </>
          )}
        </View>
      </View>

      <SectionList
        sections={sections.map(section => {
          const isCollapsed = collapsedSections.has(section.monthKey);
          return {
            ...section,
            data: isCollapsed ? [] : section.data,
            // 保留原始数据用于统计
            originalData: section.data,
          };
        })}
        keyExtractor={(item: Receipt) => item.id || Math.random().toString()}
        renderItem={({ item }: { item: Receipt }) => {
          const isSelected = item.id ? selectedIds.has(item.id) : false;
          const isSelectionMode = selectedIds.size > 0;
          
          return (
            <SwipeableRow
              onDelete={() => item.id && handleDeleteSingle(item.id)}
              disabled={isSelectionMode}
            >
          <TouchableOpacity
                style={[
                  styles.receiptItem,
                  isSelected && styles.receiptItemSelected,
                ]}
                onPress={() => {
                  if (isSelectionMode) {
                    if (item.id) handleToggleSelect(item.id);
                  } else {
                    router.push(`/receipt-details/${item.id}`);
                  }
                }}
                onLongPress={() => {
                  if (item.id && !isSelectionMode) {
                    handleToggleSelect(item.id);
                  }
                }}
                activeOpacity={0.7}
              >
                {isSelectionMode && (
                  <View style={styles.checkboxContainer}>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                  </View>
                )}
            <View style={styles.receiptContent}>
                  <View style={styles.firstRow}>
              <Text style={styles.storeName} numberOfLines={1}>
                {item.storeName}
              </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[item.status] },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {statusLabels[item.status]}
                  </Text>
                </View>
                  </View>
                  <View style={styles.secondRow}>
                    <Text style={styles.amount}>${item.totalAmount.toFixed(2)}</Text>
                    <Text style={styles.date}>{formatDate(item.date)}</Text>
                    <Text style={styles.createdDate}>
                      {item.createdAt ? formatTimeAgo(item.createdAt) : formatDate(item.date)}
                </Text>
              </View>
            </View>
              </TouchableOpacity>
            </SwipeableRow>
          );
        }}
        renderSectionHeader={({ section }: { section: SectionData }) => {
          const isCollapsed = collapsedSections.has(section.monthKey);
          // 使用原始数据（originalData）或当前数据（data）进行统计，确保折叠后统计也正确
          const dataForStats = section.originalData || section.data;
          // 只统计"已确认"状态的小票
          const confirmedReceipts = dataForStats.filter((receipt: Receipt) => receipt.status === 'confirmed');
          const confirmedCount = confirmedReceipts.length;
          const totalAmount = confirmedReceipts.reduce((sum: number, receipt: Receipt) => sum + receipt.totalAmount, 0);
          
          return (
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.monthKey)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderContent}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={styles.sectionCount}>{confirmedCount} receipts</Text>
                  <Text style={styles.sectionAmount}>${totalAmount.toFixed(2)}</Text>
                  <Ionicons
                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                    size={20}
                    color="#636E72"
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyText}>No receipts yet</Text>
            <Text style={styles.emptySubtext}>Tap the button to add a receipt</Text>
          </View>
        }
        contentContainerStyle={sections.length === 0 ? styles.emptyList : styles.listContent}
        stickySectionHeadersEnabled={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/camera')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  selectedCountContainer: {
    flex: 1,
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '600',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    fontSize: 14,
    color: '#636E72',
    marginRight: 4,
    fontWeight: '500',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D3436',
    padding: 0,
  },
  countText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },
  receiptItem: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptItemSelected: {
    backgroundColor: '#E8F4FD',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#BDC3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  receiptContent: {
    flex: 1,
  },
  firstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  storeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  date: {
    fontSize: 14,
    color: '#636E72',
  },
  createdDate: {
    fontSize: 14,
    color: '#636E72',
    marginLeft: 'auto',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyList: {
    flexGrow: 1,
  },
  sectionHeader: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionCount: {
    fontSize: 14,
    color: '#636E72',
  },
  sectionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  listContent: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#636E72',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95A5A6',
    marginTop: 8,
  },
});

