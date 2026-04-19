Page({
  data: {
    allClothes: [],
    clothesList: [],
    currentCategory: '全部',
    categories: ['全部', '休闲', '商务', '运动', '复古', '街头', '甜美'],
    searchKeyword: '',
    totalCount: 0,
    filteredCount: 0,
    removeMode: false
  },

  onLoad() {
    this.loadClothesData();
  },

  onShow() {
    this.loadClothesData();
  },

  onUnload() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  },

  getDefaultClothes() {
    return [
      { id: 101, name: '经典白T', category: '休闲', image: '/images/casual-tee-01.jpg', season: '四季', style: '简约', price: 79 },
      { id: 102, name: '廓形牛仔夹克', category: '街头', image: '/images/street-jacket-01.jpg', season: '春秋', style: '潮流', price: 219 },
      { id: 103, name: '轻商务衬衫', category: '商务', image: '/images/business-shirt-01.jpg', season: '四季', style: '通勤', price: 139 },
      { id: 104, name: '连帽运动卫衣', category: '运动', image: '/images/sport-hoodie-01.jpg', season: '秋冬', style: '活力', price: 169 },
      { id: 105, name: '针织圆领毛衣', category: '复古', image: '/images/retro-knit-01.jpg', season: '秋冬', style: '文艺', price: 159 },
      { id: 106, name: '法式连衣裙', category: '甜美', image: '/images/sweet-dress-01.jpg', season: '夏季', style: '优雅', price: 209 },
      { id: 107, name: '工装风夹克', category: '街头', image: '/images/street-jacket-02.jpg', season: '春秋', style: '机能', price: 229 },
      { id: 108, name: '高弹商务衬衫', category: '商务', image: '/images/business-shirt-02.jpg', season: '四季', style: '正式', price: 149 },
      { id: 109, name: '速干运动T恤', category: '运动', image: '/images/sport-hoodie-02.jpg', season: '夏季', style: '训练', price: 99 },
      { id: 110, name: '学院风针织衫', category: '甜美', image: '/images/sweet-dress-02.jpg', season: '春秋', style: '学院', price: 139 },
      { id: 111, name: '复古短款夹克', category: '复古', image: '/images/retro-knit-02.jpg', season: '春秋', style: '经典', price: 239 },
      { id: 112, name: '宽松运动卫衣', category: '运动', image: '/images/sport-hoodie-01.jpg', season: '秋冬', style: '休闲', price: 179 },
      { id: 113, name: '通勤基础衬衫', category: '商务', image: '/images/business-shirt-01.jpg', season: '四季', style: '极简', price: 129 },
      { id: 114, name: '甜美泡泡袖裙', category: '甜美', image: '/images/sweet-dress-01.jpg', season: '夏季', style: '约会', price: 229 },
      { id: 115, name: '街头印花T恤', category: '街头', image: '/images/casual-tee-02.jpg', season: '夏季', style: '潮牌', price: 109 },
      { id: 116, name: '复古针织开衫', category: '复古', image: '/images/retro-knit-01.jpg', season: '春秋', style: '温柔', price: 169 },
      { id: 117, name: '休闲纯色T恤', category: '休闲', image: '/images/casual-tee-01.jpg', season: '四季', style: '日常', price: 69 },
      { id: 118, name: '轻熟连衣裙', category: '甜美', image: '/images/sweet-dress-02.jpg', season: '夏季', style: '轻熟', price: 199 }
    ];
  },

  mergeWithDefaultCatalog(sourceList) {
    const defaultMap = new Map(this.getDefaultClothes().map(item => [Number(item.id), item]));
    const result = (Array.isArray(sourceList) ? sourceList : []).map(item => {
      const id = Number(item.id);
      if (!defaultMap.has(id)) return item;
      const base = defaultMap.get(id);
      return {
        ...base,
        ...item,
        image: base.image
      };
    });
    const existed = new Set(result.map(item => Number(item.id)));
    defaultMap.forEach((item, id) => {
      if (!existed.has(id)) result.push(item);
    });
    return result;
  },

  normalizeClothes(clothesList) {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    let collected = wx.getStorageSync(userCollectedKey) || [];
    const collectedIds = new Set(Array.isArray(collected) ? collected.map(item => Number(item.id)) : []);
    return clothesList.map(item => {
      const userCollections = item.userCollections || {};
      const isCollected = userCollections[username] !== undefined ? !!userCollections[username] : collectedIds.has(Number(item.id));
      userCollections[username] = isCollected;
      return {
        ...item,
        id: Number(item.id),
        price: Number(item.price || 99),
        likes: Number(item.likes || 0),
        userCollections,
        isCollected
      };
    });
  },

  loadClothesData() {
    const app = getApp();
    let clothesList = [];
    if (app.globalData && Array.isArray(app.globalData.clothesList) && app.globalData.clothesList.length) {
      clothesList = app.globalData.clothesList;
    } else {
      const stored = wx.getStorageSync('clothesList') || [];
      clothesList = Array.isArray(stored) && stored.length ? stored : this.getDefaultClothes();
    }
    const merged = this.mergeWithDefaultCatalog(clothesList);
    const normalized = this.normalizeClothes(merged);
    if (app.globalData) app.globalData.clothesList = normalized;
    wx.setStorageSync('clothesList', normalized);
    this.setData({
      allClothes: normalized,
      totalCount: normalized.length
    });
    this.applyFilters();
  },

  applyFilters() {
    const category = this.data.currentCategory;
    const keyword = (this.data.searchKeyword || '').trim().toLowerCase();
    let list = [...this.data.allClothes];
    if (category !== '全部') {
      list = list.filter(item => item.category === category);
    }
    if (keyword) {
      list = list.filter(item =>
        String(item.name || '').toLowerCase().includes(keyword) ||
        String(item.category || '').toLowerCase().includes(keyword) ||
        String(item.style || '').toLowerCase().includes(keyword) ||
        String(item.season || '').toLowerCase().includes(keyword)
      );
    }
    this.setData({
      clothesList: list,
      filteredCount: list.length
    });
  },

  toggleRemoveMode() {
    const next = !this.data.removeMode;
    this.setData({
      removeMode: next
    });
    wx.showToast({
      title: next ? '已开启移除' : '已退出移除',
      icon: 'none'
    });
  },

  isDefaultClothesId(id) {
    const target = Number(id);
    return this.getDefaultClothes().some(item => Number(item.id) === target);
  },

  onRemoveTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    if (this.isDefaultClothesId(id)) {
      wx.showToast({
        title: '系统单品不可移除',
        icon: 'none'
      });
      return;
    }
    const target = this.data.allClothes.find(item => Number(item.id) === id);
    wx.showModal({
      title: '移除单品',
      content: `确定移除「${target ? target.name : '该单品'}」吗？`,
      confirmText: '移除',
      confirmColor: '#ff3b8d',
      success: (res) => {
        if (!res.confirm) return;
        const allClothes = this.data.allClothes.filter(item => Number(item.id) !== id);
        this.setData({
          allClothes,
          totalCount: allClothes.length
        }, () => {
          this.persistCollection(allClothes);
          this.applyFilters();
          wx.showToast({
            title: '已移除',
            icon: 'success'
          });
        });
      }
    });
  },

  onCategoryChange(e) {
    this.setData({
      currentCategory: e.currentTarget.dataset.category || '全部'
    });
    this.applyFilters();
  },

  onSearchInput(e) {
    const keyword = e.detail.value || '';
    this.setData({
      searchKeyword: keyword
    });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.applyFilters();
    }, 120);
  },

  onCollectTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const username = wx.getStorageSync('username') || 'anonymous';
    const allClothes = this.data.allClothes.map(item => {
      if (Number(item.id) !== id) return item;
      const userCollections = item.userCollections || {};
      const isCollected = !(userCollections[username] || false);
      userCollections[username] = isCollected;
      return {
        ...item,
        userCollections,
        isCollected
      };
    });
    this.setData({ allClothes });
    this.persistCollection(allClothes);
    this.applyFilters();
    const target = allClothes.find(item => Number(item.id) === id);
    wx.showToast({
      title: target && target.isCollected ? '已加入收藏' : '已取消收藏',
      icon: 'success'
    });
  },

  persistCollection(allClothes) {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    const collected = allClothes.filter(item => item.userCollections && item.userCollections[username]);
    wx.setStorageSync(userCollectedKey, collected);
    wx.setStorageSync('clothesList', allClothes);
    const app = getApp();
    if (app.globalData) app.globalData.clothesList = allClothes;
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    const urls = this.data.clothesList.map(item => item.image).filter(item => !!item);
    if (!src) {
      wx.showToast({
        title: '暂无可预览图片',
        icon: 'none'
      });
      return;
    }

    const openPreview = (currentSrc, urlsToUse) => {
      wx.previewImage({
        current: currentSrc,
        urls: urlsToUse,
        fail: () => {
          wx.showToast({
            title: '图片预览失败',
            icon: 'none'
          });
        }
      });
    };

    if (String(src).startsWith('/')) {
      wx.getImageInfo({
        src,
        success: (res) => {
          const localPath = res && (res.path || res.tempFilePath) ? (res.path || res.tempFilePath) : src;
          openPreview(localPath, [localPath]);
        },
        fail: () => {
          openPreview(src, urls.length ? urls : [src]);
        }
      });
      return;
    }

    openPreview(src, urls.length ? urls : [src]);
  },

  navigateToUpload() {
    wx.navigateTo({
      url: '/pages/add-clothes/add-clothes'
    });
  },

  goBackHome() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return {
      title: 'AI智能穿搭魔法师 - 挑选服装',
      path: '/pages/clothes-selection/clothes-selection'
    };
  }
});
