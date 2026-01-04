import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getReceiptById, updateReceipt } from '@/lib/database';
import { getCategories } from '@/lib/categories';
import { Receipt, ReceiptItem, Category, ItemPurpose, ReceiptStatus } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const purposes: ItemPurpose[] = ['Personnel', 'Business'];

const purposeColors: Record<ItemPurpose, string> = {
  Personnel: '#00B894',
  Business: '#FF9500',
};

export default function ReceiptDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<Receipt | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadReceipt();
    loadCategories();
  }, [id]);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadReceipt = async () => {
    if (!id) return;
    try {
      const data = await getReceiptById(id);
      setReceipt(data);
      setEditedReceipt(data);
    } catch (error) {
      Alert.alert('错误', '加载小票详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedReceipt || !id) return;

    try {
      await updateReceipt(id, {
        ...editedReceipt,
        status: 'confirmed' as ReceiptStatus,
      });
      Alert.alert('成功', '小票已确认并保存');
      setEditing(false);
      loadReceipt();
    } catch (error) {
      Alert.alert('错误', '保存失败');
      console.error(error);
    }
  };

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    if (!editedReceipt) return;

    const newItems = [...editedReceipt.items];
    const updatedItem = { ...newItems[index] };
    
    // 如果更新的是 categoryId，同时更新 category 对象
    if (field === 'categoryId') {
      const selectedCategory = categories.find(cat => cat.id === value);
      if (selectedCategory) {
        updatedItem.categoryId = value;
        updatedItem.category = selectedCategory;
      }
    } else {
      updatedItem[field] = value;
    }
    
    newItems[index] = updatedItem;
    setEditedReceipt({ ...editedReceipt, items: newItems });
  };

  const handleAddItem = () => {
    if (!editedReceipt || categories.length === 0) return;

    // 使用第一个可用分类作为默认分类
    const defaultCategory = categories.find(cat => cat.name === '购物') || categories[0];
    
    const newItem: ReceiptItem = {
      name: '',
      categoryId: defaultCategory.id,
      category: defaultCategory,
      purpose: 'Personnel',
      price: 0,
      isAsset: false,
    };
    setEditedReceipt({
      ...editedReceipt,
      items: [...editedReceipt.items, newItem],
    });
  };

  const handleDeleteItem = (index: number) => {
    if (!editedReceipt) return;

    const newItems = editedReceipt.items.filter((_, i) => i !== index);
    setEditedReceipt({ ...editedReceipt, items: newItems });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy', { locale: zhCN });
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

  if (!receipt) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>小票不存在</Text>
      </View>
    );
  }

  const currentReceipt = editing ? (editedReceipt || receipt) : receipt;

  if (!currentReceipt) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>小票不存在</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 小票摘要卡片 */}
        <View style={styles.summaryCard}>
          {currentReceipt.imageUrl && (
            <TouchableOpacity
              onPress={() => setShowImageModal(true)}
              style={styles.imagePlaceholder}
            >
              <Image
                source={{ uri: currentReceipt.imageUrl }}
                style={styles.receiptImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          <View style={styles.summaryContent}>
            <Text style={styles.storeName}>{currentReceipt.storeName}</Text>
            <Text style={styles.totalAmount}>
              ${currentReceipt.totalAmount.toFixed(2)}
            </Text>
            <Text style={styles.date}>{formatDate(currentReceipt.date)}</Text>
          </View>
        </View>

        {/* 支付账户 */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardLabel}>支付账户</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={currentReceipt.paymentAccount?.name || ''}
              onChangeText={(text) =>
                setEditedReceipt({ 
                  ...currentReceipt, 
                  paymentAccount: currentReceipt.paymentAccount 
                    ? { ...currentReceipt.paymentAccount, name: text }
                    : { id: '', name: text, householdId: '', isAiRecognized: false }
                })
              }
              placeholder="输入支付账户"
            />
          ) : (
            <Text style={styles.cardValue}>
              {currentReceipt.paymentAccount?.name || '未设置'}
            </Text>
          )}
        </View>

        {/* 商品列表 */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>商品明细</Text>
          {currentReceipt.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              {editing && (
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => handleDeleteItem(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#E74C3C" />
                </TouchableOpacity>
              )}

              {/* 第一行：商品名称 + 价格 */}
              <View style={styles.itemHeader}>
                {editing ? (
                  <TextInput
                    style={styles.itemNameInput}
                    value={item.name}
                    onChangeText={(text) => handleItemChange(index, 'name', text)}
                    placeholder="商品名称"
                  />
                ) : (
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                )}
                {editing ? (
                  <TextInput
                    style={styles.priceInput}
                    value={item.price.toString()}
                    onChangeText={(text) =>
                      handleItemChange(index, 'price', parseFloat(text) || 0)
                    }
                    keyboardType="numeric"
                    placeholder="价格"
                  />
                ) : (
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                )}
              </View>

              {/* 第二行：分类（左） + 用途（中） + 资产（右） */}
              <View style={styles.itemTags}>
                  {/* 分类标签 - 左侧，左对齐 */}
                  <View style={styles.tagGroupLeft}>
                    {editing ? (
                      <View style={styles.tagSelector}>
                        {categories.map((cat) => {
                          const isSelected = item.categoryId === cat.id || item.category?.id === cat.id;
                          return (
                            <TouchableOpacity
                              key={cat.id}
                              style={[
                                styles.tag,
                                {
                                  backgroundColor: isSelected ? (cat.color || '#95A5A6') : '#E9ECEF',
                                },
                              ]}
                              onPress={() => handleItemChange(index, 'categoryId', cat.id)}
                            >
                              <Text
                                style={[
                                  styles.tagText,
                                  {
                                    color: isSelected ? '#fff' : '#636E72',
                                  },
                                ]}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.tag,
                          { backgroundColor: item.category?.color || '#95A5A6' },
                        ]}
                      >
                        <Text style={styles.tagText}>{item.category?.name || '未知分类'}</Text>
                      </View>
                    )}
                  </View>

                  {/* 用途标签 - 居中，左对齐 */}
                  <View style={styles.tagGroupCenter}>
                    {editing ? (
                      <View style={styles.tagSelector}>
                        {purposes.map((purpose) => (
                          <TouchableOpacity
                            key={purpose}
                            style={[
                              styles.tag,
                              {
                                backgroundColor:
                                  item.purpose === purpose
                                    ? purposeColors[purpose]
                                    : '#E9ECEF',
                              },
                            ]}
                            onPress={() => handleItemChange(index, 'purpose', purpose)}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                {
                                  color: item.purpose === purpose ? '#fff' : '#636E72',
                                },
                              ]}
                            >
                              {purpose}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.tag,
                          { backgroundColor: purposeColors[item.purpose] },
                        ]}
                      >
                        <Text style={styles.tagText}>{item.purpose}</Text>
                      </View>
                    )}
                  </View>

                  {/* 资产标签 - 右侧，右对齐 */}
                  <View style={styles.tagGroupRight}>
                    <TouchableOpacity
                      style={styles.assetTag}
                      onPress={() =>
                        handleItemChange(index, 'isAsset', !item.isAsset)
                      }
                    >
                      <Ionicons
                        name={item.isAsset ? 'checkbox' : 'checkbox-outline'}
                        size={16}
                        color={item.isAsset ? '#6C5CE7' : '#BDC3C7'}
                      />
                      <Text style={[
                        styles.assetTagText,
                        { color: item.isAsset ? '#6C5CE7' : '#BDC3C7' }
                      ]}>
                        资产
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
            </View>
          ))}

          {editing && (
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={handleAddItem}
            >
              <Ionicons name="add-circle-outline" size={24} color="#6C5CE7" />
              <Text style={styles.addItemText}>添加商品</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      <View style={styles.bottomBar}>
        {editing ? (
          <>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setEditing(false);
                setEditedReceipt(receipt);
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.confirmButtonText}>确认</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="create-outline" size={20} color="#6C5CE7" />
            <Text style={styles.editButtonText}>编辑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 图片查看模态框 */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {currentReceipt.imageUrl && (
            <Image
              source={{ uri: currentReceipt.imageUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E9ECEF',
    marginRight: 16,
    overflow: 'hidden',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  summaryContent: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#636E72',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 16,
    color: '#2D3436',
  },
  input: {
    fontSize: 16,
    color: '#2D3436',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 8,
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deleteItemButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginRight: 8,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 4,
    marginRight: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTags: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  tagGroupLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tagGroupCenter: {
    flex: 1,
    alignItems: 'center',
  },
  tagGroupRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assetTagText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  priceInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C5CE7',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 4,
    minWidth: 80,
  },
  assetCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#636E72',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderStyle: 'dashed',
  },
  addItemText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  editButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#636E72',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#E74C3C',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});

