// pages/outfit-showcase/outfit-showcase.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    outfitList: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadOutfitData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载数据，确保最新的搭配被显示
    this.loadOutfitData();
  },

  // 加载搭配数据
  loadOutfitData() {
    const outfits = wx.getStorageSync('outfits') || [];
    this.setData({
      outfitList: outfits
    });
  },

  // 查看搭配详情
  viewOutfitDetail(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '搭配详情',
      content: `描述: ${item.description}\n\n发布时间: ${item.time}\n\n点赞数: ${item.likes || 0}`,
      showCancel: false,
      confirmText: '查看图片',
      confirmColor: '#ff6bb5',
      success: (res) => {
        if (res.confirm) {
          wx.previewImage({
            current: item.images[0],
            urls: item.images
          });
        }
      }
    });
  },

  // 删除搭配
  deleteOutfit(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '删除确认',
      content: '确定要删除这个搭配吗？',
      cancelText: '取消',
      confirmText: '删除',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          const outfitList = [...this.data.outfitList];
          outfitList.splice(index, 1);
          wx.setStorageSync('outfits', outfitList);
          this.setData({ outfitList });
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 跳转到上传搭配页面
  goToUpload() {
    wx.navigateTo({
      url: '/pages/upload-outfit/upload-outfit'
    });
  },

  /**
   * 分享功能
   */
  onShareAppMessage() {
    return {
      title: 'AI智能穿搭魔法师 - 我的搭配',
      path: '/pages/outfit-showcase/outfit-showcase'
    };
  }
});