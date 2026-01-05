import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';

export default function EmailConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      // 从 URL 参数中提取 token_hash 和 type
      // Supabase 可能传递 token_hash 或 token
      const { token_hash, token, type } = params as { token_hash?: string; token?: string; type?: string };

      // 优先使用 token_hash，如果没有则使用 token
      const confirmationToken = token_hash || token;

      if (!confirmationToken) {
        setStatus('error');
        setMessage('Invalid confirmation link. Please check your email and try again.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        return;
      }

      // 验证邮箱确认 token
      // Supabase 使用 verifyOtp 方法，需要 token_hash 和 type
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: confirmationToken,
        type: (type as any) || 'email',
      });

      if (error) {
        console.error('Email confirmation error:', error);
        // 如果 verifyOtp 失败，尝试使用 exchangeCodeForSession（如果 Supabase 传递的是 code）
        setStatus('error');
        setMessage(error.message || 'Failed to confirm email. Please try again.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        return;
      }

      if (data?.user) {
        setStatus('success');
        setMessage('Email confirmed successfully! Redirecting to login...');
        // 等待 2 秒后跳转到登录页
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      } else {
        setStatus('error');
        setMessage('Email confirmation failed. Please try again.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
      }
    } catch (error) {
      console.error('Email confirmation exception:', error);
      setStatus('error');
      setMessage('An error occurred. Please try again.');
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color="#6C5CE7" />
            <Text style={styles.message}>{message}</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>✗</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 16,
    color: '#2D3436',
    textAlign: 'center',
    marginTop: 20,
  },
  successIcon: {
    fontSize: 64,
    color: '#00B894',
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 64,
    color: '#E74C3C',
    marginBottom: 20,
  },
});

