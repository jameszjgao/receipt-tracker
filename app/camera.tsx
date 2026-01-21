import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadReceiptImage, uploadReceiptImageTemp } from '@/lib/supabase';
import { saveReceipt } from '@/lib/database';
import { processReceiptInBackground } from '@/lib/receipt-processor';
import { isAuthenticated } from '@/lib/auth';
import { processImageForUpload, detectEdges } from '@/lib/image-processor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedReceiptId, setCapturedReceiptId] = useState<string | null>(null);
  const [storagePermission, setStoragePermission] = useState<ImagePicker.MediaLibraryPermissionResponse | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  
  // 裁剪框状态（相对于屏幕的百分比位置，用于显示预览框）
  // 实际裁剪会在拍摄后根据图片尺寸计算
  const [showCropBox, setShowCropBox] = useState(true);

  useEffect(() => {
    checkAuth();
    checkStoragePermission();
  }, []);

  const checkStoragePermission = async () => {
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      setStoragePermission(permission);
      console.log('存储权限状态:', permission.status);
    } catch (error) {
      console.error('检查存储权限失败:', error);
    }
  };

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
        <TouchableOpacity style={styles.button} onPress={async () => {
          const result = await requestPermission();
          if (!result.granted) {
            Alert.alert(
              'Permission Required',
              'Camera permission is required to capture receipts. Please grant permission in settings.',
              [{ text: 'OK' }]
            );
          }
        }}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    // 先保存相机引用的副本，避免在 setIsProcessing(true) 后引用丢失
    const camera = cameraRef.current;
    if (!camera) {
      Alert.alert('Error', 'Camera not ready. Please try again.');
      return;
    }

    try {
      console.log('=== 开始拍照流程 ===');
      
      // 检查并请求存储权限（用于保存照片）
      console.log('[步骤 1/6] 检查存储权限...');
      let mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      console.log('[步骤 1/6] 存储权限状态:', mediaPermission.status, mediaPermission.granted);
      
      if (!mediaPermission.granted) {
        console.log('[步骤 1/6] 请求存储权限...');
        mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('[步骤 1/6] 请求后权限状态:', mediaPermission.status, mediaPermission.granted);
        
        if (!mediaPermission.granted) {
          Alert.alert(
            'Permission Required',
            'Storage permission is required to save photos. Please grant permission in settings.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      setStoragePermission(mediaPermission);
      console.log('[步骤 1/6] ✅ 存储权限已授予');
      
      // 拍摄照片（在设置 isProcessing 之前，使用保存的相机引用）
      console.log('[步骤 2/6] 开始拍摄照片...');
      let photo;
      try {
        // 使用保存的相机引用，而不是 cameraRef.current（可能在渲染后变为 null）
        photo = await camera.takePictureAsync({
          quality: 0.6,
          base64: false,
          skipProcessing: false,
        });
        console.log('[步骤 2/6] takePictureAsync 返回结果:', photo ? '成功' : '失败');
      } catch (captureError) {
        console.error('[步骤 2/6] ❌ 拍照失败:', captureError);
        const errorMsg = captureError instanceof Error ? captureError.message : String(captureError);
        Alert.alert(
          'Capture Failed',
          `Failed to capture photo: ${errorMsg}\n\nPlease try again.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (!photo || !photo.uri) {
        console.error('[步骤 2/6] ❌ Photo capture failed: photo is null or uri is missing');
        Alert.alert('Error', 'Failed to capture image. Photo object is invalid.');
        return;
      }

      console.log('[步骤 2/6] ✅ 照片拍摄成功');
      console.log('[步骤 2/6] 照片 URI:', photo.uri);
      console.log('[步骤 2/6] 照片宽度:', photo.width, '高度:', photo.height);

      // 照片拍摄成功后，再设置 isProcessing 为 true（此时相机引用已经使用完毕）
      setIsProcessing(true);

      // 1. 预处理图片（压缩、调整大小、自动裁剪、图像增强）
      console.log('[步骤 3/6] 开始预处理图片（包含自动裁剪和图像增强）...');
      let processedImageUri: string;
      try {
        processedImageUri = await processImageForUpload(photo.uri, {
          autoCrop: true,        // 启用自动裁剪（检测文档边缘，去除 5% 边距）
          brightness: 0.1,      // 稍微增加亮度（通过优化压缩质量间接实现）
          contrast: 0.15,       // 增加对比度（通过优化压缩质量间接实现）
          quality: 0.85,        // 高质量压缩
        });
        console.log('[步骤 3/6] ✅ 图片预处理完成（包含自动裁剪和图像增强）');
        console.log('[步骤 3/6] 处理后 URI:', processedImageUri);
      } catch (preprocessError) {
        console.error('[步骤 3/6] ⚠️ 图片预处理失败，使用原始图片:', preprocessError);
        processedImageUri = photo.uri;
      }

      // 2. 上传预处理后的图片到 Supabase Storage（使用临时文件名）
      console.log('[步骤 5/6] 开始上传图片到 Supabase...');
      const tempFileName = `temp-${Date.now()}`;
      let imageUrl: string;
      try {
        imageUrl = await uploadReceiptImageTemp(processedImageUri, tempFileName);
        console.log('[步骤 5/6] ✅ 图片已上传');
        console.log('[步骤 5/6] 图片 URL:', imageUrl);
      } catch (uploadError) {
        console.error('[步骤 5/6] ❌ 图片上传失败:', uploadError);
        setIsProcessing(false);
        const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
        Alert.alert(
          'Upload Failed',
          `Failed to upload image: ${errorMsg}\n\nPlease check your network connection.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // 3. 先创建一个待处理的小票记录（状态为 processing，正在后台处理）
      console.log('[步骤 6/6] 创建小票记录...');
      const today = new Date().toISOString().split('T')[0];
      let receiptId: string;
      try {
        receiptId = await saveReceipt({
          householdId: '', // 会在 saveReceipt 中自动获取
          storeName: 'Processing...',
          totalAmount: 0,
          date: today,
          status: 'processing', // 处理中
          items: [],
          imageUrl: imageUrl, // 临时图片 URL
        });
        console.log('[步骤 5/6] ✅ 小票记录已创建');
        console.log('[步骤 5/6] 小票 ID:', receiptId);
      } catch (saveError) {
        console.error('[步骤 5/6] ❌ 创建小票记录失败:', saveError);
        setIsProcessing(false);
        const errorMsg = saveError instanceof Error ? saveError.message : String(saveError);
        Alert.alert(
          'Save Failed',
          `Failed to save receipt: ${errorMsg}\n\nPlease try again.`,
          [{ text: 'OK' }]
        );
        return;
      }

      setIsProcessing(false);
      setCapturedReceiptId(receiptId);
      console.log('[步骤 6/6] ✅ 拍照流程完成，开始后台识别...');

      // 4. 在后台异步处理识别（不阻塞用户）
      processReceiptInBackground(imageUrl, receiptId, processedImageUri)
        .then(() => {
          console.log('✅ 后台识别完成，receiptId:', receiptId);
        })
        .catch((error) => {
          console.error('❌ 后台识别失败:', error);
          // 错误已在小票状态中记录，用户可以稍后查看或重试
        });
    } catch (error) {
      setIsProcessing(false);
      console.error('=== ❌ 拍照流程异常 ===');
      console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('错误信息:', error);
      
      // 更详细的错误信息
      let errorMessage = 'Failed to capture image';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
        errorDetails = `\n\nError: ${error.name}\nMessage: ${error.message}`;
        if (error.stack) {
          console.error('错误堆栈:', error.stack);
        }
      } else {
        console.error('未知错误类型:', error);
        errorDetails = `\n\nError: ${String(error)}`;
      }
      
      Alert.alert(
        'Capture Failed', 
        errorMessage + errorDetails + '\n\nPlease check the console logs for more details.',
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
        aspect: [1, 2], // 1:2 比例，更符合小票的竖长形状（高度是宽度的2倍）
        quality: 0.9, // 先以较高质量选择
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // 1. 预处理图片（压缩、调整大小、自动裁剪、图像增强）
        console.log('预处理选择的图片（包含自动裁剪和图像增强）...');
        const processedImageUri = await processImageForUpload(imageUri, {
          autoCrop: true,        // 启用自动裁剪
          brightness: 0.1,       // 稍微增加亮度
          contrast: 0.15,        // 增加对比度
          quality: 0.85,         // 高质量压缩
        });
        console.log('图片预处理完成（包含自动裁剪和图像增强）:', processedImageUri);
        
        // 2. 上传预处理后的图片到 Supabase Storage（使用临时文件名）
        const tempFileName = `temp-${Date.now()}`;
        const imageUrl = await uploadReceiptImageTemp(processedImageUri, tempFileName);
        console.log('图片已上传，URL:', imageUrl);

        // 3. 先创建一个待处理的小票记录（状态为 processing，正在后台处理）
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
        // 使用预处理后的图片 URI
        processReceiptInBackground(imageUrl, receiptId, processedImageUri)
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

            {/* 裁剪框覆盖层 - 显示预览裁剪区域（支持倾斜拍摄的梯形预览） */}
            {showCropBox && (
              <View style={styles.cropBoxContainer} pointerEvents="none">
                {/* 上半部分遮罩 */}
                <View style={[styles.cropMask, { height: SCREEN_HEIGHT * 0.2 }]} />
                
                {/* 中间部分（裁剪框区域） */}
                <View style={styles.cropBoxRow}>
                  {/* 左侧遮罩 */}
                  <View style={[styles.cropMask, { width: SCREEN_WIDTH * 0.1 }]} />
                  
                  {/* 裁剪框 - 使用 SVG 绘制四边形以支持倾斜预览 */}
                  <View style={styles.cropBoxWrapper}>
                    {/* 使用 View 模拟梯形裁剪框（倾斜效果） */}
                    <View style={styles.cropBoxTrapezoid}>
                      {/* 四个角的指示器 */}
                      <View style={[styles.cropCorner, styles.cropCornerTopLeft]} />
                      <View style={[styles.cropCorner, styles.cropCornerTopRight]} />
                      <View style={[styles.cropCorner, styles.cropCornerBottomLeft]} />
                      <View style={[styles.cropCorner, styles.cropCornerBottomRight]} />
                    </View>
                    
                    {/* 提示文字 */}
                    <View style={styles.cropHint}>
                      <Text style={styles.cropHintText}>Preview: Auto-crop will be applied after capture</Text>
                      <Text style={[styles.cropHintText, { fontSize: 12, marginTop: 4, opacity: 0.8 }]}>
                        (Edge detection runs after photo is taken)
                      </Text>
                    </View>
                  </View>
                  
                  {/* 右侧遮罩 */}
                  <View style={[styles.cropMask, { width: SCREEN_WIDTH * 0.1 }]} />
                </View>
                
                {/* 下半部分遮罩 */}
                <View style={[styles.cropMask, { flex: 1 }]} />
              </View>
            )}

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
  cropBoxContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropBoxRow: {
    flexDirection: 'row',
    width: '100%',
    height: SCREEN_HEIGHT * 0.6,
    alignItems: 'center',
  },
  cropBoxWrapper: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropBoxTrapezoid: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_HEIGHT * 0.55,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    position: 'relative',
    // 模拟轻微的倾斜效果（透视预览）
    transform: [{ perspective: 1000 }, { rotateX: '2deg' }, { rotateY: '-1deg' }],
  },
  cropCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#6C5CE7',
  },
  cropCornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cropCornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cropCornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cropCornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  cropMask: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cropHint: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cropHintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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

