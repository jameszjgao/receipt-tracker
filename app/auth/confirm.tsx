import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export default function EmailConfirmScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ token_hash?: string; type?: string; access_token?: string }>();
  const globalParams = useGlobalSearchParams<{ token_hash?: string; type?: string; access_token?: string }>();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      // Supabase 的邮箱确认和密码重置链接会在 URL 中包含参数
      // 可能通过查询参数 (token_hash, type) 或 hash fragment (access_token, type) 传递
      
      // 尝试从查询参数中获取
      let token_hash = localParams.token_hash || globalParams.token_hash;
      let type = (localParams.type || globalParams.type) as any;
      let access_token = localParams.access_token || globalParams.access_token;

      // 如果没有从查询参数获取到，尝试从 URL hash 中解析
      if (!token_hash && !access_token) {
        try {
          const url = await Linking.getInitialURL();
          if (url) {
            const parsed = Linking.parse(url);
            // 检查 hash fragment（Supabase 通常在这里传递 access_token）
            if (parsed.fragment) {
              const fragmentParams = new URLSearchParams(parsed.fragment);
              access_token = fragmentParams.get('access_token') || undefined;
              type = (fragmentParams.get('type') || type) as any;
            }
            // 也检查查询参数
            if (parsed.queryParams) {
              token_hash = (parsed.queryParams.token_hash as string) || token_hash;
              type = ((parsed.queryParams.type as string) || type) as any;
              access_token = (parsed.queryParams.access_token as string) || access_token;
            }
          }
        } catch (linkError) {
          console.log('Error parsing URL:', linkError);
        }
      }

      // 如果有 access_token，说明 Supabase 已经处理了认证，直接设置 session
      if (access_token) {
        try {
          // 尝试从当前 URL 获取完整的 hash fragment
          const url = await Linking.getInitialURL();
          if (url) {
            const parsed = Linking.parse(url);
            const hashFragment = parsed.fragment;
            
            // 解析 hash fragment 获取 refresh_token
            let refresh_token: string | undefined;
            if (hashFragment) {
              const fragmentParams = new URLSearchParams(hashFragment);
              refresh_token = fragmentParams.get('refresh_token') || undefined;
              type = (fragmentParams.get('type') || type) as any;
            }

            // 使用 access_token 和 refresh_token 设置 session
            if (refresh_token) {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });

              if (sessionError) {
                throw sessionError;
              }

              if (sessionData?.user) {
                // Session 设置成功，确保 users 表中有用户记录
                await ensureUserRecord(sessionData.user);
                
                setStatus('success');
                const isPasswordReset = type === 'recovery';
                setMessage(
                  isPasswordReset
                    ? 'Password reset link verified! Redirecting to set new password...'
                    : 'Email confirmed successfully! Redirecting to sign in...'
                );
                
                // 如果是密码重置，跳转到设置新密码页面；否则跳转到登录页
                setTimeout(() => {
                  if (isPasswordReset) {
                    router.replace('/set-password');
                  } else {
                    router.replace('/login');
                  }
                }, 2000);
                return;
              }
            }
          }
        } catch (sessionError) {
          console.error('Error setting session:', sessionError);
        }
      }

      // 如果有 token_hash，使用 verifyOtp 方法（旧的方式）
      if (token_hash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type || 'email',
        });

        if (error) {
          console.error('Email confirmation error:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to confirm email. Please try again.');
          setTimeout(() => {
            router.replace('/login');
          }, 3000);
          return;
        }

        if (data?.user) {
          // 邮箱确认成功，确保 users 表中有用户记录
          await ensureUserRecord(data.user);
          
          setStatus('success');
          const isPasswordReset = type === 'recovery';
          setMessage(
            isPasswordReset
              ? 'Password reset link verified! Redirecting to set new password...'
              : 'Email confirmed successfully! Redirecting to sign in...'
          );
          
          // 如果是密码重置，跳转到设置新密码页面；否则跳转到登录页
          setTimeout(() => {
            if (isPasswordReset) {
              router.replace('/set-password');
            } else {
              router.replace('/login');
            }
          }, 2000);
          return;
        }
      }

      // 如果以上方法都失败，尝试等待 URL 参数加载
      // 这可能是首次打开应用，URL 参数还没有加载完成
      if (!token_hash && !access_token) {
        // 等待一小段时间后再试
        setTimeout(async () => {
          const url = await Linking.getInitialURL();
          if (url && (url.includes('access_token') || url.includes('token_hash'))) {
            handleEmailConfirmation();
          } else {
            setStatus('error');
            setMessage('Invalid confirmation link. Please check your email and try again.');
            setTimeout(() => {
              router.replace('/login');
            }, 3000);
          }
        }, 1000);
        return;
      }

      // 如果所有方法都失败
      setStatus('error');
      setMessage('Invalid confirmation link. Please check your email and try again.');
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    } catch (error) {
      console.error('Email confirmation exception:', error);
      setStatus('error');
      setMessage('An error occurred. Please try again.');
      setTimeout(() => {
        router.replace('/login');
      }, 3000);
    }
  };

  // 确保 users 表中有用户记录
  const ensureUserRecord = async (user: any) => {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!existingUser) {
        const userNameFromMetadata = user.user_metadata?.name;
        const userName = userNameFromMetadata || user.email?.split('@')[0] || 'User';
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            name: userName,
            current_household_id: null,
          });
        
        if (insertError) {
          console.error('Error creating user record:', insertError);
        } else {
          console.log('User record created successfully');
        }
      }
    } catch (error) {
      console.error('Error ensuring user record exists:', error);
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

