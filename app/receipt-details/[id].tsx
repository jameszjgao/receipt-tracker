import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
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
import * as ImagePicker from 'expo-image-picker';
import { getReceiptById, updateReceipt, updateReceiptItem } from '@/lib/database';
import { uploadReceiptImage } from '@/lib/supabase';
import { getCategories } from '@/lib/categories';
import { getPurposes, Purpose } from '@/lib/purposes';
import { getPaymentAccounts } from '@/lib/payment-accounts';
import { Receipt, ReceiptItem, Category, ItemPurpose, ReceiptStatus, PaymentAccount } from '@/types';
import { format } from 'date-fns';

export default function ReceiptDetailsScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<Receipt | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState<number | null>(null);
  const [showPurposePicker, setShowPurposePicker] = useState<number | null>(null);
  const [showPaymentAccountPicker, setShowPaymentAccountPicker] = useState<boolean>(false);

  useEffect(() => {
    loadReceipt();
    loadCategories();
    loadPurposes();
    loadPaymentAccounts();
  }, [id]);

  // 当页面获得焦点时（从其他页面返回），重新加载分类、用途和支付账户
  useFocusEffect(
    useCallback(() => {
      loadCategories();
      loadPurposes();
      loadPaymentAccounts();
    }, [])
  );

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPurposes = async () => {
    try {
      const purps = await getPurposes();
      setPurposes(purps);
    } catch (error) {
      console.error('Error loading purposes:', error);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      const accounts = await getPaymentAccounts();
      setPaymentAccounts(accounts);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  const loadReceipt = async () => {
    if (!id) return;
    try {
      const data = await getReceiptById(id);
      setReceipt(data);
      setEditedReceipt(data);
      
      // 如果是新创建的小票，自动进入编辑模式
      if (isNew === 'true') {
        setEditing(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load receipt details');
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
      Alert.alert('Success', 'Receipt confirmed and saved');
      setEditing(false);
      loadReceipt();
    } catch (error) {
      Alert.alert('Error', 'Failed to save');
      console.error(error);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;

    try {
      await updateReceipt(id, {
        status: 'confirmed' as ReceiptStatus,
      });
      loadReceipt();
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm receipt');
      console.error(error);
    }
  };

  // 计算商品明细金额总和
  const calculateItemsSum = useCallback((items: ReceiptItem[]) => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  }, []);

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    if (!editedReceipt) return;

    const newItems = [...editedReceipt.items];
    const updatedItem = { ...newItems[index] } as ReceiptItem;
    
    // 如果更新的是 categoryId，同时更新 category 对象
    if (field === 'categoryId') {
      const selectedCategory = categories.find(cat => cat.id === value);
      if (selectedCategory) {
        updatedItem.categoryId = value;
        updatedItem.category = selectedCategory;
      }
    } else {
      (updatedItem as any)[field] = value;
    }
    
    newItems[index] = updatedItem;
    
    // 自动计算总金额 = 商品明细金额总和 + 税费
    const itemsSum = calculateItemsSum(newItems);
    const tax = editedReceipt.tax || 0;
    const newTotalAmount = itemsSum + tax;
    
    setEditedReceipt({ 
      ...editedReceipt, 
      items: newItems,
      totalAmount: newTotalAmount,
    });
  };

  // 处理税费变更
  const handleTaxChange = (tax: number) => {
    if (!editedReceipt) return;
    
    const itemsSum = calculateItemsSum(editedReceipt.items);
    const newTotalAmount = itemsSum + tax;
    
    setEditedReceipt({
      ...editedReceipt,
      tax: tax,
      totalAmount: newTotalAmount,
    });
  };

  // 直接更新商品项并保存（不进入编辑模式）
  const handleItemChangeDirect = async (
    index: number,
    field: 'categoryId' | 'purpose' | 'isAsset',
    value: any
  ) => {
    if (!id || !currentReceipt) return;

    const item = currentReceipt.items[index];
    if (!item || !item.id) {
      console.error('Item not found or missing ID');
      return;
    }

    try {
      // 先更新本地状态以立即反映变化（保持原有顺序）
      const newItems = [...currentReceipt.items];
      const updatedItem = { ...newItems[index] } as ReceiptItem;

      if (field === 'categoryId') {
        const selectedCategory = categories.find(cat => cat.id === value);
        if (selectedCategory) {
          updatedItem.categoryId = value;
          updatedItem.category = selectedCategory;
        }
      } else if (field === 'purpose') {
        updatedItem.purpose = value as ItemPurpose;
      } else if (field === 'isAsset') {
        updatedItem.isAsset = value;
      }

      newItems[index] = updatedItem;
      const updatedReceipt = { ...currentReceipt, items: newItems };
      setReceipt(updatedReceipt);

      // 保存到数据库（使用 item.id 而不是 index，确保不依赖顺序）
      await updateReceiptItem(id, item.id, field, value);
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item');
      // 如果失败，重新加载以恢复原状态
      await loadReceipt();
    }
  };

  const handleAddItem = () => {
    if (!editedReceipt || categories.length === 0) return;

    // Use the first available category as default
    const defaultCategory = categories.find(cat => cat.name === 'Shopping') || categories[0];
    
    const newItem: ReceiptItem = {
      name: '',
      categoryId: defaultCategory.id,
      category: defaultCategory,
      purpose: 'Personnel',
      price: 0,
      isAsset: false,
    };
    const newItems = [...editedReceipt.items, newItem];
    
    // 自动计算总金额
    const itemsSum = calculateItemsSum(newItems);
    const tax = editedReceipt.tax || 0;
    const newTotalAmount = itemsSum + tax;
    
    setEditedReceipt({
      ...editedReceipt,
      items: newItems,
      totalAmount: newTotalAmount,
    });
  };

  const handleDeleteItem = (index: number) => {
    if (!editedReceipt) return;

    const newItems = editedReceipt.items.filter((_, i) => i !== index);
    
    // 自动计算总金额
    const itemsSum = calculateItemsSum(newItems);
    const tax = editedReceipt.tax || 0;
    const newTotalAmount = itemsSum + tax;
    
    setEditedReceipt({ 
      ...editedReceipt, 
      items: newItems,
      totalAmount: newTotalAmount,
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const handleImagePicker = async () => {
    if (!id) return;

    // 显示选择对话框：相机或相册
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              // 请求相机权限
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'We need access to your camera to take photos.');
                return;
              }

              // 打开相机
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadImage(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error launching camera:', error);
              Alert.alert('Error', 'Failed to launch camera. Please try again.');
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            try {
              // 请求图片库权限
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'We need access to your photo library to upload images.');
                return;
              }

              // 打开图片选择器
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadImage(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error picking image:', error);
              Alert.alert('Error', 'Failed to pick image. Please try again.');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const uploadImage = async (imageUri: string) => {
    if (!id) return;

    setIsUploadingImage(true);
    try {
      // 上传图片到 storage
      const imageUrl = await uploadReceiptImage(imageUri, id);
      
      // 更新 receipt 的 imageUrl
      await updateReceipt(id, { imageUrl });
      
      // 重新加载 receipt 以更新显示
      await loadReceipt();
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
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
        <Text style={styles.errorText}>Receipt not found</Text>
      </View>
    );
  }

  const currentReceipt = editing ? (editedReceipt || receipt) : receipt;

  if (!currentReceipt) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Receipt not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 小票摘要卡片 */}
        <View style={styles.summaryCard}>
          <TouchableOpacity
            onPress={() => {
              if (currentReceipt.imageUrl) {
                setShowImageModal(true);
              } else {
                handleImagePicker();
              }
            }}
            style={styles.imagePlaceholder}
            disabled={isUploadingImage}
          >
            {currentReceipt.imageUrl ? (
              <Image
                source={{ uri: currentReceipt.imageUrl }}
                style={styles.receiptImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholderContent}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Ionicons name="camera" size={32} color="#95A5A6" />
                )}
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.summaryContent}>
            <Text style={styles.storeName} numberOfLines={1}>
              {currentReceipt.storeName}
            </Text>
            <View style={styles.amountRow}>
              <View style={styles.amountContainer}>
                {currentReceipt.currency && (
                  <Text style={styles.currencyLabel}>{currentReceipt.currency}</Text>
                )}
                {editing ? (
                  <Text style={styles.totalAmount}>
                    {(() => {
                      const itemsSum = calculateItemsSum(editedReceipt?.items || []);
                      const tax = editedReceipt?.tax || 0;
                      return (itemsSum + tax).toFixed(2);
                    })()}
                  </Text>
                ) : (
                  <Text style={styles.totalAmount}>
                    {currentReceipt.totalAmount.toFixed(2)}
                  </Text>
                )}
                {editing ? (
                  <View style={styles.taxInputContainer}>
                    <Text style={styles.taxLabel}>Tax: </Text>
                    <TextInput
                      style={styles.taxInput}
                      value={(editedReceipt?.tax || 0).toString()}
                      onChangeText={(text) => {
                        const tax = parseFloat(text) || 0;
                        handleTaxChange(tax);
                      }}
                      keyboardType="numeric"
                      placeholder="0.00"
                    />
                  </View>
                ) : (
                  currentReceipt.tax !== undefined && currentReceipt.tax > 0 && (
                    <Text style={styles.taxText}>
                      Tax: {currentReceipt.tax.toFixed(2)}
                    </Text>
                  )
                )}
              </View>
            </View>
            <Text style={styles.date}>{formatDate(currentReceipt.date)}</Text>
          </View>
        </View>

        {/* 支付账户 */}
        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <Text style={styles.cardLabel}>Payment Account</Text>
            <TouchableOpacity
              style={editing ? styles.paymentAccountTouchable : undefined}
              onPress={() => {
                console.log('Payment account button pressed');
                console.log('Current editing state:', editing);
                console.log('Current picker state:', showPaymentAccountPicker);
                console.log('Payment accounts available:', paymentAccounts.length);
                
                if (!editing) {
                  setEditedReceipt({ ...currentReceipt });
                  setEditing(true);
                }
                
                // 直接设置状态，不使用 setTimeout
                console.log('Setting showPaymentAccountPicker to true');
                setShowPaymentAccountPicker(true);
                
                // 验证状态是否更新
                setTimeout(() => {
                  console.log('Picker state after update:', showPaymentAccountPicker);
                }, 100);
              }}
              activeOpacity={0.7}
            >
              {editing ? (
                <View style={styles.paymentAccountTag}>
                  <Text style={styles.paymentAccountText} numberOfLines={1} ellipsizeMode="tail">
                    {currentReceipt.paymentAccount?.name || 'Not set'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#6C5CE7" style={styles.tagIcon} />
                </View>
              ) : (
                <Text style={styles.cardValue}>
                  {currentReceipt.paymentAccount?.name || 'Not set'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 商品列表 */}
        <View style={styles.itemsSection}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Items</Text>
          </View>
          {currentReceipt.items.map((item, index) => (
            <View 
              key={index} 
              style={[
                styles.itemCard,
                index < currentReceipt.items.length - 1 && styles.itemCardWithBorder
              ]}
            >
              {editing && (
                <TouchableOpacity
                  style={styles.deleteItemButton}
                  onPress={() => handleDeleteItem(index)}
                >
                  <Ionicons name="close-circle" size={20} color="#E74C3C" />
                </TouchableOpacity>
              )}

              {/* 第一行：商品名称 + 价格 */}
              <View style={styles.itemHeader}>
                {editing ? (
                  <TextInput
                    style={styles.itemNameInput}
                    value={item.name}
                    onChangeText={(text) => handleItemChange(index, 'name', text)}
                    placeholder="Item name"
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
                    placeholder="Price"
                  />
                ) : (
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                )}
              </View>

              {/* 第二行：分类（左） + 用途（中） + 资产（右） */}
              <View style={styles.itemTags}>
                  {/* 分类标签 - 左侧，左对齐 */}
                  <View style={styles.tagGroupLeft}>
                    <TouchableOpacity
                      style={styles.tagTouchable}
                      onPress={() => {
                        setShowCategoryPicker(index);
                      }}
                    >
                      <View
                        style={[
                          styles.tag,
                          { backgroundColor: item.category?.color || '#95A5A6' },
                        ]}
                      >
                        <Text 
                          style={styles.tagText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.category?.name || 'Unknown'}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#fff" style={styles.tagIcon} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* 用途标签 - 居中，左对齐 */}
                  <View style={styles.tagGroupCenter}>
                    <TouchableOpacity
                      style={styles.tagTouchable}
                      onPress={() => {
                        setShowPurposePicker(index);
                      }}
                    >
                      <View
                        style={[
                          styles.tag,
                          { 
                            backgroundColor: purposes.find(p => p.name === item.purpose)?.color || '#95A5A6' 
                          },
                        ]}
                      >
                        <Text 
                          style={styles.tagText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {purposes.find(p => p.name === item.purpose)?.name || item.purpose}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#fff" style={styles.tagIcon} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* 资产标签 - 右侧，右对齐 */}
                  <View style={styles.tagGroupRight}>
                    <TouchableOpacity
                      style={styles.assetTagTouchable}
                      onPress={() => {
                        handleItemChangeDirect(index, 'isAsset', !item.isAsset);
                      }}
                    >
                      <View style={[
                        styles.assetTag,
                        {
                          backgroundColor: item.isAsset ? '#E8F4FD' : '#F0F0F0',
                        }
                      ]}>
                        <Ionicons
                          name={item.isAsset ? 'checkbox' : 'checkbox-outline'}
                          size={14}
                          color={item.isAsset ? '#6C5CE7' : '#95A5A6'}
                        />
                        <Text style={[
                          styles.assetTagText,
                          { color: item.isAsset ? '#6C5CE7' : '#636E72' }
                        ]}>
                          Asset
                        </Text>
                      </View>
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
              <Text style={styles.addItemText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 底部确认按钮 */}
      {editing && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setEditing(false);
              setEditedReceipt(receipt);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={handleSave}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 编辑按钮 - 不在编辑模式时显示 */}
      {!editing && (
        <TouchableOpacity
          style={[styles.fab, styles.editFab]}
          onPress={() => {
            setEditedReceipt({ ...currentReceipt });
            setEditing(true);
          }}
        >
          <Ionicons name="create" size={32} color="#fff" />
        </TouchableOpacity>
      )}
      
      {/* 确认按钮 - 只在pending状态且不在编辑模式时显示 */}
      {!editing && currentReceipt.status === 'pending' && (
        <TouchableOpacity
          style={[styles.fab, styles.confirmFab]}
          onPress={handleConfirm}
        >
          <Ionicons name="checkmark-circle" size={32} color="#fff" />
        </TouchableOpacity>
      )}

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

      {/* 分类选择器 */}
      <Modal
        visible={showCategoryPicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(null)}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Category</Text>
              <TouchableOpacity
                style={styles.pickerManageButton}
                onPress={() => {
                  setShowCategoryPicker(null);
                  router.push('/categories-manage');
                }}
              >
                <Ionicons name="settings-outline" size={20} color="#6C5CE7" />
                <Text style={styles.pickerManageText}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {categories.map((cat) => {
                const itemIndex = showCategoryPicker;
                if (itemIndex === null) return null;
                const item = currentReceipt.items[itemIndex];
                const isSelected = item.categoryId === cat.id || item.category?.id === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                    ]}
                    onPress={async () => {
                      setShowCategoryPicker(null);
                      await handleItemChangeDirect(itemIndex, 'categoryId', cat.id);
                    }}
                  >
                    <View
                      style={[
                        styles.pickerColorIndicator,
                        { backgroundColor: cat.color || '#95A5A6' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 用途选择器 */}
      <Modal
        visible={showPurposePicker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPurposePicker(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowPurposePicker(null)}
        >
          <View style={styles.pickerBottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Purpose</Text>
              <TouchableOpacity
                style={styles.pickerManageButton}
                onPress={() => {
                  setShowPurposePicker(null);
                  router.push('/purposes-manage');
                }}
              >
                <Ionicons name="settings-outline" size={20} color="#6C5CE7" />
                <Text style={styles.pickerManageText}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {purposes.map((purpose) => {
                const itemIndex = showPurposePicker;
                if (itemIndex === null) return null;
                const item = currentReceipt.items[itemIndex];
                const isSelected = item.purpose === purpose.name;
                return (
                  <TouchableOpacity
                    key={purpose.id}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                    ]}
                    onPress={async () => {
                      setShowPurposePicker(null);
                      await handleItemChangeDirect(itemIndex, 'purpose', purpose.name as ItemPurpose);
                    }}
                  >
                    <View
                      style={[
                        styles.pickerColorIndicator,
                        { backgroundColor: purpose.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {purpose.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 支付账户选择器 */}
      <Modal
        visible={showPaymentAccountPicker}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => {
          console.log('Modal onRequestClose called');
          setShowPaymentAccountPicker(false);
        }}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => {
            console.log('Overlay pressed, closing picker');
            setShowPaymentAccountPicker(false);
          }}
        >
          <View 
            style={styles.pickerBottomSheet} 
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payment Account</Text>
              <TouchableOpacity
                style={styles.pickerManageButton}
                onPress={() => {
                  setShowPaymentAccountPicker(false);
                  router.push('/payment-accounts-manage');
                }}
              >
                <Ionicons name="settings-outline" size={18} color="#6C5CE7" />
                <Text style={styles.pickerManageText}>Manage</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {/* 无支付账户选项 */}
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !(editing ? editedReceipt : currentReceipt)?.paymentAccount && styles.pickerOptionSelected,
                ]}
                onPress={() => {
                  const receiptToUpdate = editing ? editedReceipt : currentReceipt;
                  if (receiptToUpdate) {
                    if (editing && editedReceipt) {
                      setEditedReceipt({
                        ...editedReceipt,
                        paymentAccount: undefined,
                        paymentAccountId: undefined,
                      });
                    } else {
                      setEditedReceipt({
                        ...currentReceipt,
                        paymentAccount: undefined,
                        paymentAccountId: undefined,
                      });
                      setEditing(true);
                    }
                  }
                  setShowPaymentAccountPicker(false);
                }}
              >
                <View
                  style={[
                    styles.pickerColorIndicator,
                    { backgroundColor: '#95A5A6' },
                  ]}
                />
                <Text
                  style={[
                    styles.pickerOptionText,
                    !(editing ? editedReceipt : currentReceipt)?.paymentAccount && styles.pickerOptionTextSelected,
                  ]}
                >
                  Not set
                </Text>
                {!(editing ? editedReceipt : currentReceipt)?.paymentAccount && (
                  <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                )}
              </TouchableOpacity>

              {/* 支付账户列表 */}
              {paymentAccounts.map((account) => {
                const receiptToCheck = editing ? editedReceipt : currentReceipt;
                const isSelected = receiptToCheck?.paymentAccount?.id === account.id;
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      if (editing && editedReceipt) {
                        setEditedReceipt({
                          ...editedReceipt,
                          paymentAccount: account,
                          paymentAccountId: account.id,
                        });
                      } else {
                        setEditedReceipt({
                          ...currentReceipt,
                          paymentAccount: account,
                          paymentAccountId: account.id,
                        });
                        setEditing(true);
                      }
                      setShowPaymentAccountPicker(false);
                    }}
                  >
                    <View
                      style={[
                        styles.pickerColorIndicator,
                        { backgroundColor: '#6C5CE7' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {account.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#6C5CE7" />
                    )}
                  </TouchableOpacity>
                );
              })}
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
    padding: 12,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E9ECEF',
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  summaryContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  storeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3436',
    lineHeight: 22,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'baseline',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  currencyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginRight: 4,
    lineHeight: 20,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginRight: 8,
    lineHeight: 28,
  },
  taxText: {
    fontSize: 11,
    color: '#636E72',
    fontWeight: '500',
    lineHeight: 16,
  },
  taxInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  taxLabel: {
    fontSize: 11,
    color: '#636E72',
    fontWeight: '500',
    lineHeight: 16,
  },
  taxInput: {
    fontSize: 11,
    color: '#636E72',
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#6C5CE7',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 50,
    textAlign: 'right',
    lineHeight: 16,
  },
  date: {
    fontSize: 13,
    color: '#636E72',
    lineHeight: 18,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 14,
    color: '#636E72',
    marginRight: 12,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 15,
    color: '#2D3436',
    fontWeight: '500',
    paddingVertical: 10, // 增加上下内间距，增加非编辑状态的高度
    lineHeight: 20, // 确保行高一致
  },
  paymentAccountTouchable: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 40, // 保持最小高度一致
  },
  paymentAccountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4, // 减小上下内间距，与非编辑状态的 cardValue 保持一致
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    maxWidth: 250,
    minWidth: 120,
    flexShrink: 0,
  },
  paymentAccountText: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 6,
    maxWidth: 200,
    lineHeight: 20, // 确保行高一致
  },
  input: {
    fontSize: 16,
    color: '#2D3436',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 8,
  },
  inputInline: {
    fontSize: 15,
    color: '#2D3436',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 4,
    flex: 1,
    textAlign: 'right',
  },
  itemsSection: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionTitleContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3436',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 0,
    paddingLeft: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingRight: 32, // 增加右端留白，为删除按钮留出空间
    marginBottom: 0,
  },
  itemCardWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  deleteItemButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -14, // 图标高度20px + padding 4px * 2 = 28px，一半是14px
    right: 0, // 向右移动（减少right值，图标更靠右）
    zIndex: 1,
    padding: 4, // 增加点击区域
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    marginRight: 6,
    paddingVertical: 3, // 与 itemNameInput 保持一致的高度
    lineHeight: 20, // 确保行高一致
  },
  itemNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 2,
    marginRight: 6,
    lineHeight: 20, // 确保行高一致
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1,
  },
  itemTags: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 0,
    position: 'relative',
  },
  tagGroupLeft: {
    width: 120, // 固定宽度，与tag的maxWidth一致
    alignItems: 'flex-start',
  },
  tagGroupCenter: {
    marginLeft: 2, // 向左移动8（从4减到-4，总共左移8）
    alignItems: 'flex-start',
  },
  tagGroupRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tagTouchable: {
    minHeight: 32,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  tag: {
    paddingLeft: 10,
    paddingRight: 5, // 右端留白减半（从10减到5）
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: 140, // 约16个字符的宽度（11px字体，中文字符约8.5px/字符）
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  tagIcon: {
    marginLeft: 4,
    opacity: 0.8,
    flexShrink: 0,
  },
  tagSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  assetTagTouchable: {
    minHeight: 32,
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  assetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  assetTagText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 3,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
    paddingVertical: 4, // 与 priceInput 保持一致的高度（borderWidth 1px + paddingVertical 3px）
    paddingHorizontal: 7, // 与 priceInput 保持一致（borderWidth 1px + paddingHorizontal 6px）
    minWidth: 70,
    textAlign: 'right',
    lineHeight: 20, // 确保行高一致
  },
  priceInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
    borderWidth: 1,
    borderColor: '#6C5CE7',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    minWidth: 70,
    textAlign: 'right',
    lineHeight: 20, // 确保行高一致
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
  fab: {
    position: 'absolute',
    right: 20,
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
  editFab: {
    bottom: 20,
    backgroundColor: '#95A5A6',
    shadowColor: '#95A5A6',
    shadowOpacity: 0.2,
  },
  confirmFab: {
    bottom: 100,
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
  pickerManageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  pickerManageText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
    marginLeft: 4,
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
  },
  pickerOptionSelected: {
    backgroundColor: '#E8F4FD',
  },
  pickerColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
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
});

