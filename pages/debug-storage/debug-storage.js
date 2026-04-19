// pages/debug-storage/debug-storage.js
Page({
  data: {
    storageData: '',
    clothesList: [],
    lastNetworkFail: null,
    lastAppError: null
  },

  onLoad: function() {
    this.readStorageData();
  },

  // 读取本地存储数据
  readStorageData: function() {
    try {
      // 获取本地存储中的所有键
      const storageInfo = wx.getStorageInfoSync();
      console.log('本地存储信息:', storageInfo);
      
      // 读取clothesList数据
      const clothesList = wx.getStorageSync('clothesList') || [];
      console.log('clothesList:', clothesList);

      const lastNetworkFail = wx.getStorageSync('lastNetworkFail') || null;
      const lastAppError = wx.getStorageSync('lastAppError') || null;
      
      // 检查是否有包含'服装16'的条目
      const problematicItems = clothesList.filter(item => {
        return item.image && item.image.includes('服装16');
      });
      
      console.log('包含"服装16"的条目:', problematicItems);
      
      this.setData({
        storageData: JSON.stringify({ storageInfo, lastNetworkFail, lastAppError }, null, 2),
        clothesList: clothesList,
        lastNetworkFail,
        lastAppError
      });
    } catch (error) {
      console.error('读取本地存储失败:', error);
      wx.showToast({
        title: '读取失败',
        icon: 'none'
      });
    }
  },

  // 清除包含'服装16'的条目
  clearProblematicItems: function() {
    try {
      let clothesList = wx.getStorageSync('clothesList') || [];
      
      // 过滤掉包含'服装16'的条目
      const filteredList = clothesList.filter(item => {
        return !(item.image && item.image.includes('服装16'));
      });
      
      // 更新本地存储
      wx.setStorageSync('clothesList', filteredList);
      
      // 更新全局数据
      const app = getApp();
      if (app.globalData) {
        app.globalData.clothesList = filteredList;
      }
      
      this.setData({
        clothesList: filteredList
      });
      
      wx.showToast({
        title: '清理成功',
        icon: 'success'
      });
      
      console.log('清理后的clothesList:', filteredList);
    } catch (error) {
      console.error('清理失败:', error);
      wx.showToast({
        title: '清理失败',
        icon: 'none'
      });
    }
  },

  // 清除所有本地存储
  clearAllStorage: function() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地存储数据吗？这将删除所有保存的服装数据。',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync();
            
            // 重置全局数据
            const app = getApp();
            if (app.globalData) {
              app.globalData.clothesList = [
                { id: 1, name: '连衣裙', image: '/images/dress.jpg', category: '女装', season: '夏季', style: '优雅', isCollected: false },
                { id: 2, name: '夹克', image: '/images/jacket.jpg', category: '外套', season: '春秋', style: '休闲', isCollected: false },
                { id: 3, name: '衬衫', image: '/images/shirt.jpg', category: '上衣', season: '四季', style: '正式', isCollected: false },
                { id: 4, name: '毛衣', image: '/images/sweater.jpg', category: '上衣', season: '冬季', style: '保暖', isCollected: false },
                { id: 5, name: '卫衣', image: '/images/sweatshirt.jpg', category: '上衣', season: '春秋', style: '休闲', isCollected: false },
                { id: 6, name: 'T恤', image: '/images/T-shirt.jpg', category: '上衣', season: '夏季', style: '舒适', isCollected: false }
              ];
            }
            
            this.setData({
              storageData: '',
              clothesList: []
            });
            
            wx.showToast({
              title: '清除成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('清除失败:', error);
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
