Page({
  data: {
    // 页面数据
  },

  onLoad() {
    // 页面加载时的初始化
    this.initPage();
  },

  initPage() {
    // 可以在这里添加页面初始化逻辑
    console.log('关于我们页面加载完成');
  },

  // 分享应用
  shareApp() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  // 返回首页
  goBackHome() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: 'AI智能穿搭魔法师 - 让每个人都能找到属于自己的时尚风格',
      path: '/pages/index/index',
      imageUrl: '/images/logo.png'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: 'AI智能穿搭魔法师 - 智能穿搭助手',
      imageUrl: '/images/logo.png'
    };
  }
});