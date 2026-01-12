// 图片预处理工具：压缩、调整大小、格式转换
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// 最大图片尺寸（宽度或高度）
const MAX_IMAGE_DIMENSION = 2048;
// 最大文件大小（字节，约 2MB）
const MAX_FILE_SIZE = 2 * 1024 * 1024;
// 目标质量（0-1）
const QUALITY = 0.85;

/**
 * 预处理图片：压缩、调整大小、确保格式正确
 * @param imageUri 原始图片 URI
 * @returns 处理后的图片 URI
 */
export async function processImageForUpload(imageUri: string): Promise<string> {
  try {
    console.log('[图片预处理] 开始预处理图片:', imageUri);
    
    // 检查文件是否存在（添加重试机制，Android 上文件可能需要一点时间才能访问）
    let fileInfo;
    let retries = 3;
    while (retries > 0) {
      try {
        fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (fileInfo.exists) {
          break;
        }
        retries--;
        if (retries > 0) {
          console.log(`[图片预处理] 文件不存在，等待后重试... (剩余 ${retries} 次)`);
          await new Promise(resolve => setTimeout(resolve, 500)); // 等待 500ms
        }
      } catch (checkError) {
        retries--;
        if (retries === 0) {
          throw checkError;
        }
        console.log(`[图片预处理] 检查文件失败，重试... (剩余 ${retries} 次)`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!fileInfo || !fileInfo.exists) {
      throw new Error(`Image file does not exist after retries: ${imageUri}`);
    }
    console.log('[图片预处理] 图片文件存在，大小:', fileInfo.size, 'bytes');
    
    // 1. 获取图片信息（先尝试不压缩，只获取信息）
    let imageInfo;
    try {
      imageInfo = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
    } catch (manipulateError) {
      console.error('获取图片信息失败:', manipulateError);
      // 如果获取信息失败，尝试直接处理（不调整大小）
      console.log('尝试直接压缩图片（不调整大小）...');
      const directCompressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        {
          compress: QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return directCompressed.uri;
    }
    
    if (!imageInfo || !imageInfo.width || !imageInfo.height) {
      console.warn('无法获取图片尺寸，尝试直接压缩...');
      const directCompressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        {
          compress: QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return directCompressed.uri;
    }
    
    console.log('原始图片尺寸:', imageInfo.width, 'x', imageInfo.height);
    
    // 2. 计算目标尺寸（保持宽高比，限制最大尺寸）
    let targetWidth = imageInfo.width;
    let targetHeight = imageInfo.height;
    let needsResize = false;
    
    if (targetWidth > MAX_IMAGE_DIMENSION || targetHeight > MAX_IMAGE_DIMENSION) {
      const ratio = Math.min(
        MAX_IMAGE_DIMENSION / targetWidth,
        MAX_IMAGE_DIMENSION / targetHeight
      );
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
      needsResize = true;
      console.log('调整后尺寸:', targetWidth, 'x', targetHeight);
    }
    
    // 3. 调整大小和压缩
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      needsResize ? [
        {
          resize: {
            width: targetWidth,
            height: targetHeight,
          },
        },
      ] : [],
      {
        compress: QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    console.log('图片处理完成:', manipulatedImage.uri);
    
    // 4. 检查文件大小，如果仍然太大，进一步压缩
    const manipulatedFileInfo = await FileSystem.getInfoAsync(manipulatedImage.uri);
    if (manipulatedFileInfo.exists && manipulatedFileInfo.size && manipulatedFileInfo.size > MAX_FILE_SIZE) {
      console.log('文件仍然太大，进一步压缩:', manipulatedFileInfo.size, 'bytes');
      
      // 逐步降低质量直到文件大小合适
      let currentQuality = QUALITY;
      let finalUri = manipulatedImage.uri;
      
      while (currentQuality > 0.5) {
        currentQuality -= 0.1;
        const furtherCompressed = await ImageManipulator.manipulateAsync(
          manipulatedImage.uri,
          [],
          {
            compress: currentQuality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        
        const furtherInfo = await FileSystem.getInfoAsync(furtherCompressed.uri);
        if (furtherInfo.exists && furtherInfo.size && furtherInfo.size <= MAX_FILE_SIZE) {
          // 删除之前的临时文件
          try {
            await FileSystem.deleteAsync(manipulatedImage.uri, { idempotent: true });
          } catch (e) {
            console.warn('删除临时文件失败:', e);
          }
          finalUri = furtherCompressed.uri;
          console.log('进一步压缩完成，最终大小:', furtherInfo.size, 'bytes');
          break;
        } else {
          // 删除这个临时文件，继续尝试
          try {
            await FileSystem.deleteAsync(furtherCompressed.uri, { idempotent: true });
          } catch (e) {
            console.warn('删除临时文件失败:', e);
          }
        }
      }
      
      return finalUri;
    }
    
    return manipulatedImage.uri;
  } catch (error) {
    console.error('图片预处理失败:', error);
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : String(error),
      uri: imageUri,
    });
    
    // 如果预处理失败，尝试检查文件是否存在
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error(`Image file does not exist: ${imageUri}`);
      }
      console.log('原始图片文件存在，直接使用原始图片');
    } catch (checkError) {
      console.error('检查文件存在性失败:', checkError);
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // 如果预处理失败但文件存在，返回原始 URI（让上传函数处理）
    return imageUri;
  }
}
