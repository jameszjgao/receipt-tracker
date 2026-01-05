// 简单的 Gemini API Key 测试脚本
// 运行: node test-gemini-api-simple.js

require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ 错误: 未找到 GEMINI_API_KEY 环境变量');
  console.log('请设置: export GEMINI_API_KEY=your_api_key');
  process.exit(1);
}

console.log('✅ API Key 已找到');
console.log('  长度:', apiKey.length);
console.log('  前缀:', apiKey.substring(0, 10) + '...\n');

console.log('正在测试 Gemini API...\n');

// 使用 REST API 测试
async function testAPI() {
  try {
    // 1. 测试列出模型
    console.log('1. 测试 API Key 权限（列出可用模型）...');
    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    
    if (!modelsResponse.ok) {
      const errorText = await modelsResponse.text();
      console.error('❌ API 调用失败');
      console.error('  状态码:', modelsResponse.status);
      console.error('  错误:', errorText);
      
      if (modelsResponse.status === 401) {
        console.error('\n⚠️  API Key 无效或未授权！');
        console.error('请检查 API Key 是否正确，或访问 https://makersuite.google.com/app/apikey');
      } else if (modelsResponse.status === 403) {
        console.error('\n⚠️  权限不足！');
        console.error('请在 Google Cloud Console 中启用 Generative Language API');
      }
      return;
    }
    
    const modelsData = await modelsResponse.json();
    const models = modelsData.models || [];
    
    console.log(`✅ API Key 有效！找到 ${models.length} 个可用模型\n`);
    
    // 显示支持图像识别的模型
    const visionModels = models.filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    console.log('2. 支持图像识别的模型:');
    visionModels.slice(0, 5).forEach((model, index) => {
      const modelName = model.name.replace('models/', '');
      console.log(`   ${index + 1}. ${modelName} (${model.displayName || modelName})`);
    });
    
    // 3. 测试实际的 API 调用
    console.log('\n3. 测试文本生成 API...');
    const testModel = visionModels[0]?.name || 'models/gemini-2.5-flash';
    const modelName = testModel.replace('models/', '');
    
    const generateResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/${testModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "API test successful" in one sentence'
            }]
          }]
        })
      }
    );
    
    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('❌ API 调用失败');
      console.error('  状态码:', generateResponse.status);
      console.error('  错误:', errorText);
      return;
    }
    
    const generateData = await generateResponse.json();
    const responseText = generateData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    
    console.log(`✅ 使用模型 ${modelName} 成功生成响应`);
    console.log(`   响应: ${responseText.substring(0, 100)}...\n`);
    
    console.log('🎉 GEMINI_API_KEY 测试通过！');
    console.log('   您的 API Key 配置正确，可以正常使用。\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.message.includes('fetch')) {
      console.error('\n⚠️  网络连接失败，请检查网络设置');
    }
  }
}

testAPI();

