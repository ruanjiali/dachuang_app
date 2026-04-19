const config = require('../../utils/config');

Page({
  data: {
    url: '',
    pageTitle: '虚拟换衣' // 默认页面标题
  },

  onLoad(options) {
    const fromQuery = options && options.url ? decodeURIComponent(options.url) : '';
    const fromConfig = (config.serverConfig && config.serverConfig.virtualTryUrl) ? config.serverConfig.virtualTryUrl : '';
    const url = fromQuery || fromConfig;
    if (!url) {
      wx.showModal({
        title: '未配置虚拟试穿地址',
        content: '请在 config.local.js 配置 serverConfig.virtualTryUrl 后再试。',
        showCancel: false,
        success: () => {
          wx.navigateBack({ delta: 1 });
        }
      });
      return;
    }
    this.setData({ url });
    wx.setNavigationBarTitle({ title: this.data.pageTitle });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});
