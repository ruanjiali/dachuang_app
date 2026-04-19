// pages/login/login.js
Page({
  data: {
    username: '',
    password: '',
    rememberPassword: false,
    isLoading: false,
    canLogin: false
  },

  onLoad() {
    // 页面加载时检查是否有保存的用户名和密码
    this.checkSavedCredentials();
  },

  // 检查保存的凭据
  checkSavedCredentials() {
    const savedUsername = wx.getStorageSync('savedUsername');
    const savedPassword = wx.getStorageSync('savedPassword');
    
    if (savedUsername && savedPassword) {
      this.setData({
        username: savedUsername,
        password: savedPassword,
        rememberPassword: true
      });
    }
    this.checkCanLogin();
  },

  // 检查是否可以登录
  checkCanLogin() {
    const { username, password } = this.data;
    const canLogin = username.trim() && password.trim();
    this.setData({ canLogin });
  },

  // 用户名输入
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
    this.checkCanLogin();
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
    this.checkCanLogin();
  },

  // 记住密码
  onRememberPassword() {
    this.setData({
      rememberPassword: !this.data.rememberPassword
    });
  },

  // 登录
  login() {
    const { username, password, rememberPassword } = this.data;

    // 输入验证
    if (!username.trim()) {
      this.showError('请输入用户名');
      return;
    }

    if (!password.trim()) {
      this.showError('请输入密码');
      return;
    }

    this.setData({ isLoading: true });

    // 模拟登录请求
    setTimeout(() => {
      // 这里应该是真实的登录API调用
      if (this.validateCredentials(username, password)) {
        this.loginSuccess(username, password, rememberPassword);
      } else {
        this.loginFailed();
      }
      this.setData({ isLoading: false });
    }, 1000);
  },

  // 验证凭据（模拟）
  validateCredentials(username, password) {
    // 首先尝试从本地存储获取用户列表
    let loginUsers = wx.getStorageSync('loginUsers') || [];
    
    // 如果没有本地存储的用户列表，使用默认的测试账号
    if (loginUsers.length === 0) {
      loginUsers = [
        { username: 'admin', password: '123456' },
        { username: 'user', password: '123456' },
        { username: 'test', password: '123456' },
        { username: 'demo', password: 'demo' },
        { username: '123', password: '123' },
        { username: 'abc', password: 'abc' },
        { username: 'test123', password: 'test123' },
        { username: 'admin123', password: 'admin123' }
      ];
      // 保存到本地存储
      wx.setStorageSync('loginUsers', loginUsers);
    }
    
    // 同时获取注册用户列表，保持数据一致性
    const registeredUsers = wx.getStorageSync('registeredUsers') || [];
    
    // 合并两个列表进行验证
    const allUsers = [...loginUsers, ...registeredUsers];

    // 验证用户名和密码
    return allUsers.some(user => 
      user.username === username && user.password === password
    );
  },

  // 登录成功
  loginSuccess(username, password, rememberPassword) {
    // 保存登录状态
    wx.setStorageSync('token', 'mock_token_' + Date.now());
    wx.setStorageSync('username', username);
    
    // 如果选择记住密码，保存到本地
    if (rememberPassword) {
      wx.setStorageSync('savedUsername', username);
      wx.setStorageSync('savedPassword', password);
    } else {
      wx.removeStorageSync('savedUsername');
      wx.removeStorageSync('savedPassword');
    }

    // 显示成功提示
    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
      // 使用redirectTo替代switchTab，因为没有配置tabBar
      wx.redirectTo({
        url: '/pages/index/index',
        success: function() {
          console.log('成功跳转到首页');
        },
        fail: function(err) {
          console.error('跳转失败:', err);
          // 如果失败，使用navigateTo作为备用
          wx.navigateTo({
            url: '/pages/index/index'
          });
        }
      });
    }, 1500);
  },

  // 登录失败
  loginFailed() {
    wx.showModal({
      title: '登录失败',
      content: '用户名或密码错误，请重试',
      showCancel: false,
      confirmText: '确定',
      confirmColor: '#ff6bb5'
    });
  },

  // 显示错误信息
  showError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  // 跳转到忘记密码页面
  goToForgotPassword() {
    wx.navigateTo({
      url: '/pages/forgot-password/forgot-password'
    });
  },

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },
});