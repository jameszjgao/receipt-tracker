// 测试 Gemini API Key 和可用模型
// 运行: node test-gemini-api.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

// 从环境变量获取 API Key
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('错误: 未找到 GEMINI_API_KEY 环境变量');
  console.log('请设置: export GEMINI_API_KEY=your_api_key');
  process.exit(1);
}

console.log('API Key 长度:', apiKey.length);
console.log('API Key 前缀:', apiKey.substring(0, 10) + '...');
console.log('\n正在连接 Gemini API...\n');

const genAI = new GoogleGenerativeAI(apiKey);

async function testAPI() {
  try {
    // 1. 列出所有可用的模型
    console.log('1. 获取可用模型列表...');
    const models = await genAI.listModels();
    
    console.log('\n可用的模型:');
    const visionModels = [];
    models.models.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model.name}`);
      // 检查是否支持视觉（图像输入）
      if (model.supportedGenerationMethods && 
          model.supportedGenerationMethods.includes('generateContent')) {
        visionModels.push(model.name);
      }
    });
    
    console.log('\n支持 generateContent 的模型（可用于图像识别）:');
    visionModels.forEach((model, index) => {
      console.log(`  ${index + 1}. ${model}`);
    });
    
    // 2. 尝试使用常见的模型名称
    console.log('\n2. 测试常见模型名称...');
    const modelNamesToTest = [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.0-pro',
      'gemini-1.0-pro-vision-001',
    ];
    
    for (const modelName of modelNamesToTest) {
      try {
        console.log(`\n  测试模型: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        // 只检查模型是否可以初始化，不实际调用
        console.log(`    ✅ 模型 ${modelName} 可用`);
      } catch (error) {
        console.log(`    ❌ 模型 ${modelName} 不可用: ${error.message}`);
      }
    }
    
    // 3. 测试实际的 API 调用（使用简单的文本）
    console.log('\n3. 测试 API 调用（文本）...');
    try {
      const testModel = genAI.getGenerativeModel({ model: visionModels[0] || 'gemini-pro' });
      const result = await testModel.generateContent('Hello, say "API test successful"');
      const response = await result.response;
      console.log('   ✅ API 调用成功');
      console.log('   响应:', response.text().substring(0, 100));
    } catch (error) {
      console.log('   ❌ API 调用失败:', error.message);
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('\n完整错误信息:');
    console.error(error);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('\n⚠️  API Key 无效！请检查:');
      console.error('  1. API Key 是否正确');
      console.error('  2. API Key 是否有访问 Gemini API 的权限');
      console.error('  3. API Key 是否已启用');
    }
  }
}

testAPI();

