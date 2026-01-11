import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { validateSupabaseConfig } from '@/lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    // 在应用启动时验证Supabase配置（仅用于日志，不阻止启动）
    const config = validateSupabaseConfig();
    if (!config.valid) {
      console.warn('⚠️ Supabase配置警告:', config.error);
      console.warn('应用可能无法正常连接Supabase。请在构建时设置正确的环境变量。');
    }
  }, []);

  return (
    <Stack>
        <Stack.Screen 
          name="index" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="receipts" 
          options={{ 
            title: 'My Receipts',
            headerBackTitle: 'Home'
          }} 
        />
        <Stack.Screen 
          name="receipt-details/[id]" 
          options={{ 
          title: 'Receipt Details'
          }} 
        />
        <Stack.Screen 
          name="camera" 
          options={{ 
            title: '',
            headerBackTitle: 'Home'
          }} 
        />
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="register" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="categories-manage" 
          options={{ 
            title: 'Manage Categories',
            headerBackTitle: 'Back',
            headerBackButtonVisible: true,
          }} 
        />
        <Stack.Screen 
          name="purposes-manage" 
          options={{ 
            title: 'Manage Purposes',
            headerBackTitle: 'Back',
            headerBackButtonVisible: true,
          }} 
        />
        <Stack.Screen 
          name="payment-accounts-manage" 
          options={{ 
            title: 'Manage Payment Accounts',
            headerBackTitle: 'Back',
            headerBackButtonVisible: true,
          }} 
        />
        <Stack.Screen 
          name="household-members" 
          options={{ 
            title: 'Household Members',
            headerBackTitle: 'Back',
            headerBackButtonVisible: true,
          }} 
        />
        <Stack.Screen 
          name="management" 
          options={{ 
            title: 'Management',
            headerBackTitle: 'Home'
          }} 
        />
        <Stack.Screen 
          name="household-manage" 
          options={{ 
            title: 'Household Information'
          }} 
        />
        <Stack.Screen 
          name="voice-input" 
          options={{ 
            title: 'Chat to Log',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="manual-entry" 
          options={{ 
            title: 'Add Receipt',
            presentation: 'modal'
          }} 
        />
        <Stack.Screen 
          name="household-select" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="profile" 
          options={{ 
            title: 'Personal Information'
          }} 
        />
        <Stack.Screen 
          name="auth/confirm" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="invite/[id]" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="handle-invitations" 
          options={{ 
            headerShown: false
          }} 
        />
        <Stack.Screen 
          name="setup-household" 
          options={{ 
            headerShown: false
          }} 
        />
      </Stack>
  );
}