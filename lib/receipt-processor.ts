// 后台处理小票识别的模块
import { recognizeReceipt, recognizeSupplierInfo } from './gemini';
import { convertGeminiResultToReceipt } from './receipt-helpers';
import { updateReceipt, getReceiptById } from './database';
import { uploadReceiptImage, supabase } from './supabase';
import { checkDuplicateReceipt } from './receipt-duplicate-checker';
import { findOrCreateSupplier, updateSupplier } from './suppliers';

// 从公共URL中提取文件路径
function extractFilePathFromUrl(url: string): string | null {
  try {
    const STORAGE_BUCKET = 'receipts';
    // URL 格式通常是: https://[project].supabase.co/storage/v1/object/public/receipts/[filename]
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf(STORAGE_BUCKET);
    if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
      // 提取 bucket 后面的所有路径部分（文件名可能包含目录结构）
      const fileName = pathParts.slice(bucketIndex + 1).join('/');
      return fileName;
    }
    return null;
  } catch (error) {
    console.error('Error extracting file path from URL:', error);
    return null;
  }
}

// 删除临时文件
async function deleteTempFile(imageUrl: string): Promise<void> {
  try {
    const STORAGE_BUCKET = 'receipts';
    const filePath = extractFilePathFromUrl(imageUrl);
    if (!filePath) {
      console.warn('Could not extract file path from URL:', imageUrl);
      return;
    }

    console.log(`Deleting temp file from bucket: ${STORAGE_BUCKET}, path: ${filePath}`);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting temp file:', error);
      // 不抛出错误，因为删除失败不应该影响主流程
    } else {
      console.log('Temp file deleted successfully:', filePath);
    }
  } catch (error) {
    console.error('Error deleting temp file:', error);
    // 不抛出错误，因为删除失败不应该影响主流程
  }
}

// 后台处理小票识别（不阻塞用户界面）
export async function processReceiptInBackground(
  imageUrl: string,
  receiptId: string,
  processedImageUri: string
): Promise<void> {
  try {
    console.log('开始后台处理小票识别...', receiptId);
    console.log('使用处理后的图片进行识别，URL:', imageUrl);
    console.log('处理后的图片本地 URI:', processedImageUri);
    
    // 1. 使用处理后的图片 URL 识别小票（imageUrl 已经是处理后的图片）
    const recognizedData = await recognizeReceipt(imageUrl);
    console.log('识别完成，开始转换数据...');

    // 2. 转换为 Receipt 格式（匹配分类和支付账户）
    const receipt = await convertGeminiResultToReceipt(recognizedData);
    console.log('数据转换完成，开始更新小票...');

    // 3. 使用真实ID重新上传处理后的图片（替换临时文件）
    // 注意：processedImageUri 是预处理后的图片本地 URI，不是原始图片
    const finalImageUrl = await uploadReceiptImage(processedImageUri, receiptId);
    console.log('最终处理后的图片已上传，URL:', finalImageUrl);

    // 4. 删除临时文件（如果存在）- 使用 try-catch 确保失败不影响主流程
    if (imageUrl && imageUrl !== finalImageUrl) {
      console.log('删除临时文件:', imageUrl);
      await deleteTempFile(imageUrl);
    }

    // 5. 更新小票数据（使用已存在的 receiptId）
    // 状态已根据置信度在 convertGeminiResultToReceipt 中自动设置
    await updateReceipt(receiptId, {
      ...receipt,
      imageUrl: finalImageUrl,
      confidence: recognizedData.confidence,
    });
    
    // 6. 异步识别供应商详细信息（不阻塞主流程）
    // 如果基本识别中已经有一些供应商信息，先使用它们；然后异步补充更完整的信息
    const supplierInfoFromBasic = recognizedData.supplierInfo;
    const hasBasicSupplierInfo = supplierInfoFromBasic && (
      supplierInfoFromBasic.taxNumber ||
      supplierInfoFromBasic.phone ||
      supplierInfoFromBasic.address
    );

    // 异步识别供应商详细信息（即使基本识别已有信息，也尝试获取更完整的信息）
    recognizeSupplierInfo(finalImageUrl, receipt.supplierName || recognizedData.storeName)
      .then(async (detailedSupplierInfo) => {
        try {
          console.log('[Supplier Info] 异步识别供应商详细信息完成:', detailedSupplierInfo);
          
          // 合并基本识别和详细识别的结果（详细识别优先）
          const mergedSupplierInfo = {
            taxNumber: detailedSupplierInfo.taxNumber || supplierInfoFromBasic?.taxNumber,
            phone: detailedSupplierInfo.phone || supplierInfoFromBasic?.phone,
            address: detailedSupplierInfo.address || supplierInfoFromBasic?.address,
          };

          // 如果有任何供应商信息，更新供应商记录
          if (receipt.supplierId && (mergedSupplierInfo.taxNumber || mergedSupplierInfo.phone || mergedSupplierInfo.address)) {
            console.log('[Supplier Info] 更新供应商详细信息:', mergedSupplierInfo);
            await updateSupplier(receipt.supplierId, {
              taxNumber: mergedSupplierInfo.taxNumber,
              phone: mergedSupplierInfo.phone,
              address: mergedSupplierInfo.address,
            });
            console.log('[Supplier Info] ✅ 供应商详细信息已更新');
          } else if (receipt.supplierName && (mergedSupplierInfo.taxNumber || mergedSupplierInfo.phone || mergedSupplierInfo.address)) {
            // 如果没有 supplierId，尝试查找或创建供应商
            try {
              const supplier = await findOrCreateSupplier(
                receipt.supplierName,
                true,
                mergedSupplierInfo.taxNumber,
                mergedSupplierInfo.phone,
                mergedSupplierInfo.address
              );
              // 更新小票的 supplierId
              await updateReceipt(receiptId, { supplierId: supplier.id });
              console.log('[Supplier Info] ✅ 供应商已创建/更新，小票已关联');
            } catch (error) {
              console.warn('[Supplier Info] 更新供应商失败:', error);
            }
          }
        } catch (error) {
          console.error('[Supplier Info] 异步更新供应商信息失败:', error);
          // 不抛出错误，因为这是异步补充信息，失败不影响主流程
        }
      })
      .catch((error) => {
        console.error('[Supplier Info] 异步识别供应商信息失败:', error);
        // 不抛出错误，因为这是异步补充信息，失败不影响主流程
      });

    // 7. 检测是否与已有小票重复
    const updatedReceipt = await getReceiptById(receiptId);
    if (updatedReceipt) {
      const duplicateReceipt = await checkDuplicateReceipt(updatedReceipt);
      if (duplicateReceipt) {
        // 如果发现重复，更新状态为 duplicate
        await updateReceipt(receiptId, {
          status: 'duplicate',
        });
        console.log(`小票数据已更新，发现重复小票，状态：duplicate，重复的小票ID：${duplicateReceipt.id}`);
      } else {
        console.log(`小票数据已更新，后台处理完成，状态：${receipt.status}，置信度：${recognizedData.confidence}`);
      }
    }
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
