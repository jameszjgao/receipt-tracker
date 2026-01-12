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
    console.log('开始预处理图片:', imageUri);
    
    // 1. 获取图片信息
    const imageInfo = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    console.log('原始图片尺寸:', imageInfo.width, 'x', imageInfo.height);
    
    // 2. 计算目标尺寸（保持宽高比，限制最大尺寸）
    let targetWidth = imageInfo.width;
    let targetHeight = imageInfo.height;
    
    if (targetWidth > MAX_IMAGE_DIMENSION || targetHeight > MAX_IMAGE_DIMENSION) {
      const ratio = Math.min(
        MAX_IMAGE_DIMENSION / targetWidth,
        MAX_IMAGE_DIMENSION / targetHeight
      );
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
      console.log('调整后尺寸:', targetWidth, 'x', targetHeight);
    }
    
    // 3. 调整大小和压缩
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: targetWidth,
            height: targetHeight,
          },
        },
      ],
      {
        compress: QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    console.log('图片处理完成:', manipulatedImage.uri);
    
    // 4. 检查文件大小，如果仍然太大，进一步压缩
    const fileInfo = await FileSystem.getInfoAsync(manipulatedImage.uri);
    if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
      console.log('文件仍然太大，进一步压缩:', fileInfo.size, 'bytes');
      
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
    // 如果预处理失败，返回原始 URI（让上传函数处理错误）
    return imageUri;
  }
}
