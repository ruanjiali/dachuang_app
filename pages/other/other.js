// pages/other/other.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    comments: [],
    newComment: '',
    userAvatar: '/images/logo.png',
    likes: 0,
    hasLiked: false,
    rating: 0,
    averageRating: 0,
    ratingCount: 0,
    submitting: false,
    username: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取用户信息
    this.getUserInfo();
    // 模拟加载评论数据
    this.loadComments();
    // 加载点赞数
    this.loadLikeCount();
    // 加载评级
    this.loadRating();
  },

  onShow() {
    // 页面显示时刷新数据并重置状态
    this.setData({ submitting: false });
    this.loadComments();
    this.loadLikeCount();
    this.loadRating();
  },

  // 获取用户信息
  getUserInfo() {
    const username = wx.getStorageSync('username');
    if (username) {
      this.setData({
        username: username
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 跳转到设置页面
  goToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 加载评论数据
  loadComments() {
    const username = wx.getStorageSync('username') || 'anonymous';
    
    // 模拟从本地存储获取评论
    let comments = wx.getStorageSync('comments') || [
      {
        id: 1,
        user: '时尚达人',
        avatar: '/images/organization-avatar.png',
        content: '这个小程序真的很棒，给我的穿搭提供了很多灵感！',
        time: '2023-11-15 14:30',
        likes: 12,
        userLikes: {}
      },
      {
        id: 2,
        user: '穿搭新手',
        avatar: '/images/logo.png',
        content: '刚开始学习穿搭，这个工具对我帮助很大，推荐给大家！',
        time: '2023-11-10 09:15',
        likes: 8,
        userLikes: {}
      }
    ];
    
    // 为每条评论设置当前用户的点赞状态
    comments = comments.map(comment => {
      // 确保userLikes对象存在
      if (!comment.userLikes) {
        comment.userLikes = {};
      }
      // 添加hasLiked字段用于页面渲染（基于当前用户）
      return {
        ...comment,
        hasLiked: comment.userLikes[username] || false
      };
    });

    this.setData({
      comments: comments
    });
  },

  // 加载点赞数
  loadLikeCount() {
    // 获取当前用户信息
    const username = wx.getStorageSync('username') || 'anonymous';
    
    // 加载全局点赞总数
    const totalLikes = wx.getStorageSync('totalLikes') || 0;
    
    // 加载当前用户的点赞状态
    const userHasLikedKey = `userHasLiked_${username}`;
    const hasLiked = wx.getStorageSync(userHasLikedKey) || false;

    this.setData({
      likes: totalLikes,
      hasLiked: hasLiked
    });
  },

  // 加载评级
  loadRating() {
    // 获取当前用户信息
    const username = wx.getStorageSync('username') || 'anonymous';
    const userRatingKey = `userRating_${username}`;
    
    // 获取当前用户的评分
    const userRating = wx.getStorageSync(userRatingKey) || 0;
    
    // 获取所有评分数据并计算平均分
    const allRatingsKey = 'allUserRatings';
    const allUserRatings = wx.getStorageSync(allRatingsKey) || {};
    const ratings = Object.values(allUserRatings).filter(rating => rating > 0);
    const averageRating = ratings.length > 0 ? 
      (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : 
      0;
    const ratingCount = ratings.length;

    this.setData({
      rating: userRating,
      averageRating: parseFloat(averageRating),
      ratingCount: ratingCount
    });
  },

  // 输入评论
  onCommentInput(e) {
    try {
      this.setData({
        newComment: e.detail.value || ''
      });
    } catch (error) {
      console.error('Error updating newComment:', error);
    }
  },

  // 提交评论
  submitComment() {
    try {
      const { comments, newComment, userAvatar, username } = this.data;

      if (!newComment || !newComment.trim()) {
        wx.showToast({
          title: '评论不能为空',
          icon: 'none'
        });
        return;
      }

      if (this.data.submitting) {
        return;
      }

      this.setData({
        submitting: true
      });

      // 创建新评论
      const newCommentObj = {
        id: Date.now(),
        user: username || '匿名用户',
        avatar: userAvatar,
        content: newComment,
        time: this.formatTime(new Date()),
        likes: 0,
        userLikes: {},
        hasLiked: false
      };

      // 模拟网络请求延迟
      setTimeout(() => {
        try {
          // 添加到评论列表
          const updatedComments = [newCommentObj, ...comments];

          this.setData({
            comments: updatedComments,
            newComment: '',
            submitting: false
          });

          // 保存到本地存储
          wx.setStorageSync('comments', updatedComments);

          wx.showToast({
            title: '评论成功',
            icon: 'success',
            duration: 1500
          });
        } catch (error) {
          console.error('Error in setTimeout callback:', error);
          this.setData({ submitting: false });
          wx.showToast({
            title: '发送失败，请重试',
            icon: 'none'
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Error in submitComment:', error);
      this.setData({ submitting: false });
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      });
    }
  },

  // 点赞小程序
  likeApp() {
    // 获取当前用户信息
    const username = wx.getStorageSync('username') || 'anonymous';
    const userHasLikedKey = `userHasLiked_${username}`;
    
    let { likes, hasLiked } = this.data;
    
    // 检查当前用户是否已点赞，避免重复点赞或多次取消
    if (hasLiked) {
      // 取消点赞
      likes--;
    } else {
      // 点赞
      likes++;
    }
    
    hasLiked = !hasLiked;

    this.setData({
      likes: likes,
      hasLiked: hasLiked
    });

    // 保存到本地存储
    wx.setStorageSync('totalLikes', likes); // 全局点赞总数
    wx.setStorageSync(userHasLikedKey, hasLiked); // 当前用户点赞状态

    wx.showToast({
      title: hasLiked ? '点赞成功' : '取消点赞',
      icon: 'success',
      duration: 1000
    });
  },

  // 点赞评论
  likeComment(e) {
    const { id } = e.currentTarget.dataset;
    const { comments } = this.data;
    const username = wx.getStorageSync('username') || 'anonymous';
    
    const commentIndex = comments.findIndex(item => item.id === id);
    if (commentIndex === -1) return;

    // 确保userLikes对象存在
    const updatedComments = [...comments];
    if (!updatedComments[commentIndex].userLikes) {
      updatedComments[commentIndex].userLikes = {};
    }
    
    // 获取当前用户的点赞状态
    const hasLiked = updatedComments[commentIndex].userLikes[username] || false;
    const newLikeStatus = !hasLiked;
    
    // 更新点赞状态
    updatedComments[commentIndex].userLikes[username] = newLikeStatus;
    updatedComments[commentIndex].hasLiked = newLikeStatus;
    
    // 更新点赞数
    const currentLikes = updatedComments[commentIndex].likes;
    updatedComments[commentIndex].likes = newLikeStatus ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    this.setData({
      comments: updatedComments
    });

    // 保存到本地存储
    wx.setStorageSync('comments', updatedComments);

    wx.showToast({
      title: newLikeStatus ? '点赞成功' : '取消点赞',
      icon: 'success',
      duration: 1000
    });
  },

  // 设置评级
  setRating(e) {
    const { index } = e.currentTarget.dataset;
    const rating = parseInt(index);
    
    // 获取当前用户信息
    const username = wx.getStorageSync('username') || 'anonymous';
    const userRatingKey = `userRating_${username}`;
    
    // 保存用户个人评分
    wx.setStorageSync(userRatingKey, rating);
    
    // 更新所有用户评分数据
    const allRatingsKey = 'allUserRatings';
    const allUserRatings = wx.getStorageSync(allRatingsKey) || {};
    allUserRatings[username] = rating;
    wx.setStorageSync(allRatingsKey, allUserRatings);
    
    // 重新计算平均分
    const ratings = Object.values(allUserRatings).filter(r => r > 0);
    const averageRating = ratings.length > 0 ? 
      (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : 
      0;
    const ratingCount = ratings.length;
    
    this.setData({
      rating: rating,
      averageRating: parseFloat(averageRating),
      ratingCount: ratingCount
    });

    wx.showToast({
      title: '感谢您的' + rating + '星评价！',
      icon: 'success',
      duration: 2000
    });
  },

  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return minutes + '分钟前';
    } else if (hours < 24) {
      return hours + '小时前';
    } else if (days < 7) {
      return days + '天前';
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();

      return `${year}-${this.padZero(month)}-${this.padZero(day)} ${this.padZero(hour)}:${this.padZero(minute)}`;
    }
  },

  // 补零
  padZero(n) {
    return n < 10 ? '0' + n : n.toString();
  },

  // 跳转到上传搭配页面
  goToUploadOutfit() {
    wx.navigateTo({
      url: '/pages/upload-outfit/upload-outfit'
    });
  },

  // 跳转到关于我们页面
  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  }
})
