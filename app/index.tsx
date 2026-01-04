import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { isAuthenticated } from '@/lib/auth';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    setIsLoggedIn(authenticated);
    if (!authenticated) {
      router.replace('/login');
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <Text style={styles.title}>加载中...</Text>
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
      
      <View style={styles.content}>
        <Text style={styles.title}>📸 拍一张小票，</Text>
        <Text style={styles.subtitle}>整理一切</Text>
        
        <View style={styles.iconContainer}>
          <View style={styles.circle}>
            <Ionicons name="camera" size={80} color="#6C5CE7" />
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/camera')}
      >
        <Ionicons name="camera-outline" size={24} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>拍摄小票</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.secondaryButton}
        onPress={() => router.push('/receipts')}
      >
        <Text style={styles.secondaryButtonText}>查看我的小票列表</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 60,
    textAlign: 'center',
  },
  iconContainer: {
    marginTop: 40,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
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
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  secondaryButtonText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '600',
  },
});

