const { chooseImages } = require('../../utils/imagePicker');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    imageList: [],
    description: '',
    maxCount: 9,
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
    const { imageList, maxCount } = this.data;
    const count = maxCount - imageList.length;

    if (count <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      });
      this.hideUploadDialog();
      return;
    }

    try {
      const res = await chooseImages({ count, sizeType: ['compressed'], sourceType: ['camera'] });
      const tempFilePaths = (res && res.tempFilePaths) ? res.tempFilePaths : [];
      if (tempFilePaths.length) {
        this.setData({
          imageList: [...imageList, ...tempFilePaths]
        });
      }
    } finally {
      this.hideUploadDialog();
    }
  },

  // 从相册选择
  async chooseFromAlbum() {
    const { imageList, maxCount } = this.data;
    const count = maxCount - imageList.length;

    if (count <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      });
      this.hideUploadDialog();
      return;
    }

    try {
      const res = await chooseImages({ count, sizeType: ['compressed'], sourceType: ['album'] });
      const tempFilePaths = (res && res.tempFilePaths) ? res.tempFilePaths : [];
      if (tempFilePaths.length) {
        this.setData({
          imageList: [...imageList, ...tempFilePaths]
        });
      }
    } finally {
      this.hideUploadDialog();
    }
  },

  // 删除图片
  deleteImage(e) {
    const { index } = e.currentTarget.dataset;
    const { imageList } = this.data;

    imageList.splice(index, 1);
    this.setData({
      imageList: imageList
    });
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    });
  },

  // 提交搭配
  submitOutfit() {
    const { imageList, description } = this.data;

    if (imageList.length === 0) {
      wx.showToast({
        title: '请上传搭配照片',
        icon: 'none'
      });
      return;
    }

    if (!description.trim()) {
      wx.showToast({
        title: '请添加搭配描述',
        icon: 'none'
      });
      return;
    }

    // 模拟上传
    wx.showLoading({
      title: '上传中...',
    });

    // 模拟上传延迟
    setTimeout(() => {
      wx.hideLoading();

      // 模拟保存到本地存储
      const outfits = wx.getStorageSync('outfits') || [];
      const newOutfit = {
        id: Date.now(),
        images: imageList,
        description: description,
        time: this.formatTime(new Date()),
        likes: 0,
        comments: []
      };

      outfits.unshift(newOutfit);
      wx.setStorageSync('outfits', outfits);

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      });

      // 延迟返回
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1500);
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();

    return `${year}-${this.padZero(month)}-${this.padZero(day)} ${this.padZero(hour)}:${this.padZero(minute)}`;
  },

  // 补零
  padZero(n) {
    return n < 10 ? '0' + n : n;
  }
})
