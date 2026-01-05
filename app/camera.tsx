import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadReceiptImage, uploadReceiptImageTemp } from '@/lib/supabase';
import { saveReceipt } from '@/lib/database';
import { processReceiptInBackground } from '@/lib/receipt-processor';
import { isAuthenticated } from '@/lib/auth';
import { useEffect } from 'react';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedReceiptId, setCapturedReceiptId] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      router.replace('/login');
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission is required to capture receipts</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo) {
        setIsProcessing(false);
        return;
      }

      // 1. 先上传图片到 Supabase Storage（使用临时文件名）
      const tempFileName = `temp-${Date.now()}`;
      const imageUrl = await uploadReceiptImageTemp(photo.uri, tempFileName);
      console.log('图片已上传，URL:', imageUrl);

      // 2. 先创建一个待处理的小票记录（状态为 processing，正在后台处理）
      // 使用当前日期和临时数据
      const today = new Date().toISOString().split('T')[0];
      const receiptId = await saveReceipt({
        householdId: '', // 会在 saveReceipt 中自动获取
        storeName: 'Processing...',
        totalAmount: 0,
        date: today,
        status: 'processing', // 处理中
        items: [],
        imageUrl: imageUrl, // 临时图片 URL
      });
      console.log('小票记录已创建，ID:', receiptId);

      setIsProcessing(false);
      setCapturedReceiptId(receiptId);

      // 4. 在后台异步处理识别（不阻塞用户）
      // 使用 Promise 但不 await，让它在后台运行
      processReceiptInBackground(imageUrl, receiptId, photo.uri)
        .then(() => {
          console.log('✅ 后台识别完成，receiptId:', receiptId);
        })
        .catch((error) => {
          console.error('❌ 后台识别失败:', error);
          // 错误已在小票状态中记录，用户可以稍后查看或重试
        });
    } catch (error) {
      setIsProcessing(false);
      console.error('Take picture error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error processing receipt';
      Alert.alert(
        'Recognition Failed', 
        errorMessage + '\n\nPlease check:\n1. Gemini API Key configuration\n2. Network connection\n3. API quota',
        [{ text: 'OK' }]
      );
    }
  };

  const pickImage = async () => {
    try {
      setIsProcessing(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // 1. 先上传图片到 Supabase Storage（使用临时文件名）
        const tempFileName = `temp-${Date.now()}`;
        const imageUrl = await uploadReceiptImageTemp(imageUri, tempFileName);
        console.log('图片已上传，URL:', imageUrl);

        // 2. 先创建一个待处理的小票记录（状态为 processing，正在后台处理）
        const today = new Date().toISOString().split('T')[0];
        const receiptId = await saveReceipt({
          householdId: '', // 会在 saveReceipt 中自动获取
          storeName: 'Processing...',
          totalAmount: 0,
          date: today,
          status: 'processing', // 处理中
          items: [],
          imageUrl: imageUrl, // 临时图片 URL
        });
        console.log('小票记录已创建，ID:', receiptId);

        setIsProcessing(false);
        setCapturedReceiptId(receiptId);

        // 4. 在后台异步处理识别（不阻塞用户）
        processReceiptInBackground(imageUrl, receiptId, imageUri)
          .then(() => {
            console.log('✅ 后台识别完成，receiptId:', receiptId);
          })
          .catch((error) => {
            console.error('❌ 后台识别失败:', error);
          });
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      setIsProcessing(false);
      console.error('Image picker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error processing receipt';
      Alert.alert(
        'Recognition Failed', 
        errorMessage + '\n\nPlease check:\n1. Gemini API Key configuration\n2. Network connection\n3. API quota',
        [{ text: 'OK' }]
      );
    }
  };

  // 如果拍摄完成，显示操作界面
  if (capturedReceiptId) {
    return (
      <View style={styles.actionContainer}>
        <View style={styles.actionContent}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#00B894" />
          </View>
          <Text style={styles.successTitle}>Receipt Saved</Text>
          <Text style={styles.successSubtitle}>Processing, Check details later</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setCapturedReceiptId(null);
              }}
            >
              <Ionicons name="camera" size={24} color="#6C5CE7" />
              <Text style={styles.actionButtonText}>Snap Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push(`/receipt-details/${capturedReceiptId}`);
              }}
            >
              <Ionicons name="document-text" size={24} color="#6C5CE7" />
              <Text style={styles.actionButtonText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push('/receipts');
              }}
            >
              <Ionicons name="list" size={24} color="#6C5CE7" />
              <Text style={styles.actionButtonText}>View List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isProcessing ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.processingText}>Processing receipt...</Text>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              >
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
                <Ionicons name="images" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <View style={styles.placeholder} />
            </View>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    padding: 12,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 30,
    paddingBottom: 50,
  },
  pickButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    padding: 12,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 52,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6C5CE7',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  processingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
  actionContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  actionButtons: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    gap: 12,
    width: '80%',
    maxWidth: 300,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
});

