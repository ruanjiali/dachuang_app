Page({
  data: {
    imagePath: null,
    resultImage: null,
    loading: false,
    clothesInfo: null,
    isCollected: false,
    showTips: true
  },

  getPicker() {
    return require('../../utils/imagePicker')
  },

  onLoad: function(options) {
    const app = getApp();
    
    if (app.globalData && app.globalData.clothesList) {
      // 获取传递的服装ID
      const id = options.id;
      
      if (id) {
        // 根据ID查找服装信息
        const clothesInfo = app.globalData.clothesList.find(item => item.id == id);
        if (clothesInfo) {
          this.setData({
            clothesInfo: clothesInfo,
            imagePath: clothesInfo.image
          });
          // 检查收藏状态
          this.checkCollectionStatus(id);
        }
      }
    }
  },

  // 检查收藏状态
  checkCollectionStatus: function(id) {
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    let collectedClothes = [];
    try {
      collectedClothes = wx.getStorageSync(userCollectedKey) || [];
    } catch (err) {
      console.error('获取收藏数据失败:', err);
    }
    const isCollected = Array.isArray(collectedClothes) && collectedClothes.some(item => Number(item.id) === Number(id));
    this.setData({
      isCollected: isCollected
    });
  },

  // 切换收藏状态
  toggleCollection: function() {
    if (!this.data.clothesInfo) {
      wx.showToast({
        title: '没有服装信息',
        icon: 'none'
      });
      return;
    }

    const id = this.data.clothesInfo.id;
    const username = wx.getStorageSync('username') || 'anonymous';
    const userCollectedKey = `collectedClothes_${username}`;
    let collectedClothes = [];
    try {
      collectedClothes = wx.getStorageSync(userCollectedKey) || [];
    } catch (err) {
      console.error('获取收藏数据失败:', err);
    }

    const index = Array.isArray(collectedClothes) ? collectedClothes.findIndex(item => Number(item.id) === Number(id)) : -1;
    let isCollected = this.data.isCollected;

    // 获取全局应用实例
    const app = getApp();
    if (app.globalData && app.globalData.clothesList) {
      const globalClothesList = app.globalData.clothesList;
      const globalIndex = globalClothesList.findIndex(item => item.id == id);

      if (index !== -1) {
        // 已收藏，取消收藏
        collectedClothes.splice(index, 1);
        isCollected = false;
        // 更新全局数据
        if (globalIndex !== -1) {
          if (!globalClothesList[globalIndex].userCollections) globalClothesList[globalIndex].userCollections = {};
          globalClothesList[globalIndex].userCollections[username] = false;
          globalClothesList[globalIndex].isCollected = false;
        }
      } else {
        // 未收藏，添加收藏
        if (!Array.isArray(collectedClothes)) collectedClothes = [];
        collectedClothes.push(this.data.clothesInfo);
        isCollected = true;
        // 更新全局数据
        if (globalIndex !== -1) {
          if (!globalClothesList[globalIndex].userCollections) globalClothesList[globalIndex].userCollections = {};
          globalClothesList[globalIndex].userCollections[username] = true;
          globalClothesList[globalIndex].isCollected = true;
        }
      }
    }

    try {
      wx.setStorageSync(userCollectedKey, collectedClothes);
      this.setData({
        isCollected: isCollected
      });
      wx.showToast({
        title: isCollected ? '收藏成功' : '取消收藏',
        icon: 'success',
        duration: 1500
      });
    } catch (err) {
      console.error('更新收藏数据失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 拍照
  takePhoto: function() {
    const { pickSingleFromCamera } = this.getPicker()
    pickSingleFromCamera()
      .then((tempFilePath) => {
        if (!tempFilePath) return
        this.setData({
          imagePath: tempFilePath,
          resultImage: null
        });
        wx.showToast({
          title: '拍照成功',
          icon: 'success'
        });
      })
      .catch(() => {
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        });
      })
  },

  // 从相册选择
  chooseFromAlbum: function() {
    const { pickSingleFromAlbum } = this.getPicker()
    pickSingleFromAlbum()
      .then((tempFilePath) => {
        if (!tempFilePath) return
        this.setData({
          imagePath: tempFilePath,
          resultImage: null
        });
        wx.showToast({
          title: '选择成功',
          icon: 'success'
        });
      })
      .catch(() => {
        wx.showToast({
          title: '选择失败',
          icon: 'none'
        });
      })
  },

  // 预览图片
  previewImage: function(e) {
    const target = e.currentTarget.dataset.type === 'result' ? this.data.resultImage : this.data.imagePath;
    if (!target) return;
    wx.previewImage({
      current: target,
      urls: [target]
    });
  },

  // 虚拟试穿
  async tryOnClothes() {
    if (!this.data.imagePath) {
      wx.showToast({
        title: '请先拍照或选择图片',
        icon: 'none'
      });
      return;
    }

    if (!this.data.clothesInfo) {
      wx.showToast({
        title: '请先选择服装',
        icon: 'none'
      });
      return;
    }

    this.setData({
      loading: true
    });

    // 显示加载提示
    wx.showLoading({
      title: '正在处理...',
      mask: true
    });

    try {
      // 动态导入服务
      const { virtualTryOn, mockVirtualTryOn, getVirtualTryUrl } = require('../../utils/services/virtualTryService.js');
      const virtualTryUrl = getVirtualTryUrl();

      let tryOnResult;
      if (virtualTryUrl) {
        // 尝试调用真实API
        try {
          tryOnResult = await virtualTryOn(this.data.imagePath, this.data.clothesInfo);
        } catch (apiError) {
          console.log('虚拟试穿API调用失败，使用模拟结果:', apiError.message);
          // API失败时使用模拟结果作为降级
          tryOnResult = await mockVirtualTryOn(this.data.imagePath, this.data.clothesInfo);
        }
      } else {
        // 没有配置API时使用模拟结果
        tryOnResult = await mockVirtualTryOn(this.data.imagePath, this.data.clothesInfo);
      }

      // 保存试穿历史
      this.saveTryOnHistory(tryOnResult);

      // 更新状态
      this.setData({
        resultImage: tryOnResult.resultImage,
        loading: false,
        tryOnId: Date.now()
      });

      wx.hideLoading();
      wx.showToast({
        title: '试穿成功',
        icon: 'success',
        duration: 2000
      });

      // 隐藏使用提示
      this.setData({
        showTips: false
      });
    } catch (error) {
      console.error('虚拟试穿失败:', error);
      this.setData({
        loading: false
      });

      wx.hideLoading();
      wx.showToast({
        title: '试穿失败，请重试',
        icon: 'none'
      });
    }
  },

  // 保存试穿历史
  saveTryOnHistory(tryOnResult) {
    try {
      let tryOnHistory = wx.getStorageSync('tryOnHistory') || [];
      tryOnHistory.push({
        id: tryOnResult.tryOnId || Date.now(),
        clothingName: this.data.clothesInfo ? this.data.clothesInfo.name : '未知服装',
        timestamp: Date.now(),
        image: tryOnResult.resultImage || this.data.imagePath
      });
      // 限制历史记录数量，最多保存50条
      if (tryOnHistory.length > 50) {
        tryOnHistory = tryOnHistory.slice(-50);
      }
      wx.setStorageSync('tryOnHistory', tryOnHistory);
    } catch (err) {
      console.error('保存试穿结果失败:', err);
    }
  },

  // 保存图片和试穿结果
  async saveImage() {
    if (!this.data.resultImage || !this.data.tryOnId) {
      wx.showToast({
        title: '没有可保存的图片',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      });

      // 试穿历史已在上方 tryOnClothes 中保存

      // 保存图片到本地相册
      // 检查保存权限
      wx.getSetting({
        success: (res) => {
          if (!res.authSetting['scope.writePhotosAlbum']) {
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => {
                this.saveImageToAlbum();
              },
              fail: () => {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  showCancel: false,
                  success: () => {
                    wx.openSetting();
                  }
                });
              }
            });
          } else {
            this.saveImageToAlbum();
          }
        }
      });

      wx.hideLoading();
    } catch (error) {
      console.error('保存失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    }
  },

  // 保存图片到相册
  saveImageToAlbum: function() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultImage,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (err) => {
        console.error('保存失败:', err);
        wx.showToast({
          title: '保存图片失败',
          icon: 'none'
        });
      }
    });
  },

  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${year}-${this.padZero(month)}-${this.padZero(day)} ${this.padZero(hour)}:${this.padZero(minute)}`;
  },

  padZero(n) {
    return n < 10 ? '0' + n : n;
  },

  saveToOutfits() {
    if (!this.data.imagePath && !this.data.resultImage) {
      wx.showToast({
        title: '请先拍照或选择图片',
        icon: 'none'
      });
      return;
    }
    const outfits = wx.getStorageSync('outfits') || [];
    const image = this.data.resultImage || this.data.imagePath;
    const desc = this.data.clothesInfo
      ? `随手拍试穿：${this.data.clothesInfo.name}`
      : '随手拍：我的今日穿搭';
    const newOutfit = {
      id: Date.now(),
      images: [image],
      description: desc,
      time: this.formatTime(new Date()),
      likes: 0,
      comments: []
    };
    outfits.unshift(newOutfit);
    wx.setStorageSync('outfits', outfits);
    wx.showToast({
      title: '已存到我的搭配',
      icon: 'success'
    });
  },

  goToAiRecognition() {
    if (!this.data.imagePath) {
      wx.showToast({
        title: '请先拍照或选择图片',
        icon: 'none'
      });
      return;
    }
    wx.setStorageSync('tempAiRecognitionImage', this.data.imagePath);
    wx.navigateTo({
      url: '/pages/ai-recognition/ai-recognition'
    });
  },

  // 返回首页
  goBackHome: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 页面显示
  onShow: function() {
    // 页面显示时的逻辑
  },

  // 页面隐藏
  onHide: function() {
    // 页面隐藏时的逻辑
  },

  // 页面卸载
  onUnload: function() {
    // 页面卸载时的逻辑
  }
})
