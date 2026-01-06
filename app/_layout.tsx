import { Stack } from 'expo-router';

export default function RootLayout() {
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
            title: 'Manage Categories'
          }} 
        />
        <Stack.Screen 
          name="purposes-manage" 
          options={{ 
            title: 'Manage Purposes'
          }} 
        />
        <Stack.Screen 
          name="payment-accounts-manage" 
          options={{ 
            title: 'Manage Payment Accounts'
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
          name="household-members" 
          options={{ 
            title: 'Household Members'
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
          name="invite/[token]" 
          options={{ 
            headerShown: false
          }} 
        />
      </Stack>
  );
}