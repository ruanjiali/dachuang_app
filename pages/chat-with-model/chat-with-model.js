// 对话页面逻辑
// 引入配置文件
const config = require('../../utils/config.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    messages: [
      {
        id: 1,
        content: '你好，我是你的AI助手，请问有什么可以帮助你的？',
        type: 'ai'
      }
    ],
    inputText: '',
    isLoading: false,
    scrollToMessage: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    this.checkNetworkStatus();
    const enabled = !!(config.apiConfig && config.apiConfig.enableDirectApi && config.deepseekApiKey);
    if (!enabled) {
      wx.showToast({
        title: '当前为离线模式（真机建议使用）',
        icon: 'none',
        duration: 2500
      });
    }
  },
  
  /**
   * 检查网络状态
   */
  checkNetworkStatus: function() {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        console.log('网络类型:', networkType);
        if (networkType === 'none') {
          wx.showToast({
            title: '当前无网络连接',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取网络状态失败:', err);
      }
    });
  },

  /**
   * 处理输入框内容变化
   */
  onInputChange: function (e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  /**
   * 发送消息
   */
  sendMessage: function () {
    const { inputText, isLoading } = this.data;
    
    console.log('尝试发送消息:', {
      inputText: inputText || '空',
      isLoading: isLoading
    });
    
    if (isLoading) {
      console.log('发送消息被阻止：正在加载中');
      return;
    }
    
    if (!inputText.trim()) {
      console.log('发送消息被阻止：输入内容为空');
      return;
    }
    
    const enabled = !!(config.apiConfig && config.apiConfig.enableDirectApi && config.deepseekApiKey);
    
    console.log('准备发送消息到AI');
    
    // 添加用户消息到列表
    const userMessage = {
      id: Date.now(),
      content: inputText.trim(),
      type: 'user'
    };
    
    const messages = [...this.data.messages, userMessage];
    
    this.setData({
      messages,
      inputText: '',
      isLoading: true,
      scrollToMessage: `message-${userMessage.id}`
    }, () => {
      if (!enabled) {
        const reply = this.getOfflineReply(inputText.trim());
        const aiMessage = {
          id: Date.now(),
          content: reply,
          type: 'ai'
        };
        this.setData({
          messages: [...this.data.messages, aiMessage],
          isLoading: false,
          scrollToMessage: `message-${aiMessage.id}`
        }, () => {
          this.scrollToBottom();
        });
        return;
      }
      this.callDeepSeekApi(inputText.trim());
    });
  },

  getOfflineReply: function (prompt) {
    const tips = [
      '当前离线模式会给出规则建议。',
      '如需真机调用大模型，建议走你自己的后端转发，避免在小程序端暴露密钥。',
      '也可以在小程序后台配置合法域名并开启直连开关（仅自用调试）。'
    ];
    if (/穿搭|衣服|搭配|风格|场合|温度|天气/.test(prompt)) {
      return `收到：${prompt}\n\n建议：\n1) 先确认场景与温度（通勤/约会/日常）。\n2) 选择一个主色+一个点缀色，鞋包用中性色收敛。\n3) 上松下紧或上紧下松，保证比例。\n\n${tips.join('\n')}`;
    }
    return `收到：${prompt}\n\n${tips.join('\n')}`;
  },

  /**
   * 调用DeepSeek API
   */
  callDeepSeekApi: function (prompt) {
    const { messages } = this.data;
    const enabled = !!(config.apiConfig && config.apiConfig.enableDirectApi && config.deepseekApiKey);
    if (!enabled) {
      this.handleApiError('离线模式未启用直连');
      return;
    }
    
    // 检查API配置是否存在
    if (!config.apiConfig || !config.apiConfig.endpoint) {
      console.error('API配置不完整:', config.apiConfig);
      this.handleApiError('API配置不完整，请检查utils/config.local.js');
      return;
    }
    
    // 构建消息历史
    const messageHistory = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    console.log('发送到API的消息历史:', messageHistory);
    
    wx.request({
      url: config.apiConfig.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseekApiKey}`
      },
      data: {
        model: config.apiConfig.model || 'deepseek-chat',
        messages: messageHistory,
        max_tokens: config.apiConfig.maxTokens || 8000,
        temperature: config.apiConfig.temperature || 0.7
      },
      success: (res) => {
        console.log('API调用成功，状态码:', res.statusCode);
        console.log('API返回数据:', res.data);
        
        // 检查响应状态
        if (res.statusCode === 200 && res.data && res.data.choices && res.data.choices.length > 0) {
          // 获取AI的回复
          const aiMessage = {
            id: Date.now(),
            content: res.data.choices[0].message.content,
            type: 'ai'
          };
          
          const messages = [...this.data.messages, aiMessage];
          
          this.setData({
            messages,
            isLoading: false,
            scrollToMessage: `message-${aiMessage.id}`
          }, () => {
            // 滚动到底部
            this.scrollToBottom();
          });
        } else if (res.statusCode === 401) {
          // 特别处理401未授权错误
          console.error('API授权失败:', res);
          this.handleApiError('401授权失败：API密钥无效或已过期');
        } else {
          console.error('API返回数据格式错误:', res);
          this.handleApiError(`API错误: 状态码${res.statusCode}`);
        }
      },
      fail: (err) => {
        console.error('DeepSeek API 调用失败:', err);
        this.handleApiError(`网络错误: ${err.errMsg || '未知错误'}，请稍后重试`);
      },
      complete: () => {
        console.log('API调用完成');
      }
    });
  },

  /**
   * 处理API错误
   */
  handleApiError: function (errorMessage) {
    console.error('API调用错误:', errorMessage);
    
    // 根据不同错误类型显示不同的提示
    if (errorMessage && errorMessage.includes('401')) {
      wx.showModal({
        title: '授权失败',
        content: 'DeepSeek API密钥无效或已过期。请获取有效的API密钥，并更新到utils/config.local.js文件中。',
        showCancel: false,
        confirmText: '知道了'
      });
    } else if (errorMessage && errorMessage.includes('网络')) {
      wx.showToast({
        title: '网络连接失败，请检查网络设置',
        icon: 'none'
      });
    } else {
      wx.showToast({
        title: errorMessage || 'API调用失败，请稍后重试',
        icon: 'none'
      });
    }
    
    this.setData({
      isLoading: false
    });
  },

  /**
   * 滚动到底部
   */
  scrollToBottom: function () {
    const query = wx.createSelectorQuery();
    query.select('#chat-container').boundingClientRect();
    query.select('#scroll-view').boundingClientRect();
    query.exec((res) => {
      if (res && res[0] && res[1]) {
        const scrollHeight = res[0].height;
        wx.createSelectorQuery().select('#scroll-view').context((context) => {
          // 添加安全检查，防止context.context为undefined
          if (context && context.context) {
            context.context.scrollTo({ scrollTop: scrollHeight, duration: 300 });
          }
        }).exec();
      }
    });
  },

  onScrollToUpper: function () {},

  /**
   * 清除聊天历史
   */
  clearHistory: function () {
    wx.showModal({
      title: '清除对话',
      content: '确定清除所有聊天记录吗？',
      cancelText: '取消',
      confirmText: '清除',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          const initialMessage = {
            id: Date.now(),
            content: '你好，我是你的AI助手，请问有什么可以帮助你的？',
            type: 'ai'
          };
          this.setData({
            messages: [initialMessage],
            inputText: '',
            isLoading: false,
            scrollToMessage: ''
          });
          wx.showToast({
            title: '已清除对话',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 返回上一页
   */
  onBackPress: function () {
    // 确保页面可以正确返回
    try {
      wx.navigateBack();
    } catch (error) {
      console.error('返回页面失败:', error);
      // 如果返回失败，尝试跳转到首页
      // 使用redirectTo替代switchTab，因为没有配置tabBar
      wx.redirectTo({
        url: '/pages/index/index'
      });
    }
  }
});
