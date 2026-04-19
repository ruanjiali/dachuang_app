const baseConfig = {
  deepseekApiKey: '',
  apiConfig: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 5000,
    temperature: 0.7,
    enableDirectApi: false
  },
  serverConfig: {
    baseUrl: '',
    aiRecognitionUrl: '/api/mini/recognize-clothes',
    miniCutoutUrl: '/api/mini/remove-bg',
    miniCutoutJsonUrl: '',
    miniCutoutResultUrl: '/api/mini/remove-bg/result',
    miniCutoutPollIntervalMs: 1500,
    miniCutoutPollTimeoutMs: 40000,
    cutoutWebUrl: '',
    virtualTryUrl: ''
  }
};

let localConfig = {};
try {
  localConfig = require('./config.local');
} catch (e) {
  localConfig = {};
}

module.exports = {
  ...baseConfig,
  ...localConfig,
  apiConfig: {
    ...baseConfig.apiConfig,
    ...(localConfig.apiConfig || {})
  },
  serverConfig: {
    ...baseConfig.serverConfig,
    ...(localConfig.serverConfig || {})
  }
};
