// 后台处理小票识别的模块
import { recognizeReceipt } from './gemini';
import { convertGeminiResultToReceipt } from './receipt-helpers';
import { updateReceipt } from './database';
import { uploadReceiptImage } from './supabase';

// 后台处理小票识别（不阻塞用户界面）
export async function processReceiptInBackground(
  imageUrl: string,
  receiptId: string,
  originalImageUri: string
): Promise<void> {
  try {
    console.log('开始后台处理小票识别...', receiptId);
    
    // 1. 使用图片 URL 识别小票
    const recognizedData = await recognizeReceipt(imageUrl);
    console.log('识别完成，开始转换数据...');

    // 2. 转换为 Receipt 格式（匹配分类和支付账户）
    const receipt = await convertGeminiResultToReceipt(recognizedData);
    console.log('数据转换完成，开始更新小票...');

    // 3. 使用真实ID重新上传图片（替换临时文件）
    const finalImageUrl = await uploadReceiptImage(originalImageUri, receiptId);
    console.log('最终图片已上传，URL:', finalImageUrl);

    // 4. 更新小票数据（使用已存在的 receiptId）
    // 处理完成后，设置为 'pending'（待确认），等待用户检查确认
    await updateReceipt(receiptId, {
      ...receipt,
      imageUrl: finalImageUrl,
      status: 'pending', // 处理完成，待用户确认
      confidence: recognizedData.confidence,
    });
    console.log('小票数据已更新，后台处理完成，状态：待确认');
  } catch (error) {
    console.error('后台处理小票失败:', error);
    // 更新小票状态为错误，让用户可以稍后查看
    try {
      await updateReceipt(receiptId, {
        status: 'pending',
      });
    } catch (updateError) {
      console.error('更新小票状态失败:', updateError);
    }
    throw error;
  }
}
