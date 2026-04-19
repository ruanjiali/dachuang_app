const { pickSingleFromAlbum, pickSingleFromCamera } = require('../../utils/imagePicker');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    imageUrl: '',
    name: '',
    categoryIndex: 0,
    categoryList: [
      { id: 1, name: '休闲' },
      { id: 2, name: '商务' },
      { id: 3, name: '运动' },
      { id: 4, name: '复古' },
      { id: 5, name: '街头' },
      { id: 6, name: '甜美' }
    ],
    seasonIndex: 0,
    seasonList: ['春季', '夏季', '秋季', '冬季', '四季'],
    styleIndex: 0,
    styleList: ['简约', '复古', '甜美', '街头', '商务', '运动'],
    description: '',
    showDialog: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  // 显示上传弹窗
  showUploadDialog() {
    this.setData({
      showDialog: true
    });
  },

  // 隐藏上传弹窗
  hideUploadDialog() {
    this.setData({
      showDialog: false
    });
  },

  // 拍照上传
  async takePhoto() {
    try {
      const path = await pickSingleFromCamera();
      if (path) {
        this.setData({
          imageUrl: path
        });
      }
    } finally {
      this.hideUploadDialog();
    }
  },

  // 从相册选择
  async chooseFromAlbum() {
    try {
      const path = await pickSingleFromAlbum();
      if (path) {
        this.setData({
          imageUrl: path
        });
      }
    } finally {
      this.hideUploadDialog();
    }
  },

  // 删除图片
  deleteImage() {
    this.setData({
      imageUrl: ''
    });
  },

  // 输入服装名称
  onNameInput(e) {
    this.setData({
      name: e.detail.value
    });
  },

  // 选择服装类别
  onCategoryChange(e) {
    this.setData({
      categoryIndex: e.detail.value
    });
  },

  // 选择季节
  onSeasonChange(e) {
    this.setData({
      seasonIndex: e.detail.value
    });
  },

  // 选择风格
  onStyleChange(e) {
    this.setData({
      styleIndex: e.detail.value
    });
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    });
  },

  // 提交服装信息
  submitClothes() {
    const { imageUrl, name, categoryIndex, categoryList, seasonIndex, seasonList, styleIndex, styleList, description } = this.data;

    // 验证输入
    if (!imageUrl) {
      wx.showToast({
        title: '请上传服装照片',
        icon: 'none'
      });
      return;
    }

    if (!name.trim()) {
      wx.showToast({
        title: '请输入服装名称',
        icon: 'none'
      });
      return;
    }

    // 构建服装数据
    const newClothes = {
      id: Date.now(),
      name: name.trim(),
      category: categoryList[categoryIndex].name,
      season: seasonList[seasonIndex],
      style: styleList[styleIndex],
      description: description.trim(),
      image: imageUrl,
      isCollected: false,
      createTime: this.formatTime(new Date())
    };

    // 显示加载提示
    wx.showLoading({
      title: '保存中...',
    });

    // 获取并更新全局数据
    const app = getApp();
    let clothesList = app.globalData.clothesList || [];
    clothesList.unshift(newClothes);
    app.globalData.clothesList = clothesList;

    // 保存到本地存储
    wx.setStorageSync('clothesList', clothesList);

    // 模拟保存延迟
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1000);
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${this.padZero(month)}-${this.padZero(day)}`;
  },

  // 补零
  padZero(n) {
    return n < 10 ? '0' + n : n;
  }
});
