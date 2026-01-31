import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { recognizeReceiptFromText, recognizeReceiptFromAudio } from '@/lib/gemini';
import { saveReceipt, updateReceipt, getReceiptById } from '@/lib/database';
import { saveChatLog, getChatLogsPaginated } from '@/lib/chat-logs';
import { ReceiptStatus, Receipt } from '@/types';
import { convertGeminiResultToReceipt } from '@/lib/receipt-helpers';
import { format } from 'date-fns';
import { 
  startRecording, 
  stopRecording, 
  cancelRecording, 
  uploadAudioFile, 
  playAudio, 
  stopPlayback,
  requestAudioPermission,
} from '@/lib/audio';

// 格式化货币显示
const formatCurrency = (amount: number, currency?: string): string => {
  const currencyCode = currency || 'USD';
  const currencySymbols: { [key: string]: string } = {
    USD: '$',
    CNY: '¥',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  const symbol = currencySymbols[currencyCode] || currencyCode;
  return `${symbol}${amount.toFixed(2)}`;
};

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  receiptPreview?: Receipt; // 识别结果预览
  receiptDeleted?: boolean; // 对应小票是否已被删除（用于更新按钮状态）
  audioUrl?: string; // 语音消息的录音 URL
  isPlayingAudio?: boolean; // 是否正在播放此音频
}

