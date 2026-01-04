import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReceipts, deleteReceipt } from '@/lib/database';
import { Receipt, ReceiptStatus } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const statusColors: Record<ReceiptStatus, string> = {
  pending: '#FF9500',
  processing: '#9B59B6',
  confirmed: '#00B894',
};

const statusLabels: Record<ReceiptStatus, string> = {
  pending: '待确认',
  processing: '处理中',
  confirmed: '已确认',
};

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadReceipts = async () => {
    try {
      const data = await getAllReceipts();
      setReceipts(data);
    } catch (error) {
      Alert.alert('错误', '加载小票列表失败');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadReceipts();
  };

  const handleDelete = (receipt: Receipt) => {
    Alert.alert(
      '删除小票',
      `确定要删除 ${receipt.storeName} 的小票吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (receipt.id) {
              try {
                await deleteReceipt(receipt.id);
                loadReceipts();
              } catch (error) {
                Alert.alert('错误', '删除失败');
              }
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy', { locale: zhCN });
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
        return `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else {
        return formatDate(dateString);
      }
    } catch {
      return dateString;
    }
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>我的小票</Text>
          <TouchableOpacity>
            <Ionicons name="search" size={24} color="#2D3436" />
          </TouchableOpacity>
        </View>
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>总小票数: {receipts.length}</Text>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>筛选</Text>
            <Ionicons name="chevron-down" size={16} color="#636E72" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.receiptItem}
            onPress={() => router.push(`/receipt-details/${item.id}`)}
          >
            <View style={styles.receiptContent}>
              <Text style={styles.storeName} numberOfLines={1}>
                {item.storeName}
              </Text>
              <View style={styles.receiptRow}>
                <Text style={styles.amount}>${item.totalAmount.toFixed(2)}</Text>
                <Text style={styles.date}>{formatDate(item.date)}</Text>
              </View>
              <View style={styles.receiptRow}>
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
                <Text style={styles.detailText}>
                  {item.updatedAt
                    ? `${formatTimeAgo(item.updatedAt)} ${item.processedBy ? `by ${item.processedBy}` : ''}`
                    : formatDate(item.date)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#BDC3C7" />
            <Text style={styles.emptyText}>还没有小票</Text>
            <Text style={styles.emptySubtext}>点击右下角按钮添加小票</Text>
          </View>
        }
        contentContainerStyle={receipts.length === 0 ? styles.emptyList : undefined}
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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: '#636E72',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterText: {
    fontSize: 14,
    color: '#636E72',
    marginRight: 4,
  },
  receiptItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptContent: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
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
  detailText: {
    fontSize: 12,
    color: '#636E72',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
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

