import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import Constants from 'expo-constants';
import { uploadReceiptImage, uploadReceiptImageTemp } from '@/lib/supabase';
import { saveReceipt } from '@/lib/database';
import { processReceiptInBackground } from '@/lib/receipt-processor';
import { isAuthenticated } from '@/lib/auth';
import { processImageForUpload } from '@/lib/image-processor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CameraScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedReceiptId, setCapturedReceiptId] = useState<string | null>(null);
  const router = useRouter();

  // Check if running in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      router.replace('/login');
    }
  };

  const scanDocument = async () => {
    // If we are in Expo Go, we can't use the native scanner
    if (isExpoGo) {
      Alert.alert(
        'Development Build Required',
        'Real-time edge detection and cropping requires a native development build. In Expo Go, please use the "Pick from Gallery" option or rebuild your app with EAS.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 90,
      });

      if (scannedImages && scannedImages.length > 0) {
        processCapturedImage(scannedImages[0]);
      }
    } catch (error) {
      console.error('Document scan error:', error);
      Alert.alert('Error', 'Failed to scan document. Please try again.');
    }
  };

  const processCapturedImage = async (imageUri: string) => {
    try {
      setIsProcessing(true);
      console.log('Processing captured image:', imageUri);

      // 1. Process image (compress, etc) - resizing already done by scanner usually, but good to normalize
      const processedImageUri = await processImageForUpload(imageUri, {
        quality: 0.85
      });
      console.log('Image processed:', processedImageUri);

      // 2. Upload to Supabase Storage (temp)
      const tempFileName = `temp-${Date.now()}`;
      const imageUrl = await uploadReceiptImageTemp(processedImageUri, tempFileName);
      console.log('Image uploaded:', imageUrl);

      // 3. Create receipt record
      const today = new Date().toISOString().split('T')[0];
      const receiptId = await saveReceipt({
        householdId: '', // Will be auto-filled
        storeName: 'Processing...',
        totalAmount: 0,
        date: today,
        status: 'processing',
        items: [],
        imageUrl: imageUrl,
      });
      console.log('Receipt record created:', receiptId);

      setIsProcessing(false);
      setCapturedReceiptId(receiptId);

      // 4. Background processing with Gemini
      processReceiptInBackground(imageUrl, receiptId, processedImageUri)
        .then(() => console.log('Background processing started'))
        .catch(err => console.error('Background processing failed:', err));

    } catch (error) {
      setIsProcessing(false);
      console.error('Processing error:', error);
      Alert.alert('Error', 'Failed to process receipt.');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Allow manual crop if picking from gallery
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        processCapturedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  if (capturedReceiptId) {
    return (
      <View style={styles.actionContainer}>
        <View style={styles.actionContent}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#00B894" />
          </View>
          <Text style={styles.successTitle}>Receipt Saved</Text>
          <Text style={styles.successSubtitle}>Processing under way...</Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setCapturedReceiptId(null)}
            >
              <Ionicons name="scan" size={24} color="#6C5CE7" />
              <Text style={styles.actionButtonText}>Scan Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/receipt-details/${capturedReceiptId}`)}
            >
              <Ionicons name="document-text" size={24} color="#6C5CE7" />
              <Text style={styles.actionButtonText}>View Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/receipts')}
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
        <View style={styles.content}>
          <Text style={styles.title}>Scan Receipt</Text>
          <Text style={styles.subtitle}>
            Use the smart scanner to automatically detect edges and crop your receipt.
          </Text>

          <TouchableOpacity style={styles.mainButton} onPress={scanDocument}>
            <View style={styles.iconCircle}>
              <Ionicons name="scan-outline" size={60} color="#fff" />
            </View>
            <Text style={styles.mainButtonText}>Start Scanning</Text>
          </TouchableOpacity>

          {isExpoGo && (
            <Text style={styles.warningText}>
              Note: Native scanner requires development build. In Expo Go, please use the gallery picker below.
            </Text>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
            <Ionicons name="images-outline" size={24} color="#6C5CE7" />
            <Text style={styles.secondaryButtonText}>Pick from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 20,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  mainButton: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  mainButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DFE6E9',
    marginTop: 20,
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  warningText: {
    color: '#E74C3C',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: -10,
    paddingHorizontal: 20,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#636E72',
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
  },
  successSubtitle: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 40,
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

