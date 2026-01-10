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
  getPurposes,
  createPurpose,
  updatePurpose,
  deletePurpose,
  Purpose,
} from '@/lib/purposes';
import { GradientText } from '@/lib/GradientText';

// 预设颜色列表（减少数量，确保一行显示）
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#F1948A', '#85C1E2', '#82E0AA',
];

export default function PurposesManageScreen() {
  const router = useRouter();
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#95A5A6');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#95A5A6');

  useEffect(() => {
    loadPurposes();
  }, []);

  const loadPurposes = async () => {
    try {
      setLoading(true);
      const data = await getPurposes();
      setPurposes(data);
    } catch (error) {
      console.error('Error loading purposes:', error);
      Alert.alert('Error', 'Failed to load purposes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurpose = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter purpose name');
      return;
    }

    try {
      const newPurpose = await createPurpose(newName.trim(), newColor);
      // 乐观更新：直接添加到列表中，不需要重新加载所有用途
      setPurposes(prev => [...prev, newPurpose]);
      setNewName('');
      setNewColor('#95A5A6');
      setShowAddForm(false);
      Alert.alert('Success', 'Purpose created');
    } catch (error: any) {
      console.error('Error creating purpose:', error);
      Alert.alert('Error', error.message || 'Failed to create purpose');
      // 如果失败，重新加载以确保数据一致
      loadPurposes();
    }
  };

  const handleUpdatePurpose = async (purposeId: string) => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter purpose name');
      return;
    }

    try {
      await updatePurpose(purposeId, {
        name: editName.trim(),
        color: editColor,
      });
      // 乐观更新：直接更新列表中的用途，不需要重新加载所有用途
      setPurposes(prev => prev.map(p => 
        p.id === purposeId 
          ? { ...p, name: editName.trim(), color: editColor }
          : p
      ));
      setEditingId(null);
      setEditName('');
      setEditColor('#95A5A6');
      // 移除成功提示对话框
    } catch (error: any) {
      console.error('Error updating purpose:', error);
      Alert.alert('Error', error.message || 'Failed to update purpose');
      // 如果失败，重新加载以确保数据一致
      loadPurposes();
    }
  };

  const handleDeletePurpose = async (purpose: Purpose) => {
    Alert.alert(
      'Delete Purpose',
      `Are you sure you want to delete "${purpose.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePurpose(purpose.id);
              // 乐观更新：直接从列表中移除，不需要重新加载所有用途
              setPurposes(prev => prev.filter(p => p.id !== purpose.id));
              Alert.alert('Success', 'Purpose deleted');
            } catch (error: any) {
              console.error('Error deleting purpose:', error);
              Alert.alert('Error', error.message || 'Failed to delete purpose');
              // 如果失败，重新加载以确保数据一致
              loadPurposes();
            }
          },
        },
      ]
    );
  };

  const startEdit = (purpose: Purpose) => {
    setEditingId(purpose.id);
    setEditName(purpose.name);
    setEditColor(purpose.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('#95A5A6');
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
        <View style={styles.headerTitleContainer}>
          <GradientText
            text="Tag specific purposes, track for every item."
            style={styles.headerTitle}
            containerStyle={styles.gradientTextContainer}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Purposes List */}
        <View style={styles.purposesList}>
          {/* Add New Purpose Button */}
          {!showAddForm && (
            <TouchableOpacity
              style={styles.purposeCard}
              onPress={() => setShowAddForm(true)}
            >
              <View style={styles.addPurposeRow}>
                <Ionicons name="add-circle" size={20} color="#6C5CE7" />
                <Text style={styles.addPurposeText}>Add Purpose</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Add Purpose Form */}
          {showAddForm && (
            <View style={styles.formCard}>
              {/* 第一行：名称 */}
              <TextInput
                style={styles.editInputInline}
                value={newName}
                onChangeText={setNewName}
                placeholder="Purpose name"
                placeholderTextColor="#95A5A6"
              />

              {/* 第二行：颜色 */}
              <View style={styles.editColorPickerInline}>
                {COLOR_OPTIONS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      styles.smallColorOption,
                      { backgroundColor: color },
                      newColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewColor(color)}
                  >
                    {newColor === color && (
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* 第三行：确认取消按钮 */}
              <View style={styles.editButtonsInline}>
                <TouchableOpacity
                  style={styles.cancelButtonInline}
                  onPress={() => {
                    setShowAddForm(false);
                    setNewName('');
                    setNewColor('#95A5A6');
                  }}
                >
                  <Text style={styles.cancelButtonTextInline}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButtonInline}
                  onPress={handleAddPurpose}
                >
                  <Text style={styles.confirmButtonTextInline}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {purposes.map((purpose) => (
            <View key={purpose.id} style={styles.purposeCard}>
              {editingId === purpose.id ? (
                // Edit Mode - 三行显示
                <View style={styles.editRow}>
                  {/* 第一行：名称 */}
                  <TextInput
                    style={styles.editInputInline}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Purpose name"
                    placeholderTextColor="#95A5A6"
                  />
                  {/* 第二行：颜色 */}
                  <View style={styles.editColorPickerInline}>
                    {COLOR_OPTIONS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          styles.smallColorOption,
                          { backgroundColor: color },
                          editColor === color && styles.colorOptionSelected,
                        ]}
                        onPress={() => setEditColor(color)}
                      >
                        {editColor === color && (
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* 第三行：确认取消按钮 */}
                  <View style={styles.editButtonsInline}>
                    <TouchableOpacity
                      style={styles.cancelButtonInline}
                      onPress={cancelEdit}
                    >
                      <Text style={styles.cancelButtonTextInline}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmButtonInline}
                      onPress={() => handleUpdatePurpose(purpose.id)}
                    >
                      <Text style={styles.confirmButtonTextInline}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Display Mode - 一行显示
                <View style={styles.purposeRow}>
                  <View
                    style={[
                      styles.purposeIndicator,
                      { backgroundColor: purpose.color },
                    ]}
                  />
                  <Text style={styles.purposeName} numberOfLines={1}>
                    {purpose.name}
                  </Text>
                  <View style={styles.purposeActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => startEdit(purpose)}
                    >
                      <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                    </TouchableOpacity>
                    {!purpose.isDefault && (
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleDeletePurpose(purpose)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
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
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  gradientTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  purposesList: {
    gap: 12,
  },
  purposeCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  addPurposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPurposeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  purposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  purposeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purposeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#2D3436',
  },
  purposeActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  editColorPickerInline: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'nowrap',
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
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  smallColorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorOptionSelected: {
    borderColor: '#2D3436',
  },
});

