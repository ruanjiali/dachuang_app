Page({
  data: {
    fashionStyles: [
      {
        id: 1,
        name: '休闲风格',
        icon: '/images/T-shirt.jpg',
        description: '舒适随性，适合日常穿着'
      },
      {
        id: 2,
        name: '商务风格',
        icon: '/images/shirt.jpg',
        description: '正式专业，适合职场场合'
      },
      {
        id: 3,
        name: '运动风格',
        icon: '/images/sweatshirt.jpg',
        description: '活力四射，适合运动健身'
      },
      {
        id: 4,
        name: '复古风格',
        icon: '/images/jacket.jpg',
        description: '经典怀旧，展现独特魅力'
      },
      {
        id: 5,
        name: '街头风格',
        icon: '/images/sweater.jpg',
        description: '潮流前卫，彰显个性态度'
      },
      {
        id: 6,
        name: '甜美风格',
        icon: '/images/dress.jpg',
        description: '温柔可爱，适合约会场合'
      }
    ],
    scenes: [
      { id: 1, name: '日常通勤' },
      { id: 2, name: '商务会议' },
      { id: 3, name: '约会聚会' },
      { id: 4, name: '运动健身' },
      { id: 5, name: '休闲逛街' },
      { id: 6, name: '正式晚宴' }
    ],
    selectedStyle: null,
    selectedScene: null,
    adviceResult: null,
    isLoading: false
  },

  onLoad() {
    // 页面加载时的初始化
    this.initPage();
  },

  initPage() {
    // 可以在这里添加页面初始化逻辑
    console.log('穿搭建议页面加载完成');
  },

  // 选择风格
  selectStyle(e) {
    const styleId = Number(e.currentTarget.dataset.id);
    const selectedStyle = this.data.fashionStyles.find(style => style.id === styleId);
    if (!selectedStyle) return;
    
    this.setData({
      selectedStyle: selectedStyle,
      selectedScene: null, // 重置场景选择
      adviceResult: null // 重置建议结果
    });

    // 添加选择反馈（移除震动效果）
    this.showSelectionFeedback('已选择风格：' + selectedStyle.name);
  },

  // 选择场景
  selectScene(e) {
    const sceneId = Number(e.currentTarget.dataset.id);
    const selectedScene = this.data.scenes.find(scene => scene.id === sceneId);
    if (!selectedScene) return;

    this.setData({
      selectedScene: selectedScene
    });

    // 添加选择反馈（移除震动效果）
    this.showSelectionFeedback('已选择场景：' + selectedScene.name);

    // 自动滚动到获取建议按钮区域
    wx.pageScrollTo({
      selector: '.advice-result',
      duration: 300
    });
  },

  // 获取穿搭建议
  getFashionAdvice() {
    if (!this.data.selectedStyle || !this.data.selectedScene) {
      wx.showToast({
        title: '请先选择风格和场景',
        icon: 'none'
      });
      return;
    }

    this.setData({ isLoading: true });

    // 调用AI穿搭建议API
    this.callFashionAI()
      .then((advice) => {
        this.setData({
          adviceResult: advice,
          isLoading: false
        });

        // 滚动到结果区域
        wx.pageScrollTo({
          selector: '.advice-result',
          duration: 500
        });
      })
      .catch((error) => {
        console.error('AI穿搭建议失败:', error);
        // 降级使用本地规则
        const advice = this.generateFashionAdvice();
        this.setData({
          adviceResult: advice,
          isLoading: false
        });

        wx.pageScrollTo({
          selector: '.advice-result',
          duration: 500
        });

        wx.showToast({
          title: 'AI服务暂不可用，使用本地建议',
          icon: 'none',
          duration: 2000
        });
      });
  },

  // 调用AI穿搭建议
  callFashionAI() {
    return new Promise((resolve, reject) => {
      const config = require('../../utils/config');
      const baseUrl = (config.serverConfig && config.serverConfig.outfitMcpBaseUrl) || config.serverConfig.baseUrl || '';
      const apiUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/mini/fashion-advice` : '';

      if (!apiUrl) {
        // 没有配置后端，使用本地规则
        reject(new Error('NO_BACKEND_CONFIGURED'));
        return;
      }

      const { selectedStyle, selectedScene } = this.data;
      const username = wx.getStorageSync('username') || 'anonymous';

      wx.showLoading({ title: 'AI生成中...', mask: true });

      wx.request({
        url: apiUrl,
        method: 'POST',
        timeout: 60000,  // 增加超时时间到60秒
        header: { 'Content-Type': 'application/json' },
        data: {
          style: selectedStyle.name,
          scene: selectedScene.name,
          username: username
        },
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200 && res.data && res.data.success) {
            const advice = {
              advice: res.data.advice || this.getAdviceText(selectedStyle.name, selectedScene.name),
              items: res.data.items || this.getRecommendedItems(selectedStyle.name, selectedScene.name),
              tips: res.data.tips || this.getFashionTips(selectedStyle.name, selectedScene.name)
            };
            resolve(advice);
          } else {
            reject(new Error('API_RETURN_ERROR'));
          }
        },
        fail: (err) => {
          wx.hideLoading();
          if (err.errMsg && err.errMsg.includes('timeout')) {
            reject(new Error('API_TIMEOUT'));
          } else {
            reject(new Error('API_NETWORK_ERROR'));
          }
        }
      });
    });
  },

  // 生成穿搭建议（模拟AI）
  generateFashionAdvice() {
    const { selectedStyle, selectedScene } = this.data;
    
    // 根据风格和场景生成建议
    const adviceData = {
      advice: this.getAdviceText(selectedStyle.name, selectedScene.name),
      items: this.getRecommendedItems(selectedStyle.name, selectedScene.name),
      tips: this.getFashionTips(selectedStyle.name, selectedScene.name)
    };

    return adviceData;
  },

  // 获取建议文本
  getAdviceText(style, scene) {
    const adviceMap = {
      '休闲风格': {
        '日常通勤': '建议选择舒适的棉质T恤搭配直筒牛仔裤，外搭一件轻薄的针织开衫，既舒适又得体。',
        '休闲逛街': '可以选择宽松的卫衣搭配运动裤，或者简单的T恤配牛仔裤，舒适自在。',
        '约会聚会': '选择有设计感的休闲衬衫搭配休闲裤，既不会太随意又保持舒适。'
      },
      '商务风格': {
        '商务会议': '建议选择深色西装套装，搭配白色衬衫和深色领带，展现专业形象。',
        '日常通勤': '可以选择商务休闲风格，如衬衫配西裤，外搭一件针织衫。',
        '正式晚宴': '选择深色西装或礼服，搭配精致的配饰，展现优雅气质。'
      }
    };

    return adviceMap[style]?.[scene] || 
           `对于${style}在${scene}场合，建议选择符合场合要求的服装，保持整体协调性。`;
  },

  // 获取推荐单品
  getRecommendedItems(style, scene) {
    const app = getApp();
    const allClothes = Array.isArray(app.globalData && app.globalData.clothesList) ? app.globalData.clothesList : [];
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    const collectedClothes = wx.getStorageSync(userCollectedKey) || [];
    const collectedIds = new Set(Array.isArray(collectedClothes) ? collectedClothes.map(item => Number(item.id)) : []);
    
    // 根据风格筛选
    let filteredItems = allClothes.filter(item => item.category === style.replace('风格', ''));
    
    // 如果筛选结果不足，添加一些通用推荐
    if (filteredItems.length < 3) {
      filteredItems = allClothes.slice(0, 3);
    }

    return filteredItems.slice(0, 3).map(item => ({
      ...item,
      price: item.price || 99,
      hasCollected: !!(item.userCollections && item.userCollections[username]) || collectedIds.has(Number(item.id))
    }));
  },

  // 获取搭配小贴士
  getFashionTips(style, scene) {
    const tipsMap = {
      '休闲风格': [
        '注意色彩搭配的协调性',
        '选择舒适的面料材质',
        '可以适当添加配饰提升整体感'
      ],
      '商务风格': [
        '保持服装的整洁和熨烫',
        '注意细节如纽扣、领带等',
        '选择经典款式避免过于花哨'
      ]
    };

    return tipsMap[style] || [
      '注意整体搭配的协调性',
      '选择适合场合的服装',
      '保持个人风格的独特性'
    ];
  },

  // 收藏/取消收藏
  toggleCollect(e) {
    const item = e.currentTarget.dataset.item;
    const app = getApp();
    const username = wx.getStorageSync('username') || 'anonymous';
    
    // 更新收藏状态
    const clothesList = app.globalData.clothesList;
    const targetItem = clothesList.find(cloth => Number(cloth.id) === Number(item.id));
    
    if (targetItem) {
      // 确保userCollections对象存在
      if (!targetItem.userCollections) {
        targetItem.userCollections = {};
      }
      
      // 获取当前用户的收藏状态并切换
      const currentState = targetItem.userCollections[username] || false;
      const newState = !currentState;
      targetItem.userCollections[username] = newState;
      
      app.globalData.clothesList = clothesList;
      
      // 更新页面数据
      const adviceResult = { ...this.data.adviceResult };
      const targetItemInResult = adviceResult.items.find(cloth => Number(cloth.id) === Number(item.id));
      if (targetItemInResult) {
        // 确保userCollections对象存在
        if (!targetItemInResult.userCollections) {
          targetItemInResult.userCollections = {};
        }
        targetItemInResult.userCollections[username] = newState;
        // 为渲染添加hasLiked字段（基于当前用户）
        targetItemInResult.hasCollected = newState;
      }
      
      this.setData({ adviceResult });
      
      // 显示反馈
      wx.showToast({
        title: newState ? '已收藏' : '已取消收藏',
        icon: 'success'
      });
      
      // 更新本地存储
      const userCollectedKey = `collectedClothes_${username}`;
      let collectedClothes = wx.getStorageSync(userCollectedKey) || [];
      
      if (newState) {
        // 添加收藏 - 确保只添加一次
        if (!collectedClothes.some(collectedItem => Number(collectedItem.id) === Number(item.id))) {
          collectedClothes.push({
            ...targetItem,
            userCollections: targetItem.userCollections
          });
        }
      } else {
        // 取消收藏
        collectedClothes = collectedClothes.filter(collectedItem => Number(collectedItem.id) !== Number(item.id));
      }
      
      wx.setStorageSync(userCollectedKey, collectedClothes);
    }
  },

  // 保存建议
  saveAdvice() {
    const { selectedStyle, selectedScene, adviceResult } = this.data;
    const username = wx.getStorageSync('username') || 'anonymous';
    const userAdviceKey = `savedAdvices_${username}`;
    
    // 保存到本地存储
    const savedAdvice = {
      id: Date.now(),
      style: selectedStyle.name,
      scene: selectedScene.name,
      advice: adviceResult,
      createTime: new Date().toLocaleString()
    };

    let savedAdvices = wx.getStorageSync(userAdviceKey) || [];
    savedAdvices.unshift(savedAdvice);
    wx.setStorageSync(userAdviceKey, savedAdvices);

    wx.showToast({
      title: '建议已保存',
      icon: 'success'
    });
  },

  // 返回首页
  goBackHome() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 显示选择反馈
  showSelectionFeedback(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 1500
    });
  }
});
