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
          title: '我的小票'
          }} 
        />
        <Stack.Screen 
          name="receipt-details/[id]" 
          options={{ 
          title: '小票详情'
          }} 
        />
        <Stack.Screen 
          name="camera" 
          options={{ 
          title: '拍摄小票'
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
      </Stack>
  );
}