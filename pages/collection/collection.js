Page({
  data: {
    activeTab: 'clothes',
    collectedClothesRaw: [],
    collectedClothes: [],
    collectedAdviceRaw: [],
    collectedAdvice: [],
    clothesCount: 0,
    adviceCount: 0,
    hasCollections: false,
    keyword: '',
    sortType: 'newest',
    adviceSortType: 'newest'
  },

  onLoad() {
    this.loadCollectionData();
  },

  onShow() {
    this.loadCollectionData();
  },

  onUnload() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  },

  loadCollectionData() {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    const userAdviceKey = `savedAdvices_${username}`;
    const clothes = wx.getStorageSync(userCollectedKey) || [];
    const advice = wx.getStorageSync(userAdviceKey) || [];
    const normalizedClothes = (Array.isArray(clothes) ? clothes : []).map(item => ({
      ...item,
      id: Number(item.id),
      price: Number(item.price || 99),
      createTime: item.createTime || item.addTime || ''
    }));
    const normalizedAdvice = Array.isArray(advice) ? advice : [];
    this.setData({
      collectedClothesRaw: normalizedClothes,
      collectedAdviceRaw: normalizedAdvice,
      clothesCount: normalizedClothes.length,
      adviceCount: normalizedAdvice.length,
      hasCollections: normalizedClothes.length > 0 || normalizedAdvice.length > 0
    });
    this.applyFilters();
  },

  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.tab || 'clothes',
      keyword: ''
    });
    this.applyFilters();
  },

  onSearchInput(e) {
    const keyword = e.detail.value || '';
    this.setData({
      keyword
    });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.applyFilters();
    }, 120);
  },

  onSortChange(e) {
    this.setData({
      sortType: e.currentTarget.dataset.sort || 'newest'
    });
    this.applyFilters();
  },

  onAdviceSortChange(e) {
    this.setData({
      adviceSortType: e.currentTarget.dataset.sort || 'newest'
    });
    this.applyFilters();
  },

  applyFilters() {
    const keyword = (this.data.keyword || '').trim().toLowerCase();
    const clothesList = this.sortClothes(this.filterClothes(keyword));
    const adviceList = this.sortAdvice(this.filterAdvice(keyword));
    this.setData({
      collectedClothes: clothesList,
      collectedAdvice: adviceList
    });
  },

  filterClothes(keyword) {
    const list = [...this.data.collectedClothesRaw];
    if (!keyword) return list;
    return list.filter(item =>
      String(item.name || '').toLowerCase().includes(keyword) ||
      String(item.category || '').toLowerCase().includes(keyword) ||
      String(item.style || '').toLowerCase().includes(keyword) ||
      String(item.season || '').toLowerCase().includes(keyword)
    );
  },

  filterAdvice(keyword) {
    const list = [...this.data.collectedAdviceRaw];
    if (!keyword) return list;
    return list.filter(item =>
      String(item.style || '').toLowerCase().includes(keyword) ||
      String(item.scene || '').toLowerCase().includes(keyword) ||
      String((item.advice && item.advice.advice) || '').toLowerCase().includes(keyword)
    );
  },

  sortClothes(list) {
    const sorted = [...list];
    if (this.data.sortType === 'priceHigh') {
      return sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    if (this.data.sortType === 'priceLow') {
      return sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    return sorted.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  },

  sortAdvice(list) {
    const sorted = [...list];
    if (this.data.adviceSortType === 'style') {
      return sorted.sort((a, b) => String(a.style || '').localeCompare(String(b.style || ''), 'zh'));
    }
    return sorted.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  },

  removeFromCollection(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认移除',
      content: `确定移除“${item.name}”吗？`,
      success: (res) => {
        if (!res.confirm) return;
        this.removeClothesFromCollection(item);
      }
    });
  },

  removeClothesFromCollection(item) {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    const current = (wx.getStorageSync(userCollectedKey) || []).filter(cloth => Number(cloth.id) !== Number(item.id));
    wx.setStorageSync(userCollectedKey, current);
    const app = getApp();
    if (app.globalData && Array.isArray(app.globalData.clothesList)) {
      app.globalData.clothesList = app.globalData.clothesList.map(cloth => {
        if (Number(cloth.id) !== Number(item.id)) return cloth;
        const userCollections = cloth.userCollections || {};
        userCollections[username] = false;
        return {
          ...cloth,
          userCollections,
          isCollected: false
        };
      });
      wx.setStorageSync('clothesList', app.globalData.clothesList);
    }
    this.loadCollectionData();
    wx.showToast({ title: '已移除', icon: 'success' });
  },

  removeAdvice(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认移除',
      content: '确定移除这条建议吗？',
      success: (res) => {
        if (!res.confirm) return;
        this.removeAdviceFromCollection(item);
      }
    });
  },

  removeAdviceFromCollection(item) {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userAdviceKey = `savedAdvices_${username}`;
    const saved = (wx.getStorageSync(userAdviceKey) || []).filter(advice => Number(advice.id) !== Number(item.id));
    wx.setStorageSync(userAdviceKey, saved);
    this.loadCollectionData();
    wx.showToast({ title: '已移除', icon: 'success' });
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '将清空当前账号的所有收藏，确认继续吗？',
      success: (res) => {
        if (!res.confirm) return;
        this.clearAllCollections();
      }
    });
  },

  clearAllCollections() {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    const userAdviceKey = `savedAdvices_${username}`;
    wx.removeStorageSync(userCollectedKey);
    wx.removeStorageSync(userAdviceKey);
    const app = getApp();
    if (app.globalData && Array.isArray(app.globalData.clothesList)) {
      app.globalData.clothesList = app.globalData.clothesList.map(item => {
        const userCollections = item.userCollections || {};
        userCollections[username] = false;
        return {
          ...item,
          userCollections,
          isCollected: false
        };
      });
      wx.setStorageSync('clothesList', app.globalData.clothesList);
    }
    this.loadCollectionData();
    wx.showToast({ title: '已清空收藏', icon: 'success' });
  },

  viewClothesDetail(e) {
    const item = e.currentTarget.dataset.item;
    // 跳转到挑选服装页面，并高亮对应服装
    wx.navigateTo({
      url: `/pages/clothes-selection/clothes-selection?clothingId=${item.id}`,
      fail: () => {
        // 跳转失败时退化为图片预览
        if (item.image) {
          wx.previewImage({
            current: item.image,
            urls: this.data.collectedClothes.map(cloth => cloth.image).filter(Boolean)
          });
        }
      }
    });
  },

  viewAdviceDetail(e) {
    const item = e.currentTarget.dataset.item;
    const adviceText = (item.advice && item.advice.advice) || '暂无建议详情';
    const items = (item.advice && Array.isArray(item.advice.items)) ? item.advice.items : null;
    const tips = (item.advice && Array.isArray(item.advice.tips)) ? item.advice.tips : [];

    // 构建完整内容
    let content = `【风格】${item.style || '未知'}\n【场景】${item.scene || '未知'}\n【时间】${item.createTime || '未知'}\n\n`;
    content += `【穿搭建议】\n${adviceText}\n\n`;

    if (items && items.length > 0) {
      content += `【推荐单品】\n`;
      items.forEach((it, i) => {
        const name = it.name || it;
        const category = it.category || '';
        content += `${i + 1}. ${name}${category ? ` (${category})` : ''}\n`;
      });
      content += '\n';
    }

    if (tips && tips.length > 0) {
      content += `【穿搭小贴士】\n`;
      tips.forEach((tip, i) => {
        content += `• ${tip}\n`;
      });
    }

    wx.showModal({
      title: `${item.style || '穿搭建议'} · ${item.scene || ''}`,
      content: content,
      showCancel: true,
      cancelText: '关闭',
      confirmText: '重新获取',
      confirmColor: '#ff6bb5',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/fashion-advice/fashion-advice'
          });
        }
      }
    });
  },

  goToHome() {
    wx.navigateBack({ delta: 1 });
  },

  goToFashionAdvice() {
    wx.navigateTo({
      url: '/pages/fashion-advice/fashion-advice'
    });
  },

  goBackHome() {
    wx.navigateBack({ delta: 1 });
  }
});