export default function VoiceInputScreen() {
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedReceipts, setConfirmedReceipts] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [oldestLoadedAt, setOldestLoadedAt] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // 语音模式相关状态（默认语音模式）
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const recordingAnimation = useRef(new Animated.Value(1)).current;
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const isStartingRecording = useRef(false);
  const isRecordingRef = useRef(false); // 用 ref 跟踪录音状态，避免闭包问题
  const recordingDurationRef = useRef(0);
  const isLongPressMode = useRef(false); // 是否是长按模式（按住录音）
  const pressStartTime = useRef(0); // 按下的时间戳
  
  // Toast 提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  
  // 显示 Toast
  const showToast = (message: string, duration: number = 1500) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  useEffect(() => {
    // 首次加载：拉取最近的历史聊天记录（例如最近 20 条）
    const loadInitialHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const logs = await getChatLogsPaginated(20);

        if (!logs || logs.length === 0) {
          // 没有历史时，显示默认欢迎文案
          setMessages([
            {
              id: 'welcome',
              text:
                'Hi! I can help you create receipts from text. Just describe your purchase, and I\'ll extract the details.\n\nExample: "I spent $25.50 at Starbucks on March 15th, 2024. Items: Coffee $5.50, Sandwich $20.00"',
              isUser: false,
              timestamp: new Date(),
            },
          ]);
          setHasMoreHistory(false);
          return;
        }

        // Supabase 是按 created_at 降序返回，这里反转成时间正序显示
        const sorted = [...logs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        const restoredMessages: Message[] = [];

        for (const log of sorted) {
          // 用户输入（包含语音录入的 audioUrl）
          if (log.prompt) {
            restoredMessages.push({
              id: `${log.id}-prompt`,
              text: log.audioUrl ? `🎤 Voice` : log.prompt,
              isUser: true,
              timestamp: new Date(log.createdAt),
              audioUrl: log.audioUrl,
            });
          }

          // 系统回复 + 预览卡片
          if (log.responseData?.receiptPreview) {
            const preview = log.responseData.receiptPreview as Receipt;
            restoredMessages.push({
              id: `${log.id}-preview`,
              text: '',
              isUser: false,
              timestamp: new Date(log.createdAt),
              receiptPreview: preview,
            });
          } else if (log.response) {
            restoredMessages.push({
              id: `${log.id}-response`,
              text: log.response,
              isUser: false,
              timestamp: new Date(log.createdAt),
            });
          }
        }

        if (restoredMessages.length === 0) {
          // 兜底：如果没有任何可还原的消息，也展示欢迎文案一次
          setMessages([
            {
              id: 'welcome',
              text:
                'Hi! I can help you create receipts from text. Just describe your purchase, and I\'ll extract the details.\n\nExample: "I spent $25.50 at Starbucks on March 15th, 2024. Items: Coffee $5.50, Sandwich $20.00"',
              isUser: false,
              timestamp: new Date(),
            },
          ]);
          setHasMoreHistory(false);
        } else {
          // 加载时就根据真实小票状态，预先打上已删除 / 已确认等标记
          const enriched = await Promise.all(
            restoredMessages.map(async (msg) => {
              if (!msg.receiptPreview?.id) return msg;
              try {
                const receipt = await getReceiptById(msg.receiptPreview.id);
                if (!receipt) {
                  return { ...msg, receiptDeleted: true };
                }
                return {
                  ...msg,
                  receiptPreview: {
                    ...msg.receiptPreview,
                    status: receipt.status as ReceiptStatus,
                  },
                  receiptDeleted: false,
                };
              } catch {
                // 查询失败时，保守认为已删除
                return { ...msg, receiptDeleted: true };
              }
            }),
          );

          setMessages(enriched);
          const oldest = sorted[sorted.length - 1];
          setOldestLoadedAt(oldest.createdAt);
          setHasMoreHistory(sorted.length >= 20);
        }
      } catch (error) {
        console.error('Error loading initial chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();

    // 自动聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    // 监听键盘事件
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // 向上滚动时加载更多历史记录
  const handleScroll = async (event: any) => {
    if (!hasMoreHistory || isLoadingHistory || !oldestLoadedAt) return;

    const { contentOffset } = event.nativeEvent;
    if (contentOffset.y <= 0) {
      try {
        setIsLoadingHistory(true);
        const moreLogs = await getChatLogsPaginated(20, oldestLoadedAt);

        if (!moreLogs || moreLogs.length === 0) {
          setHasMoreHistory(false);
          return;
        }

        const sorted = [...moreLogs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        const moreMessagesRaw: Message[] = [];
        for (const log of sorted) {
          if (log.prompt) {
            moreMessagesRaw.push({
              id: `${log.id}-prompt`,
              text: log.prompt,
              isUser: true,
              timestamp: new Date(log.createdAt),
            });
          }
          if (log.responseData?.receiptPreview) {
            const preview = log.responseData.receiptPreview as Receipt;
            moreMessagesRaw.push({
              id: `${log.id}-preview`,
              text: '',
              isUser: false,
              timestamp: new Date(log.createdAt),
              receiptPreview: preview,
            });
          } else if (log.response) {
            moreMessagesRaw.push({
              id: `${log.id}-response`,
              text: log.response,
              isUser: false,
              timestamp: new Date(log.createdAt),
            });
          }
        }

        // 向上加载更多历史时，同样在加载阶段就识别删除/状态
        const moreMessages = await Promise.all(
          moreMessagesRaw.map(async (msg) => {
            if (!msg.receiptPreview?.id) return msg;
            try {
              const receipt = await getReceiptById(msg.receiptPreview.id);
              if (!receipt) {
                return { ...msg, receiptDeleted: true };
              }
              return {
                ...msg,
                receiptPreview: {
                  ...msg.receiptPreview,
                  status: receipt.status as ReceiptStatus,
                },
                receiptDeleted: false,
              };
            } catch {
              return { ...msg, receiptDeleted: true };
            }
          }),
        );

        setMessages((prev) => [...moreMessages, ...prev]);
        const oldest = sorted[sorted.length - 1];
        setOldestLoadedAt(oldest.createdAt);
        setHasMoreHistory(sorted.length >= 20);
      } catch (error) {
        console.error('Error loading more chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  // 详情按钮：进入前先检查小票是否还存在，删除的话更新卡片状态
  const handlePreviewDetails = async (message: Message) => {
    const receiptId = message.receiptPreview?.id;
    if (!receiptId) return;

    try {
      const receipt = await getReceiptById(receiptId);
      if (!receipt) {
        // 视为已删除
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id ? { ...m, receiptDeleted: true } : m,
          ),
        );
        Alert.alert('Receipt Deleted', 'This receipt has been deleted.');
        return;
      }

      router.push(`/receipt-details/${receiptId}`);
    } catch (error) {
      console.error('Error loading receipt for preview:', error);
      // 绝大多数情况下，异常意味着记录已被删除或无权限访问
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, receiptDeleted: true } : m,
        ),
      );
      Alert.alert('Receipt Deleted', 'This receipt has been deleted.');
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    // 滚动到底部
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // 调用Gemini识别文字
      const result = await recognizeReceiptFromText(text);
      
      // 转换为Receipt格式
      const receipt = await convertGeminiResultToReceipt(result);
      
      // 保存到数据库（确保状态为pending，标记为文字输入）
      const receiptToSave = {
        ...receipt,
        status: 'pending' as ReceiptStatus,
        inputType: 'text' as const,
      };
      const receiptId = await saveReceipt(receiptToSave);

      // 添加识别结果预览消息（包含支付账户信息用于显示，状态为pending）
      const previewMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '',
        isUser: false,
        timestamp: new Date(),
        receiptPreview: { 
          ...receiptToSave, 
          id: receiptId,
          status: 'pending' as ReceiptStatus,
          paymentAccount: result.paymentAccountName ? {
            id: receipt.paymentAccountId || '',
            spaceId: receipt.spaceId,
            name: result.paymentAccountName,
            isAiRecognized: true,
          } : undefined,
        },
      };
      setMessages(prev => [...prev, previewMessage]);

      // 将本次对话写入 ai_chat_logs，便于下次进入继续看到历史
      await saveChatLog({
        receiptId,
        type: 'text',
        modelName: 'gemini',
        prompt: text,
        response: previewMessage.text,
        requestData: { rawText: text },
        responseData: { receiptPreview: previewMessage.receiptPreview },
        success: true,
      });

      // 滚动到底部
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error processing text:', error);
      
      // 添加错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to recognize receipt from text'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);

      // 滚动到底部
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } finally {
      setIsProcessing(false);
    }
  };

  // 开始录音
  const handleStartRecording = async () => {
    // 防止重复触发
    if (isRecordingRef.current || isStartingRecording.current || isProcessing) {
      console.log('handleStartRecording: already recording or starting, skip');
      return;
    }
    
    isStartingRecording.current = true;
    console.log('handleStartRecording: starting...');
    
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice input.');
        return;
      }

      const started = await startRecording();
      if (started) {
        isRecordingRef.current = true;
        recordingDurationRef.current = 0;
        setIsRecording(true);
        setRecordingDuration(0);
        
        // 开始计时
        recordingTimer.current = setInterval(() => {
          recordingDurationRef.current += 1;
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        // 录音动画（脉动效果）
        Animated.loop(
          Animated.sequence([
            Animated.timing(recordingAnimation, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(recordingAnimation, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
        console.log('handleStartRecording: recording started successfully');
      }
    } finally {
      isStartingRecording.current = false;
    }
  };

  // 停止录音并发送
  const handleStopRecording = async () => {
    console.log('handleStopRecording: called, isRecordingRef=', isRecordingRef.current);
    
    // 使用 ref 检查，避免闭包问题
    if (!isRecordingRef.current) {
      console.log('handleStopRecording: not recording, skip');
      return;
    }
    
    // 立即标记为不再录音
    isRecordingRef.current = false;
    
    // 停止计时和动画
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(1);
    setIsRecording(false);
    
    const duration = recordingDurationRef.current;
    console.log('handleStopRecording: duration=', duration);
    
    // 录音时长太短（小于3秒），取消
    if (duration < 3) {
      await cancelRecording();
      showToast('Recording too short');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // 停止录音获取本地文件
      const localUri = await stopRecording();
      if (!localUri) {
        throw new Error('Failed to get recording');
      }

      // 添加用户语音消息（先显示，稍后更新 audioUrl）
      const userMessageId = Date.now().toString();
      const userMessage: Message = {
        id: userMessageId,
        text: `🎤 Voice (${duration}s)`,
        isUser: true,
        timestamp: new Date(),
        audioUrl: localUri, // 暂用本地 URI，上传后更新
      };
      setMessages(prev => [...prev, userMessage]);
      
      // 滚动到底部
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // 上传录音文件
      const audioUrl = await uploadAudioFile(localUri);
      if (!audioUrl) {
        throw new Error('Failed to upload audio');
      }
      
      // 更新消息中的 audioUrl
      setMessages(prev => prev.map(msg => 
        msg.id === userMessageId ? { ...msg, audioUrl } : msg
      ));

      // 调用 Gemini 识别语音
      const result = await recognizeReceiptFromAudio(localUri);
      
      // 转换为 Receipt 格式
      const receipt = await convertGeminiResultToReceipt(result);
      
      // 保存到数据库（标记为语音输入）
      const receiptToSave = {
        ...receipt,
        status: 'pending' as ReceiptStatus,
        inputType: 'audio' as const,
      };
      const receiptId = await saveReceipt(receiptToSave);

      // 添加识别结果预览消息
      const previewMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '',
        isUser: false,
        timestamp: new Date(),
        receiptPreview: { 
          ...receiptToSave, 
          id: receiptId,
          status: 'pending' as ReceiptStatus,
          paymentAccount: result.paymentAccountName ? {
            id: receipt.paymentAccountId || '',
            spaceId: receipt.spaceId,
            name: result.paymentAccountName,
            isAiRecognized: true,
          } : undefined,
        },
      };
      setMessages(prev => [...prev, previewMessage]);

      // 保存聊天记录（包含 audioUrl）
      await saveChatLog({
        receiptId,
        type: 'audio',
        modelName: 'gemini',
        prompt: `Voice input (${recordingDuration}s)`,
        response: previewMessage.text,
        requestData: { audioUrl },
        responseData: { receiptPreview: previewMessage.receiptPreview },
        success: true,
        audioUrl,
      });

      // 滚动到底部
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error processing voice:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `❌ Error: ${error instanceof Error ? error.message : 'Failed to recognize receipt from voice'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } finally {
      setIsProcessing(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
    }
  };

  // 取消录音
  const handleCancelRecording = async () => {
    isRecordingRef.current = false;
    recordingDurationRef.current = 0;
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    recordingAnimation.stopAnimation();
    recordingAnimation.setValue(1);
    setIsRecording(false);
    setRecordingDuration(0);
    await cancelRecording();
  };

  // 播放/停止音频
  const handlePlayAudio = async (messageId: string, audioUrl: string) => {
    if (playingAudioId === messageId) {
      // 正在播放这条，停止
      await stopPlayback();
      setPlayingAudioId(null);
    } else {
      // 播放新的
      setPlayingAudioId(messageId);
      await playAudio(audioUrl, () => {
        // 播放完成后重置状态
        setPlayingAudioId(null);
      });
    }
  };

  // 格式化录音时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 返回按钮 - 绝对定位在顶栏 */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#2D3436" />
      </TouchableOpacity>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }}
      >
        {messages.map((message) => (
          <View key={message.id}>
            {/* 用户消息上方显示时间戳 */}
            {message.isUser && (message.text || message.audioUrl) && (
              <View style={styles.timestampDivider}>
                <Text style={styles.timestampText}>
                  {format(message.timestamp, 'MMM dd, HH:mm')}
                </Text>
              </View>
            )}
            
            {/* 只在有内容时显示消息气泡 */}
            {(message.text || message.audioUrl) && (
              <View
                style={[
                  styles.messageContainer,
                  message.isUser ? styles.userMessage : styles.botMessage,
                ]}
              >
                {/* 语音消息：显示播放按钮 */}
                {message.audioUrl ? (
                  <TouchableOpacity
                    style={styles.audioMessageContent}
                    onPress={() => handlePlayAudio(message.id, message.audioUrl!)}
                  >
                    <Ionicons 
                      name={playingAudioId === message.id ? 'pause-circle' : 'play-circle'} 
                      size={32} 
                      color={message.isUser ? '#fff' : '#6C5CE7'} 
                    />
                    <Text style={[
                      styles.messageText,
                      message.isUser ? styles.userMessageText : styles.botMessageText,
                      { marginLeft: 8 }
                    ]}>
                      {message.text}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[
                    styles.messageText,
                    message.isUser ? styles.userMessageText : styles.botMessageText,
                  ]}>
                    {message.text}
                  </Text>
                )}
              </View>
            )}
            
            {/* 识别结果预览卡片 */}
            {message.receiptPreview && (
              <View style={styles.receiptPreviewCard}>
                <View style={styles.receiptPreviewHeader}>
                  <Ionicons name="receipt" size={20} color="#6C5CE7" />
                  <Text style={styles.receiptPreviewTitle}>Receipt Preview</Text>
                </View>
                <View style={styles.receiptPreviewContent}>
                  <View style={styles.receiptPreviewRow}>
                    <Text style={styles.receiptPreviewLabel}>Marked as:</Text>
                    <Text style={styles.receiptPreviewValue}>{message.receiptPreview.supplierName}</Text>
                  </View>
                  <View style={styles.receiptPreviewRow}>
                    <Text style={styles.receiptPreviewLabel}>Date:</Text>
                    <Text style={styles.receiptPreviewValue}>
                      {(() => {
                        try {
                          // 解析日期字符串为本地时区，避免 UTC 时区转换问题
                          const [year, month, day] = message.receiptPreview.date.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          return format(date, 'MMM dd, yyyy');
                        } catch {
                          return message.receiptPreview.date;
                        }
                      })()}
                    </Text>
                  </View>
                  <View style={styles.receiptPreviewRow}>
                    <Text style={styles.receiptPreviewLabel}>Amount:</Text>
                    <Text style={[styles.receiptPreviewValue, styles.receiptPreviewAmount]}>
                      {formatCurrency(message.receiptPreview.totalAmount, message.receiptPreview.currency)}
                    </Text>
                  </View>
                  {message.receiptPreview.paymentAccount && (
                    <View style={styles.receiptPreviewRow}>
                      <Text style={styles.receiptPreviewLabel}>Account:</Text>
                      <Text style={styles.receiptPreviewValue}>
                        {message.receiptPreview.paymentAccount.name}
                      </Text>
                    </View>
                  )}
                  {message.receiptPreview.items && message.receiptPreview.items.length > 0 && (
                    <View style={styles.receiptPreviewItems}>
                      <Text style={styles.receiptPreviewLabel}>Items:</Text>
                      {message.receiptPreview.items.map((item, index) => (
                        <View key={index} style={styles.receiptPreviewItemRow}>
                          <Text style={styles.receiptPreviewItemName}>{item.name}</Text>
                          <Text style={styles.receiptPreviewItemPrice}>
                            {item.price.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.receiptPreviewActions}>
                  {/* 左侧：仅在小票未删除时展示详情按钮 */}
                  {!message.receiptDeleted && (
                    <TouchableOpacity
                      style={styles.previewActionButton}
                      onPress={() => {
                        handlePreviewDetails(message);
                      }}
                    >
                      <Ionicons name="eye-outline" size={16} color="#6C5CE7" />
                      <Text style={styles.previewActionText}>View Details</Text>
                    </TouchableOpacity>
                  )}

                  {/* 右侧按钮：根据实际状态显示“Confirm / Confirmed / Deleted” */}
                  <TouchableOpacity
                    style={[
                      styles.previewActionButton,
                      message.receiptDeleted
                        ? styles.previewActionButtonDisabled
                        : confirmedReceipts.has(message.receiptPreview!.id!) ||
                          message.receiptPreview!.status === 'confirmed'
                        ? styles.previewActionButtonConfirmed
                        : styles.previewActionButtonPrimary,
                    ]}
                    onPress={async () => {
                      if (!message.receiptPreview?.id) return;

                      // 已删除的记录，不再允许确认，直接提示
                      if (message.receiptDeleted) {
                        Alert.alert('Receipt Deleted', 'This receipt has been deleted.');
                        return;
                      }

                      // 如果已经确认，不做任何操作
                      if (
                        confirmedReceipts.has(message.receiptPreview.id) ||
                        message.receiptPreview.status === 'confirmed'
                      ) {
                        return;
                      }

                      try {
                        // 再次确认小票是否存在，避免已被删除的情况
                        const receipt = await getReceiptById(message.receiptPreview.id);
                        if (!receipt) {
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === message.id ? { ...msg, receiptDeleted: true } : msg,
                            ),
                          );
                          Alert.alert('Receipt Deleted', 'This receipt has been deleted.');
                          return;
                        }

                        // 更新小票状态为已确认
                        await updateReceipt(message.receiptPreview.id, { status: 'confirmed' });

                        // 更新本地状态
                        setConfirmedReceipts((prev) => new Set(prev).add(message.receiptPreview!.id!));

                        // 更新消息中的 receipt 状态
                        setMessages((prev) =>
                          prev.map((msg) => {
                            if (msg.id === message.id && msg.receiptPreview) {
                              return {
                                ...msg,
                                receiptPreview: {
                                  ...msg.receiptPreview,
                                  status: 'confirmed' as ReceiptStatus,
                                },
                              };
                            }
                            return msg;
                          }),
                        );

                        // 清空输入框，准备下一条
                        setInputText('');
                        // 不自动聚焦，避免触发键盘
                      } catch (error) {
                        console.error('Error confirming receipt:', error);
                        Alert.alert('Error', 'Failed to confirm receipt. Please try again.');
                      }
                    }}
                    disabled={
                      message.receiptDeleted ||
                      confirmedReceipts.has(message.receiptPreview!.id!) ||
                      message.receiptPreview!.status === 'confirmed'
                    }
                  >
                    {message.receiptDeleted ? (
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    ) : (
                      <Ionicons
                        name={
                          confirmedReceipts.has(message.receiptPreview!.id!) ||
                          message.receiptPreview!.status === 'confirmed'
                            ? 'checkmark-circle'
                            : 'checkmark-circle-outline'
                        }
                        size={16}
                        color="#fff"
                      />
                    )}
                    <Text style={[styles.previewActionText, styles.previewActionTextPrimary]}>
                      {message.receiptDeleted
                        ? 'Deleted'
                        : confirmedReceipts.has(message.receiptPreview!.id!) ||
                          message.receiptPreview!.status === 'confirmed'
                        ? 'Confirmed'
                        : 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
          </View>
        ))}
        {isProcessing && (
          <View style={[styles.messageContainer, styles.botMessage]}>
            <ActivityIndicator size="small" color="#6C5CE7" />
            <Text style={[styles.messageText, styles.botMessageText]}>
              Processing...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Toast 提示 - 显示在输入区域上方 */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? (keyboardHeight || 20) : (keyboardHeight || 16) }]}>
        {/* 语音/键盘切换按钮 */}
        <TouchableOpacity
          style={styles.modeToggleButton}
          onPress={() => {
            setIsVoiceMode(!isVoiceMode);
            if (!isVoiceMode) {
              Keyboard.dismiss();
            }
          }}
          disabled={isProcessing || isRecording}
        >
          {isVoiceMode ? (
            <MaterialCommunityIcons name="keyboard-outline" size={24} color="#6C5CE7" />
          ) : (
            <Ionicons name="mic-outline" size={24} color="#6C5CE7" />
          )}
        </TouchableOpacity>

        {isVoiceMode ? (
          // Voice mode: tap to start/stop OR hold to talk
          <Pressable
            style={({ pressed }) => [
              styles.voiceButton,
              isRecording && styles.voiceButtonRecording,
              pressed && !isRecording && styles.voiceButtonPressed,
            ]}
            onPressIn={() => {
              // 记录按下时间
              pressStartTime.current = Date.now();
              isLongPressMode.current = false;
            }}
            onLongPress={() => {
              // 长按模式：开始录音
              if (!isRecordingRef.current && !isProcessing) {
                isLongPressMode.current = true;
                handleStartRecording();
              }
            }}
            onPressOut={() => {
              const pressDuration = Date.now() - pressStartTime.current;
              
              if (isLongPressMode.current && isRecordingRef.current) {
                // 长按模式：松手停止并提交
                handleStopRecording();
              } else if (pressDuration < 500) {
                // 短按模式：点击切换录音状态
                if (isRecordingRef.current) {
                  // 正在录音，停止并提交
                  handleStopRecording();
                } else if (!isProcessing) {
                  // 未在录音，开始录音
                  isLongPressMode.current = false;
                  handleStartRecording();
                }
              }
            }}
            delayLongPress={500}
            disabled={isProcessing}
          >
            {isRecording ? (
              <Animated.View style={{ transform: [{ scale: recordingAnimation }] }}>
                <View style={styles.voiceButtonContent}>
                  <Ionicons name="mic" size={24} color="#E74C3C" />
                  <Text style={styles.voiceButtonTextRecording}>
                    {formatDuration(recordingDuration)} - Tap to send
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.voiceButtonContent}>
                <Ionicons name="mic-outline" size={24} color="#636E72" />
                <Text style={styles.voiceButtonText}>Tap or hold to record</Text>
              </View>
            )}
          </Pressable>
        ) : (
          // 文字模式：输入框
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Describe your purchase..."
              placeholderTextColor="#95A5A6"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isProcessing}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
            {inputText.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setInputText('')}
              >
                <Ionicons name="close-circle" size={20} color="#95A5A6" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 发送按钮（仅文字模式显示） */}
        {!isVoiceMode && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isProcessing) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
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
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(45, 52, 54, 0.9)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 16 : 16,
    right: 16,
    zIndex: 1000,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 8,
    padding: 10,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C5CE7',
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#2D3436',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingRight: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#2D3436',
  },
  clearButton: {
    padding: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  timestampDivider: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 4,
    marginRight: 16,
  },
  timestampText: {
    fontSize: 11,
    color: '#95A5A6',
    fontWeight: '400',
  },
  receiptPreviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  receiptPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  receiptPreviewContent: {
    marginBottom: 8,
  },
  receiptPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptPreviewLabel: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  receiptPreviewValue: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '600',
  },
  receiptPreviewAmount: {
    color: '#6C5CE7',
    fontSize: 16,
  },
  receiptPreviewItems: {
    marginTop: 8,
  },
  receiptPreviewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingLeft: 8,
  },
  receiptPreviewItemName: {
    fontSize: 13,
    color: '#2D3436',
    flex: 1,
  },
  receiptPreviewItemPrice: {
    fontSize: 13,
    color: '#636E72',
    fontWeight: '500',
    marginLeft: 8,
  },
  receiptPreviewActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  previewActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    gap: 6,
  },
  previewActionButtonPrimary: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  previewActionButtonConfirmed: {
    backgroundColor: '#00B894',
    borderColor: '#00B894',
  },
  previewActionButtonDisabled: {
    backgroundColor: '#BDC3C7',
    borderColor: '#BDC3C7',
  },
  previewActionText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  previewActionTextPrimary: {
    color: '#fff',
  },
  // 语音模式相关样式
  modeToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0EFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8F9FA',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: '#FFEBEE',
    borderColor: '#E74C3C',
  },
  voiceButtonPressed: {
    backgroundColor: '#F0F0F0',
    borderColor: '#6C5CE7',
  },
  voiceButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceButtonText: {
    fontSize: 15,
    color: '#636E72',
    fontWeight: '500',
  },
  voiceButtonTextRecording: {
    fontSize: 15,
    color: '#E74C3C',
    fontWeight: '600',
  },
  audioMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
