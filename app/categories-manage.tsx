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
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
} from '@/lib/categories';

// 预设颜色列表
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#F1948A', '#85C1E2', '#82E0AA',
  '#F9E79F', '#F8C471', '#EB984E', '#AF7AC5', '#5DADE2',
];

export default function CategoriesManageScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#95A5A6');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#95A5A6');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter category name');
      return;
    }

    try {
      await createCategory(newName.trim(), newColor);
      await loadCategories();
      setNewName('');
      setNewColor('#95A5A6');
      setShowAddForm(false);
      Alert.alert('Success', 'Category created');
    } catch (error: any) {
      console.error('Error creating category:', error);
      Alert.alert('Error', error.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (categoryId: string) => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter category name');
      return;
    }

    try {
      await updateCategory(categoryId, {
        name: editName.trim(),
        color: editColor,
      });
      await loadCategories();
      setEditingId(null);
      setEditName('');
      setEditColor('#95A5A6');
      Alert.alert('Success', 'Category updated');
    } catch (error: any) {
      console.error('Error updating category:', error);
      Alert.alert('Error', error.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              await loadCategories();
              Alert.alert('Success', 'Category deleted');
            } catch (error: any) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', error.message || 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#2D3436" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Add New Category Button */}
        {!showAddForm && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#6C5CE7" />
            <Text style={styles.addButtonText}>Add New Category</Text>
          </TouchableOpacity>
        )}

        {/* Add Category Form */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Category</Text>
            
            <Text style={styles.label}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter category name"
              placeholderTextColor="#95A5A6"
            />

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorPicker}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setNewColor(color)}
                >
                  {newColor === color && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddForm(false);
                  setNewName('');
                  setNewColor('#95A5A6');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.saveButton]}
                onPress={handleAddCategory}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Categories List */}
        <View style={styles.categoriesList}>
          {categories.map((category) => (
            <View key={category.id} style={styles.categoryCard}>
              {editingId === category.id ? (
                // Edit Mode - 一行显示
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInputInline}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Category name"
                    placeholderTextColor="#95A5A6"
                  />
                  <View style={styles.editColorPickerInline}>
                    {COLOR_OPTIONS.slice(0, 8).map((color) => (
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
                  <View style={styles.editButtonsInline}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleUpdateCategory(category.id)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#00B894" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={cancelEdit}
                    >
                      <Ionicons name="close-circle" size={20} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Display Mode - 一行显示
                <View style={styles.categoryRow}>
                  <View
                    style={[
                      styles.categoryIndicator,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => startEdit(category)}
                    >
                      <Ionicons name="create-outline" size={18} color="#6C5CE7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleDeleteCategory(category)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                    </TouchableOpacity>
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
  addButton: {
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
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636E72',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2D3436',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
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
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorOptionSelected: {
    borderColor: '#2D3436',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  formButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E9ECEF',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#636E72',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoriesList: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    flexShrink: 0,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#2D3436',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInputInline: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 8,
    fontSize: 15,
    color: '#2D3436',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 100,
  },
  editColorPickerInline: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  editButtonsInline: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    flexShrink: 0,
  },
});

