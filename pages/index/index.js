const config = require('../../utils/config');

Page({
  data: {
    isLogin: false, // 登录状态，默认未登录
    username: null, // 用户名
    greeting: '你好', // 动态问候语
    isLoggingOut: false, // 是否正在退出登录
    forceUpdate: 0, // 用于强制更新视图
    // 轮播图数据
    swiperList: [],
    // 轮播图配置
    swiperConfig: {
      indicatorDots: true,
      autoplay: true,
      interval: 3000,
      duration: 1000,
      circular: true,
      previousMargin: '20rpx',
      nextMargin: '20rpx'
    }
  },

  // 获取动态问候语
  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
  },

  onLoad() {
    // 页面加载时检查登录状态
    this.checkLoginStatus();
    // 初始化轮播图数据
    this.initSwiperList();
  },
  
  // 初始化轮播图数据
  initSwiperList() {
    // 只使用没有被忽略的图片，减少代码包大小
    this.setData({
      swiperList: [
        { id: 1, image: '/images/1.jpg', tag: '时尚单品' },
        { id: 2, image: '/images/2.jpg', tag: '潮流穿搭' },
        { id: 3, image: '/images/3.jpg', tag: '新品推荐' },
        { id: 4, image: '/images/4.png', tag: '夏季穿搭' },
        { id: 5, image: '/images/5.png', tag: '秋季新款' },
        { id: 6, image: '/images/6.png', tag: '冬季保暖' },
        { id: 7, image: '/images/7.png', tag: '春季焕新' }
      ]
    });
  },
  
  // 轮播图点击事件
  onClothingTap(e) {
    const clothingId = e.currentTarget.dataset.id;
    // 跳转到挑选服装页面
    wx.navigateTo({
      url: `/pages/clothes-selection/clothes-selection?clothingId=${clothingId}`
    });
  },

  onShow() {
    // 页面显示时再次检查登录状态（从登录页返回时）
    this.checkLoginStatus();

    // 如果已登录，刷新用户信息和问候语
    if (this.data.isLogin) {
      const username = wx.getStorageSync('username');
      this.setData({
        username: username,
        greeting: this.getGreeting()
      });
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const username = wx.getStorageSync('username');
    
    if (token && username) {
      this.setData({
        isLogin: true,
        username: username,
        greeting: this.getGreeting()
      });
    } else {
      this.setData({
        isLogin: false,
        username: null
      });
    }
  },

  // 通用登录检查函数
  checkLoginAndNavigate() {
    if (!this.data.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录或注册',
        showCancel: true,
        cancelText: '取消',
        confirmText: '立即登录',
        confirmColor: '#ff6bb5',
        cancelColor: '#999',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return false;
    }
    return true;
  },

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  // 退出登录
  logout() {
    // 防止重复点击
    if (this.data.isLoggingOut) {
      return;
    }

    // 自定义弹窗样式
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      showCancel: true,
      cancelText: '取消',
      confirmText: '退出',
      confirmColor: '#ff6bb5', // 粉色确认按钮
      cancelColor: '#999',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isLoggingOut: true
          });

          // 显示退出中状态
          wx.showLoading({
            title: '退出中...',
            mask: true
          });

          // 模拟退出过程（实际应用中可能需要调用API）
          setTimeout(() => {
            // 清除登录状态
            wx.removeStorageSync('token');
            wx.removeStorageSync('username');
            wx.removeStorageSync('savedUsername');
            wx.removeStorageSync('savedPassword');

            // 更新登录状态
            this.setData({
              isLogin: false,
              username: null,
              isLoggingOut: false
            });

            wx.hideLoading();
            wx.showToast({
              title: '退出成功',
              icon: 'success',
              duration: 1500
            });
          }, 1000);
        }
      }
    });
  },

  // 显示登录/注册提示
  goToLogin() {
    wx.showModal({
      title: '请先登录或注册',
      content: '登录后可使用更多功能',
      showCancel: true,
      cancelText: '取消',
      confirmText: '立即登录',
      confirmColor: '#ff6bb5',
      cancelColor: '#999',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  // 跳转到AI助手页面
  goToChatWithModel() {
    this.openFeature('/pages/chat-with-model/chat-with-model');
  },
  
  // 跳转到穿搭顾问页面
  goToClothesAdvisor() {
    this.openFeature('/pages/clothes-advisor/clothes-advisor');
  },

  // 跳转到存储调试页面
  goToDebugStorage() {
    wx.navigateTo({
      url: '/pages/debug-storage/debug-storage'
    });
  },

  // 跳转到穿搭建议页面
  goToFashionAdvice() {
    this.openFeature('/pages/fashion-advice/fashion-advice');
  },

  // 跳转到随手拍试穿页面
  goToPhotoTry() {
    this.openFeature('/pages/photo-try/photo-try');
  },

  // 跳转到我的收藏页面
  goToCollection() {
    this.openFeature('/pages/collection/collection');
  },

  // 跳转到关于我们页面
  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },



  // 跳转到AI识图页面
  goToAiRecognition() {
    this.openFeature('/pages/ai-recognition/ai-recognition');
  },

  // 跳转到虚拟换衣页面
  goToVirtualTry() {
    if (this.checkLoginAndNavigate()) {
      const virtualTryUrl = (config.serverConfig && config.serverConfig.virtualTryUrl) ? config.serverConfig.virtualTryUrl : '';
      if (!virtualTryUrl) {
        wx.navigateTo({ url: '/pages/web-view/web-view' });
        return;
      }
      wx.navigateTo({
        url: `/pages/web-view/web-view?url=${encodeURIComponent(virtualTryUrl)}`
      });
    }
  },

  // 跳转到挑选服装页面
  goToClothesSelection() {
    this.openFeature('/pages/clothes-selection/clothes-selection');
  },

  // 跳转到抠图页面
  goToCutout() {
    this.openFeature('/pages/cutout/cutout');
  },

  // 跳转到其他页面
  goToOther() {
    wx.navigateTo({
      url: '/pages/other/other'
    });
  },

  // 跳转到搭配展示页面
  goToOutfitShowcase() {
    this.openFeature('/pages/outfit-showcase/outfit-showcase');
  },

  openFeature(url) {
    if (!this.checkLoginAndNavigate()) return;
    wx.navigateTo({ url });
  },
  
  onChatButtonClick() {
    console.log('聊天按钮点击');
  },
  
  onAvatarButtonClick() {
    console.log('院团头像按钮点击');
    // 跳转到穿搭顾问页面的逻辑已在组件内部实现
    // 这里保留以便于未来可能的扩展
  },


})
    
