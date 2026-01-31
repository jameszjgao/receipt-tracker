import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
// DocumentScanner 将在需要时动态导入（因为它在 Expo Go 中不可用）
import Constants from 'expo-constants';
import { getAllReceipts, deleteReceipt, saveReceipt } from '@/lib/database';
import { Receipt, ReceiptStatus } from '@/types';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { SwipeableRow } from './SwipeableRow';
import { uploadReceiptImageTemp } from '@/lib/supabase';
import { processReceiptInBackground } from '@/lib/receipt-processor';
import { processImageForUpload } from '@/lib/image-processor';
import { getExchangeRates, sumAmountsInCurrency } from '@/lib/exchange-rates';

// 分组类型：
// - month: 按交易时间（票面日期）的月份分组
// - recordDate: 按记录时间（创建时间）的日期分组（按天）
// - paymentAccount: 按支付账户分组
// - createdBy: 按提交人分组
type GroupByType = 'month' | 'recordDate' | 'paymentAccount' | 'createdBy';

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

// 根据币种代码获取货币符号
const getCurrencySymbol = (currency?: string): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    CAD: 'C$',
    CNY: '¥',
    JPY: '¥',
    EUR: '€',
    GBP: '£',
    AUD: 'A$',
    HKD: 'HK$',
    TWD: 'NT$',
    KRW: '₩',
    SGD: 'S$',
    MXN: 'MX$',
    INR: '₹',
    THB: '฿',
    VND: '₫',
    PHP: '₱',
    MYR: 'RM',
    IDR: 'Rp',
  };
  return symbols[currency || 'USD'] || (currency ? `${currency} ` : '$');
};

// 格式化金额，根据币种显示相应符号（返回字符串，用于简单场景）
const formatAmount = (amount: number, currency?: string): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
};

