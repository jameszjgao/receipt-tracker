import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { getInvitationByToken } from '@/lib/household-invitations';

export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'error'>('checking');
  const [message, setMessage] = useState('Checking invitation...');

  useEffect(() => {
    handleInvitation();
  }, []);

  const handleInvitation = async () => {
    try {
      const token = params.token;

      if (!token) {
        setStatus('error');
        setMessage('Invalid invitation link. Please check your email and try again.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        return;
      }

      // 获取邀请信息
      const invitation = await getInvitationByToken(token);
      if (!invitation) {
        setStatus('error');
        setMessage('Invitation not found or expired. Please request a new invitation.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        return;
      }

      if (invitation.status !== 'pending') {
        setStatus('error');
        setMessage('This invitation has already been used or cancelled.');
        setTimeout(() => {
          router.replace('/login');
        }, 3000);
        return;
      }

      // 检查用户是否已登录
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        // 用户已登录，检查邮箱是否匹配
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', authUser.id)
          .single();

        if (userData && userData.email.toLowerCase() === invitation.inviteeEmail.toLowerCase()) {
          // 邮箱匹配，跳转到登录页面（会显示确认浮窗）
          setStatus('redirecting');
          setMessage('Redirecting...');
          router.replace({
            pathname: '/login',
            params: { inviteToken: token },
          });
        } else {
          // 邮箱不匹配，提示用户
          setStatus('error');
          setMessage('This invitation is for a different email address. Please log out and use the correct account.');
          setTimeout(() => {
            router.replace('/');
          }, 3000);
        }
      } else {
        // 用户未登录，检查邮箱是否已注册
        const { data: existingUser } = await supabase
          .from('users')
          .select('email')
          .eq('email', invitation.inviteeEmail.toLowerCase())
          .single();

        if (existingUser) {
          // 用户已注册，跳转到登录页面
          setStatus('redirecting');
          setMessage('Redirecting to login...');
          router.replace({
            pathname: '/login',
            params: { inviteToken: token, email: invitation.inviteeEmail },
          });
        } else {
          // 新用户，跳转到注册页面
          setStatus('redirecting');
          setMessage('Redirecting to registration...');
          router.replace({
            pathname: '/register',
            params: { inviteToken: token, email: invitation.inviteeEmail },
          });
        }
      }
    } catch (error) {
      console.error('Invitation handling error:', error);
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
        {status === 'checking' || status === 'redirecting' ? (
          <>
            <ActivityIndicator size="large" color="#6C5CE7" />
            <Text style={styles.message}>{message}</Text>
          </>
        ) : (
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
  errorIcon: {
    fontSize: 64,
    color: '#E74C3C',
    marginBottom: 20,
  },
});

