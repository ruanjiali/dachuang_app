module.exports = {
  deepseekApiKey: 'YOUR_DEEPSEEK_API_KEY',
  apiConfig: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 5000,
    temperature: 0.7
  },
  serverConfig: {
    baseUrl: 'https://your-backend.example.com',
    miniCutoutUrl: '/api/mini/remove-bg',
    virtualTryUrl: 'https://your-virtual-try.example.com'
  }
};