// 金额显示组件：符号弱化，数字突出
const AmountText = ({ amount, currency, style }: { amount: number; currency?: string; style?: any }) => {
  const symbol = getCurrencySymbol(currency);
  const baseSize = style?.fontSize || 16;
  return (
    <Text style={style}>
      <Text style={{ color: '#A0A0A0', fontSize: baseSize - 2 }}>{symbol}</Text>
      <Text style={{ fontWeight: '600' }}>{amount.toFixed(2)}</Text>
    </Text>
  );
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
  const [groupBy, setGroupBy] = useState<GroupByType>('month');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  // 交易时间（月维度：YYYY-MM）
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  // 记录时间（日维度：YYYY-MM-DD）
  const [selectedRecordDates, setSelectedRecordDates] = useState<Set<string>>(new Set());
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [filterSubMenu, setFilterSubMenu] = useState<'main' | 'month' | 'recordDate' | 'account' | 'creator'>('main');
  // 汇率缓存（用于跨币种金额折算）
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [showFabActions, setShowFabActions] = useState(false);
  const fabAnimation = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  
  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

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

  const scanDocument = async () => {
    if (isExpoGo) {
      Alert.alert(
        'Development Build Required',
        'Real-time edge detection and cropping requires a native development build. In Expo Go, please use the gallery picker option.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pick from Gallery', onPress: pickImage }
        ]
      );
      return;
    }

    try {
      // 动态导入 DocumentScanner（只在非 Expo Go 环境中导入）
      const module = await import('react-native-document-scanner-plugin');
      const DocumentScanner = module?.default;

      // 额外防御：模块导入但没有正确挂载时，直接提示使用开发构建
      if (!DocumentScanner || typeof DocumentScanner.scanDocument !== 'function') {
        throw new Error('DocumentScanner module not loaded correctly');
      }

      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 90,
        letUserAdjustCrop: false,  // 自动裁剪，无需手动调整
      } as any);

      if (scannedImages && scannedImages.length > 0) {
        // 自动裁剪后直接处理，实现 Snap 即拍即传
        processCapturedImage(scannedImages[0], false);
      }
    } catch (error) {
      console.error('Document scan error:', error);
      // 如果是模块未找到或原生模块未正确注册的错误，统一提示需要开发构建
      if (
        error instanceof Error &&
        (error.message?.includes('TurboModuleRegistry') ||
          error.message?.includes('Requiring unknown module') ||
          error.message?.includes('module not loaded correctly'))
      ) {
        Alert.alert(
          'Development Build Required',
          'Document scanner requires a native development build. Please use a development build or use the gallery picker option.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Pick from Gallery', onPress: pickImage }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to snap document. Please try again.');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        // 从相册选择的图片通常未裁剪，这里保留自动裁剪逻辑
        processCapturedImage(result.assets[0].uri, true);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  // autoCrop 参数：
  // - 扫描得到的图片（已在原生层裁剪）应传入 false，避免二次裁剪截断内容
  // - 从相册选择的原始图片可以传入 true，启用自动裁剪去除背景
  const processCapturedImage = async (imageUri: string, autoCrop: boolean = true) => {
    // 立即显示选单，后台处理上传
    setShowSuccessModal(true);
    setLastReceiptId(null); // 初始为 null，上传完成后更新
    
    // 后台异步处理（不阻塞 UI）
    (async () => {
      try {
        console.log('Processing captured image:', imageUri);

        const processedImageUri = await processImageForUpload(imageUri, {
          autoCrop,
          quality: 0.85,
        });
        console.log('Image processed:', processedImageUri);

        const tempFileName = `temp-${Date.now()}`;
        const imageUrl = await uploadReceiptImageTemp(processedImageUri, tempFileName);
        console.log('Image uploaded:', imageUrl);

        const today = new Date().toISOString().split('T')[0];
        const receiptId = await saveReceipt({
          spaceId: '',
          supplierName: 'Processing...',
          totalAmount: 0,
          date: today,
          status: 'processing',
          items: [],
          imageUrl: imageUrl,
        });
        console.log('Receipt record created:', receiptId);

        // 更新 receiptId，使 View Detail 可用
        setLastReceiptId(receiptId);
        
        // Refresh receipts list
        loadReceipts();

        // Background processing with Gemini (async, don't block UI)
        processReceiptInBackground(imageUrl, receiptId, processedImageUri)
          .then(() => {
            console.log('Background processing started');
            // Refresh again after processing
            loadReceipts();
          })
          .catch(err => console.error('Background processing failed:', err));
      } catch (error) {
        console.error('Processing error:', error);
        Alert.alert('Error', 'Failed to process receipt.');
        setShowSuccessModal(false);
      }
    })();
  };

  const handleCameraPress = () => {
    // 点击主「+」按钮：展开 / 收起 二级操作按钮，并带出浮动动画
    if (!showFabActions) {
      setShowFabActions(true);
      fabAnimation.setValue(0);
      Animated.timing(fabAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fabAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowFabActions(false);
      });
    }
  };

  const handleScanFromFab = () => {
    // 直接执行扫描入口，并收起按钮组（不再播放收回动画）
    setShowFabActions(false);
    scanDocument();
  };

  const handleChatFromFab = () => {
    // 直接执行聊天录入入口，并收起按钮组（不再播放收回动画）
    setShowFabActions(false);
    router.push('/voice-input');
  };

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
        const spaceId = user.currentSpaceId || user.spaceId;
        if (!spaceId) return;
        receiptsChannel = supabase
          .channel(`receipts-changes-${spaceId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'receipts',
              filter: `space_id=eq.${spaceId}`,
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
          .channel(`receipt-items-changes-${spaceId}`)
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
          .channel(`payment-accounts-changes-${spaceId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'payment_accounts',
              filter: `space_id=eq.${spaceId}`,
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
      // 异步加载汇率（不阻塞 UI）
      getExchangeRates().then(rates => setExchangeRates(rates));
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
              // 乐观更新：直接从列表中移除，不需要重新加载所有小票
              setReceipts(prev => prev.filter(r => r.id !== receiptId));
              setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(receiptId);
                return newSet;
              });
              } catch (error) {
              Alert.alert('Error', 'Failed to delete receipt');
              // 如果失败，重新加载以确保数据一致
              loadReceipts();
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
              // 乐观更新：直接从列表中移除，不需要重新加载所有小票
              const idsToDelete = Array.from(selectedIds);
              setReceipts(prev => prev.filter(r => r.id && !idsToDelete.includes(r.id)));
              setSelectedIds(new Set());
            } catch (error) {
              Alert.alert('Error', 'Failed to delete some receipts');
              // 如果失败，重新加载以确保数据一致
              loadReceipts();
            }
          },
        },
      ]
    );
  };

  // 解析日期字符串为本地时区，避免 UTC 时区转换问题
  const parseLocalDate = (dateString: string): Date => {
    // dateString 格式应为 "YYYY-MM-DD"
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = parseLocalDate(dateString);
      return format(date, 'MMM dd, yyyy');
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
        // 对于超过24小时的时间戳，需要先提取日期部分再格式化
        // dateString 可能是 ISO 时间戳（如 "2024-01-15T10:30:00Z"）
        let dateOnly = dateString;
        if (dateString.includes('T')) {
          // 从 ISO 时间戳中提取日期部分
          dateOnly = dateString.split('T')[0];
        }
        return formatDate(dateOnly);
      }
    } catch {
      return dateString;
    }
  };

  // 按交易时间（票面日期）的月份分组小票
  const groupReceiptsByMonth = useCallback((receipts: Receipt[]): SectionData[] => {
    const grouped = new Map<string, Receipt[]>();
    
    receipts.forEach(receipt => {
      try {
        const date = parseLocalDate(receipt.date);
        const monthKey = `month-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
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
        const date = parseLocalDate(data[0].date);
        return {
          title: format(date, 'MMMM yyyy'),
          monthKey,
          data: data.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, []);

  // 按记录时间（创建时间，按天）分组小票
  const groupReceiptsByRecordDate = useCallback((receipts: Receipt[]): SectionData[] => {
    const grouped = new Map<string, Receipt[]>();

    receipts.forEach(receipt => {
      try {
        if (!receipt.createdAt) {
          return;
        }
        const createdAt = new Date(receipt.createdAt);
        const year = createdAt.getFullYear();
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const day = String(createdAt.getDate()).padStart(2, '0');
        const dayKey = `record-${year}-${month}-${day}`;

        if (!grouped.has(dayKey)) {
          grouped.set(dayKey, []);
        }
        grouped.get(dayKey)!.push(receipt);
      } catch (error) {
        console.error('Error parsing createdAt:', receipt.createdAt, error);
      }
    });

    // 转换为数组并按日期倒序排列（最新的在前）
    return Array.from(grouped.entries())
      .map(([dayKey, data]) => {
        const sample = data[0];
        const baseDate = sample.createdAt ? new Date(sample.createdAt) : parseLocalDate(sample.date);
        const dateOnly = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate()
        );

        return {
          title: format(dateOnly, 'MMM dd, yyyy'),
          monthKey: dayKey,
          data: data.slice().sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : parseLocalDate(a.date).getTime();
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : parseLocalDate(b.date).getTime();
            return bTime - aTime;
          }),
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, []);

  // 按支付账户分组小票
  const groupReceiptsByPaymentAccount = useCallback((receipts: Receipt[]): SectionData[] => {
    const grouped = new Map<string, Receipt[]>();
    
    receipts.forEach(receipt => {
      const accountName = receipt.paymentAccount?.name || 'Not Set';
      const accountKey = `account-${receipt.paymentAccount?.id || 'none'}`;
      
      if (!grouped.has(accountKey)) {
        grouped.set(accountKey, []);
      }
      grouped.get(accountKey)!.push(receipt);
    });

    // 转换为数组并按账户名称排序
    return Array.from(grouped.entries())
      .map(([accountKey, data]) => {
        const accountName = data[0].paymentAccount?.name || 'Not Set';
        return {
          title: accountName,
          monthKey: accountKey,
          data: data.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
        };
      })
      .sort((a, b) => {
        // 未设置账户放在最后
        if (a.title === 'Not Set') return 1;
        if (b.title === 'Not Set') return -1;
        return a.title.localeCompare(b.title);
      });
  }, []);

  // 按提交人员分组小票
  const groupReceiptsByCreatedBy = useCallback((receipts: Receipt[]): SectionData[] => {
    const grouped = new Map<string, Receipt[]>();
    
    receipts.forEach(receipt => {
      const userName = receipt.createdByUser?.name || receipt.createdByUser?.email?.split('@')[0] || 'Unknown';
      const userKey = `user-${receipt.createdBy || 'unknown'}`;
      
      if (!grouped.has(userKey)) {
        grouped.set(userKey, []);
      }
      grouped.get(userKey)!.push(receipt);
    });

    // 转换为数组并按用户名排序
    return Array.from(grouped.entries())
      .map(([userKey, data]) => {
        const userName = data[0].createdByUser?.name || data[0].createdByUser?.email?.split('@')[0] || 'Unknown';
        return {
          title: userName,
          monthKey: userKey,
          data: data.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, []);

  // 根据分组类型获取分组数据
  const getGroupedReceipts = useCallback((receipts: Receipt[]): SectionData[] => {
    switch (groupBy) {
      case 'recordDate':
        return groupReceiptsByRecordDate(receipts);
      case 'paymentAccount':
        return groupReceiptsByPaymentAccount(receipts);
      case 'createdBy':
        return groupReceiptsByCreatedBy(receipts);
      case 'month':
      default:
        return groupReceiptsByMonth(receipts);
    }
  }, [groupBy, groupReceiptsByMonth, groupReceiptsByRecordDate, groupReceiptsByPaymentAccount, groupReceiptsByCreatedBy]);

  // 筛选小票（交集筛选）
  const filteredReceipts = useMemo(() => {
    let filtered = receipts;

    // 按交易时间（月）筛选
    if (selectedMonths.size > 0) {
      filtered = filtered.filter(receipt => {
        try {
          const date = parseLocalDate(receipt.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return selectedMonths.has(monthKey);
        } catch {
          return false;
        }
      });
    }

    // 按记录时间（创建时间，按天）筛选
    if (selectedRecordDates.size > 0) {
      filtered = filtered.filter(receipt => {
        if (!receipt.createdAt) return false;
        try {
          const createdAt = new Date(receipt.createdAt);
          const year = createdAt.getFullYear();
          const month = String(createdAt.getMonth() + 1).padStart(2, '0');
          const day = String(createdAt.getDate()).padStart(2, '0');
          const dayKey = `${year}-${month}-${day}`;
          return selectedRecordDates.has(dayKey);
        } catch {
          return false;
        }
      });
    }

    // 按账户筛选
    if (selectedAccounts.size > 0) {
      filtered = filtered.filter(receipt => {
        const accountId = receipt.paymentAccount?.id || 'none';
        return selectedAccounts.has(accountId);
      });
    }

    // 按提交人筛选
    if (selectedCreators.size > 0) {
      filtered = filtered.filter(receipt => {
        const creatorId = receipt.createdBy || 'unknown';
        return selectedCreators.has(creatorId);
      });
    }

    return filtered;
  }, [receipts, selectedMonths, selectedAccounts, selectedCreators]);

  // 获取所有可用的筛选选项
  const filterOptions = useMemo(() => {
    const months = new Set<string>(); // 交易时间（月）
    const recordDates = new Set<string>(); // 记录时间（天）
    const accounts = new Map<string, string>(); // id -> name
    const creators = new Map<string, string>(); // id -> name

    receipts.forEach(receipt => {
      // 交易时间（月）
      try {
        const date = parseLocalDate(receipt.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      } catch {}

      // 记录时间（天）
      if (receipt.createdAt) {
        try {
          const createdAt = new Date(receipt.createdAt);
          const year = createdAt.getFullYear();
          const month = String(createdAt.getMonth() + 1).padStart(2, '0');
          const day = String(createdAt.getDate()).padStart(2, '0');
          const dayKey = `${year}-${month}-${day}`;
          recordDates.add(dayKey);
        } catch {}
      }

      // 账户
      if (receipt.paymentAccount) {
        accounts.set(receipt.paymentAccount.id, receipt.paymentAccount.name);
      } else {
        accounts.set('none', 'Not Set');
      }

      // 提交人
      if (receipt.createdBy) {
        const userName = receipt.createdByUser?.name || receipt.createdByUser?.email?.split('@')[0] || 'Unknown';
        creators.set(receipt.createdBy, userName);
      } else {
        creators.set('unknown', 'Unknown');
      }
    });

    // 将月份转换为排序后的数组
    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    // 将记录时间（天）转换为排序后的数组
    const sortedRecordDates = Array.from(recordDates).sort((a, b) => b.localeCompare(a));

    return {
      months: sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          key: monthKey,
          label: format(date, 'MMMM yyyy'),
        };
      }),
      recordDates: sortedRecordDates.map(dayKey => {
        const [year, month, day] = dayKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return {
          key: dayKey,
          label: format(date, 'MMM dd, yyyy'),
        };
      }),
      accounts: Array.from(accounts.entries()).map(([id, name]) => ({ id, name })),
      creators: Array.from(creators.entries()).map(([id, name]) => ({ id, name })),
    };
  }, [receipts]);

  // 搜索小票（在筛选后的结果中搜索）
  const searchedReceipts = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredReceipts;
    }

    const query = searchQuery.trim().toLowerCase();
    
    return filteredReceipts.filter(receipt => {
      // 搜索供应商名称（优先使用 supplier.name，兼容旧数据的 supplierName）
      const displaySupplierName = receipt.supplier?.name || receipt.supplierName || '';
      const supplierNameMatch = displaySupplierName.toLowerCase().includes(query);
      
      // 搜索商品明细名称
      const itemsMatch = receipt.items?.some(item => 
        item.name?.toLowerCase().includes(query)
      );
      
      return supplierNameMatch || itemsMatch;
    });
  }, [filteredReceipts, searchQuery]);

  const sections = getGroupedReceipts(searchedReceipts);

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
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => {
              setShowFilterMenu(true);
              setFilterSubMenu('main');
            }}
          >
            <Text style={styles.filterText}>
              Filter
              {(selectedMonths.size > 0 || selectedRecordDates.size > 0 || selectedAccounts.size > 0 || selectedCreators.size > 0) && (
                <Text style={styles.filterBadge}>
                  {' '}({selectedMonths.size + selectedRecordDates.size + selectedAccounts.size + selectedCreators.size})
                </Text>
              )}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#636E72" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={() => setShowSortMenu(true)}
          >
            <Text style={styles.sortText}>Group</Text>
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
                {item.supplier?.name || item.supplierName || 'Unknown Supplier'}
              </Text>
                {item.status === 'confirmed' ? (
                  <View style={styles.confirmedStatusContainer}>
                    <View style={styles.confirmedBadge}>
                      <Ionicons 
                        name={
                          item.inputType === 'audio' ? 'mic' :
                          item.inputType === 'text' ? 'menu' :
                          'camera'
                        } 
                        size={12} 
                        color="#fff" 
                      />
                    </View>
                    {item.createdByUser && (
                      <Text style={styles.confirmedByText}>
                        by {item.createdByUser.name || item.createdByUser.email?.split('@')[0] || 'Unknown'}
                      </Text>
                    )}
                  </View>
                ) : (
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
                )}
                  </View>
                  <View style={styles.secondRow}>
                    <AmountText amount={item.totalAmount} currency={item.currency} style={styles.amount} />
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
          
          // 获取分组中最常见的币种用于显示
          const currencies = confirmedReceipts.map((r: Receipt) => r.currency || 'USD');
          const dominantCurrency = currencies.length > 0 
            ? currencies.sort((a: string, b: string) => 
                currencies.filter((v: string) => v === a).length - currencies.filter((v: string) => v === b).length
              ).pop() 
            : 'USD';
          
          // 如果有汇率数据，将所有金额折算为主要币种后合计；否则直接相加
          const totalAmount = exchangeRates
            ? sumAmountsInCurrency(
                confirmedReceipts.map((r: Receipt) => ({ amount: r.totalAmount, currency: r.currency || 'USD' })),
                dominantCurrency || 'USD',
                exchangeRates
              )
            : confirmedReceipts.reduce((sum: number, receipt: Receipt) => sum + receipt.totalAmount, 0);
          
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
                  <AmountText amount={totalAmount} currency={dominantCurrency} style={styles.sectionAmount} />
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

      {/* 底部悬浮菜单：保留主「+」按钮，点击后仅显示两个新按钮（与原按钮同大小），带浮出动效 */}
      <View style={styles.fabContainer}>
        {showFabActions && (
          <View style={styles.fabActionsContainer}>
            {/* 上方：聊天录入按钮，从原 + 位置向上浮出 */}
            <Animated.View
              style={{
                transform: [
                  {
                    translateY: fabAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -0], // 浮出距离减小，让两个按钮更靠拢
                    }),
                  },
                ],
                opacity: fabAnimation,
              }}
            >
              <TouchableOpacity
                style={styles.fabAction}
                onPress={handleChatFromFab}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={28} color="#6C5CE7" />
              </TouchableOpacity>
            </Animated.View>

            {/* 下方：扫描按钮，保持在原 + 按钮位置，仅做轻微渐显 */}
            <Animated.View
              style={{
                marginTop: 8,
                opacity: fabAnimation,
              }}
            >
              <TouchableOpacity
                style={styles.fabAction}
                onPress={handleScanFromFab}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={28} color="#6C5CE7" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {!showFabActions && (
          <TouchableOpacity
            style={styles.fabMain}
            onPress={handleCameraPress}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Processing Modal - 已移除，改为静默处理 */}

      {/* Success Modal - 拍摄提交后的操作选单 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#00B894" />
            </View>
            <Text style={styles.successTitle}>Submitted!</Text>
            <Text style={styles.successSubtitle}>Receipt is being processed</Text>
            <View style={styles.successButtons}>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  scanDocument();
                }}
              >
                <Ionicons name="camera-outline" size={24} color="#6C5CE7" />
                <Text style={styles.successButtonText}>Snap Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.successButton, !lastReceiptId && { opacity: 0.5 }]}
                disabled={!lastReceiptId}
                onPress={() => {
                  setShowSuccessModal(false);
                  if (lastReceiptId) {
                    router.push(`/receipt-details/${lastReceiptId}`);
                  }
                }}
              >
                {lastReceiptId ? (
                  <Ionicons name="eye-outline" size={24} color="#6C5CE7" />
                ) : (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                )}
                <Text style={styles.successButtonText}>
                  {lastReceiptId ? 'View Detail' : 'Uploading...'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => setShowSuccessModal(false)}
              >
                <Ionicons name="checkmark-outline" size={24} color="#6C5CE7" />
                <Text style={styles.successButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 分组方式选择菜单 */}
      <Modal
        visible={showSortMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortMenu(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowSortMenu(false)}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Group By</Text>
              <TouchableOpacity
                onPress={() => setShowSortMenu(false)}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  groupBy === 'month' && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setGroupBy('month');
                  setShowSortMenu(false);
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={groupBy === 'month' ? '#6C5CE7' : '#636E72'} />
                <Text
                  style={[
                    styles.pickerOptionText,
                    groupBy === 'month' && styles.pickerOptionTextSelected,
                  ]}
                >
                  By Transaction Month
                </Text>
                {groupBy === 'month' && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  groupBy === 'paymentAccount' && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setGroupBy('paymentAccount');
                  setShowSortMenu(false);
                }}
              >
                <Ionicons name="wallet-outline" size={20} color={groupBy === 'paymentAccount' ? '#6C5CE7' : '#636E72'} />
                <Text
                  style={[
                    styles.pickerOptionText,
                    groupBy === 'paymentAccount' && styles.pickerOptionTextSelected,
                  ]}
                >
                  By Account
                </Text>
                {groupBy === 'paymentAccount' && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  groupBy === 'createdBy' && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setGroupBy('createdBy');
                  setShowSortMenu(false);
                }}
              >
                <Ionicons name="person-outline" size={20} color={groupBy === 'createdBy' ? '#6C5CE7' : '#636E72'} />
                <Text
                  style={[
                    styles.pickerOptionText,
                    groupBy === 'createdBy' && styles.pickerOptionTextSelected,
                  ]}
                >
                  By Recorder
                </Text>
                {groupBy === 'createdBy' && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  groupBy === 'recordDate' && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  setGroupBy('recordDate');
                  setShowSortMenu(false);
                }}
              >
                <Ionicons name="time-outline" size={20} color={groupBy === 'recordDate' ? '#6C5CE7' : '#636E72'} />
                <Text
                  style={[
                    styles.pickerOptionText,
                    groupBy === 'recordDate' && styles.pickerOptionTextSelected,
                  ]}
                >
                  By Record Date
                </Text>
                {groupBy === 'recordDate' && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter 菜单 */}
      <Modal
        visible={showFilterMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowFilterMenu(false);
          setFilterSubMenu('main');
        }}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowFilterMenu(false);
            setFilterSubMenu('main');
          }}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              {filterSubMenu === 'main' ? (
                <>
                  <Text style={styles.pickerTitle}>Filter</Text>
                  <View style={styles.pickerHeaderRight}>
                    {(selectedMonths.size > 0 || selectedRecordDates.size > 0 || selectedAccounts.size > 0 || selectedCreators.size > 0) && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedMonths(new Set());
                          setSelectedRecordDates(new Set());
                          setSelectedAccounts(new Set());
                          setSelectedCreators(new Set());
                        }}
                        style={styles.clearFilterButton}
                      >
                        <Text style={styles.clearFilterText}>Clear</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setShowFilterMenu(false);
                        setFilterSubMenu('main');
                      }}
                      style={styles.pickerCloseButton}
                    >
                      <Text style={styles.pickerCloseText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setFilterSubMenu('main')}
                    style={styles.pickerBackButton}
                  >
                    <Ionicons name="chevron-back" size={20} color="#6C5CE7" />
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>
                    {filterSubMenu === 'month' && 'Select Transaction Months'}
                    {filterSubMenu === 'recordDate' && 'Select Record Dates'}
                    {filterSubMenu === 'account' && 'Select Accounts'}
                    {filterSubMenu === 'creator' && 'Select Recorders'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilterSubMenu('main')}
                    style={styles.pickerCloseButton}
                  >
                    <Text style={styles.pickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {filterSubMenu === 'main' ? (
                <>
                  {/* 主菜单：多个维度选项 */}
                  <TouchableOpacity
                    style={styles.filterMainOption}
                    onPress={() => setFilterSubMenu('month')}
                  >
                    <View style={styles.filterMainOptionLeft}>
                      <Ionicons name="calendar-outline" size={20} color="#636E72" />
                      <Text style={styles.filterMainOptionText}>Transaction Month</Text>
                    </View>
                    <View style={styles.filterMainOptionRight}>
                      {selectedMonths.size > 0 && (
                        <Text style={styles.filterCountBadge}>{selectedMonths.size}</Text>
                      )}
                      <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterMainOption}
                    onPress={() => setFilterSubMenu('account')}
                  >
                    <View style={styles.filterMainOptionLeft}>
                      <Ionicons name="wallet-outline" size={20} color="#636E72" />
                      <Text style={styles.filterMainOptionText}>Account</Text>
                    </View>
                    <View style={styles.filterMainOptionRight}>
                      {selectedAccounts.size > 0 && (
                        <Text style={styles.filterCountBadge}>{selectedAccounts.size}</Text>
                      )}
                      <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterMainOption}
                    onPress={() => setFilterSubMenu('creator')}
                  >
                    <View style={styles.filterMainOptionLeft}>
                      <Ionicons name="person-outline" size={20} color="#636E72" />
                      <Text style={styles.filterMainOptionText}>Recorder</Text>
                    </View>
                    <View style={styles.filterMainOptionRight}>
                      {selectedCreators.size > 0 && (
                        <Text style={styles.filterCountBadge}>{selectedCreators.size}</Text>
                      )}
                      <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.filterMainOption}
                    onPress={() => setFilterSubMenu('recordDate')}
                  >
                    <View style={styles.filterMainOptionLeft}>
                      <Ionicons name="time-outline" size={20} color="#636E72" />
                      <Text style={styles.filterMainOptionText}>Record Date</Text>
                    </View>
                    <View style={styles.filterMainOptionRight}>
                      {selectedRecordDates.size > 0 && (
                        <Text style={styles.filterCountBadge}>{selectedRecordDates.size}</Text>
                      )}
                      <Ionicons name="chevron-forward" size={20} color="#95A5A6" />
                    </View>
                  </TouchableOpacity>
                </>
              ) : filterSubMenu === 'month' ? (
                <>
                  {/* 月份子菜单 */}
                  {filterOptions.months.map(month => {
                    const isSelected = selectedMonths.has(month.key);
                    return (
                      <TouchableOpacity
                        key={month.key}
                        style={[
                          styles.pickerOption,
                          isSelected && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedMonths(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(month.key)) {
                              newSet.delete(month.key);
                            } else {
                              newSet.add(month.key);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <View style={styles.filterOptionLeft}>
                          <View style={[
                            styles.filterCheckbox,
                            isSelected && styles.filterCheckboxSelected,
                          ]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              isSelected && styles.pickerOptionTextSelected,
                            ]}
                          >
                            {month.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : filterSubMenu === 'recordDate' ? (
                <>
                  {/* 记录时间（按天）子菜单 */}
                  {filterOptions.recordDates.map(day => {
                    const isSelected = selectedRecordDates.has(day.key);
                    return (
                      <TouchableOpacity
                        key={day.key}
                        style={[
                          styles.pickerOption,
                          isSelected && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedRecordDates(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(day.key)) {
                              newSet.delete(day.key);
                            } else {
                              newSet.add(day.key);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <View style={styles.filterOptionLeft}>
                          <View style={[
                            styles.filterCheckbox,
                            isSelected && styles.filterCheckboxSelected,
                          ]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              isSelected && styles.pickerOptionTextSelected,
                            ]}
                          >
                            {day.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : filterSubMenu === 'account' ? (
                <>
                  {/* 账户子菜单 */}
                  {filterOptions.accounts.map(account => {
                    const isSelected = selectedAccounts.has(account.id);
                    return (
                      <TouchableOpacity
                        key={account.id}
                        style={[
                          styles.pickerOption,
                          isSelected && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedAccounts(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(account.id)) {
                              newSet.delete(account.id);
                            } else {
                              newSet.add(account.id);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <View style={styles.filterOptionLeft}>
                          <View style={[
                            styles.filterCheckbox,
                            isSelected && styles.filterCheckboxSelected,
                          ]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              isSelected && styles.pickerOptionTextSelected,
                            ]}
                          >
                            {account.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* 提交人子菜单 */}
                  {filterOptions.creators.map(creator => {
                    const isSelected = selectedCreators.has(creator.id);
                    return (
                      <TouchableOpacity
                        key={creator.id}
                        style={[
                          styles.pickerOption,
                          isSelected && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedCreators(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(creator.id)) {
                              newSet.delete(creator.id);
                            } else {
                              newSet.add(creator.id);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <View style={styles.filterOptionLeft}>
                          <View style={[
                            styles.filterCheckbox,
                            isSelected && styles.filterCheckboxSelected,
                          ]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.pickerOptionText,
                              isSelected && styles.pickerOptionTextSelected,
                            ]}
                          >
                            {creator.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 略微加深灰度，让内容白色卡片更突出
    backgroundColor: '#ECEFF1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECEFF1',
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortText: {
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
  confirmedStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: statusColors.confirmed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmedByText: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
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
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'flex-end',
  },
  fabActionsContainer: {
    // 动画容器，占位在原 + 按钮位置
    alignItems: 'flex-end',
  },
  fabMain: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    // 与详情页浮动按钮统一的阴影层级
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  fabAction: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerBottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#BDC3C7',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    flex: 1,
  },
  pickerCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickerCloseText: {
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  pickerScrollView: {
    maxHeight: 400,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    minHeight: 48,
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
  pickerEmptyContent: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: '#95A5A6',
  },
  pickerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearFilterText: {
    fontSize: 14,
    color: '#E74C3C',
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    minHeight: 48,
  },
  filterOptionSelected: {
    backgroundColor: '#E8F4FD',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  filterCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#BDC3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterCheckboxSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '500',
  },
  filterOptionTextSelected: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
  filterBadge: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  pickerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterMainOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    minHeight: 56,
  },
  filterMainOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  filterMainOptionText: {
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '500',
  },
  filterMainOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCountBadge: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    textAlign: 'center',
  },
  processingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  processingModalText: {
    marginTop: 16,
    fontSize: 16,
    color: '#2D3436',
    fontWeight: '500',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 32,
  },
  successButtons: {
    width: '100%',
    gap: 12,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    gap: 12,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
});

