import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { isAuthenticated, getCurrentUser, getCurrentHousehold } from '@/lib/auth';
import { Household } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      router.replace('/login');
      return;
    }

    // 检查用户是否有当前家庭
    const user = await getCurrentUser();
    if (!user) {
      router.replace('/household-select');
      return;
    }

    // 如果用户已经有当前家庭（currentHouseholdId 或 householdId），直接进入应用
    // 这样可以快速登录，使用上次登录的家庭
    if (user.currentHouseholdId || user.householdId) {
      setIsLoggedIn(true);
      return;
    }

    // 没有当前家庭，检查家庭数量
    const { getUserHouseholds } = await import('@/lib/auth');
    const households = await getUserHouseholds();
    
    if (households.length === 0) {
      // 没有家庭，跳转到家庭选择页面（可以创建）
      router.replace('/household-select');
      return;
    } else if (households.length === 1) {
      // 只有一个家庭，自动设置并进入
      const { setCurrentHousehold } = await import('@/lib/auth');
      await setCurrentHousehold(households[0].householdId);
      setIsLoggedIn(true);
      return;
    } else {
      // 多个家庭但没有当前家庭，自动选择第一个家庭（最近加入的）
      // 这样可以快速登录，而不需要用户选择
      const { setCurrentHousehold } = await import('@/lib/auth');
      await setCurrentHousehold(households[0].householdId);
      setIsLoggedIn(true);
      return;
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadHousehold();
    }
  }, [isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        loadHousehold();
      }
    }, [isLoggedIn])
  );

  const loadHousehold = async () => {
    try {
      const household = await getCurrentHousehold();
      setCurrentHousehold(household);
    } catch (error) {
      console.error('Error loading household:', error);
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return null; // 会跳转到登录页
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 顶部栏：家庭名称和管理入口 */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft} />
        <Text style={styles.householdName} numberOfLines={1}>
          {currentHousehold?.name || 'Loading...'}
        </Text>
        <TouchableOpacity
          style={styles.managementButton}
          onPress={() => router.push('/management')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="#2D3436" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>📸 Snap a receipt,</Text>
        <Text style={styles.subtitle}>Organize everything</Text>
        
        <TouchableOpacity 
          style={styles.iconContainer}
          onPress={() => router.push('/camera')}
          activeOpacity={0.8}
        >
          <View style={styles.circle}>
            <Ionicons name="camera" size={80} color="#6C5CE7" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.chatIconContainer}
          onPress={() => router.push('/voice-input')}
          activeOpacity={0.8}
        >
          <View style={styles.chatCircle}>
            <Ionicons name="chatbubble-outline" size={60} color="#6C5CE7" />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={() => router.push('/receipts')}
      >
        <Ionicons name="list-outline" size={20} color="#6C5CE7" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>View Receipts List</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    position: 'relative',
  },
  topBarLeft: {
    width: 44,
  },
  householdName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 30,
    textAlign: 'center',
  },
  iconContainer: {
    marginTop: 20,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIconContainer: {
    marginTop: 24,
  },
  chatCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  secondaryButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '600',
  },
  managementButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

