// pages/register/register.js
Page({
  data: {
    username: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    isLoading: false,
    // 错误信息
    usernameError: '',
    passwordError: '',
    confirmPasswordError: '',
    termsError: '',
    // 验证状态
    canRegister: false
  },

  onLoad() {
    // 页面加载时的初始化
    this.initPage();
  },

  initPage() {
    // 可以在这里添加页面初始化逻辑
    console.log('注册页面加载完成');
  },

  // 用户名输入
  onUsernameInput(e) {
    const username = e.detail.value;
    this.setData({
      username,
      usernameError: ''
    });
    this.validateUsername(username);
    this.checkCanRegister();
  },



  // 密码输入
  onPasswordInput(e) {
    const password = e.detail.value;
    this.setData({
      password,
      passwordError: ''
    });
    this.validatePassword(password);
    this.validateConfirmPassword(this.data.confirmPassword);
    this.checkCanRegister();
  },

  // 确认密码输入
  onConfirmPasswordInput(e) {
    const confirmPassword = e.detail.value;
    this.setData({
      confirmPassword,
      confirmPasswordError: ''
    });
    this.validateConfirmPassword(confirmPassword);
    this.checkCanRegister();
  },



  // 同意协议
  onAgreeToTerms() {
    this.setData({
      agreeToTerms: !this.data.agreeToTerms
    });
    this.checkCanRegister();
  },

  // 验证用户名
  validateUsername(username) {
    if (!username.trim()) {
      this.setData({ usernameError: '用户名不能为空' });
      return false;
    }
    if (username.length < 3) {
      this.setData({ usernameError: '用户名长度不能少于3位' });
      return false;
    }
    if (username.length > 20) {
      this.setData({ usernameError: '用户名长度不能超过20位' });
      return false;
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      this.setData({ usernameError: '用户名只能包含字母、数字、下划线和中文' });
      return false;
    }
    return true;
  },



  // 验证密码
  validatePassword(password) {
    if (!password.trim()) {
      this.setData({ passwordError: '密码不能为空' });
      return false;
    }
    if (password.length < 6) {
      this.setData({ passwordError: '密码长度不能少于6位' });
      return false;
    }
    if (password.length > 20) {
      this.setData({ passwordError: '密码长度不能超过20位' });
      return false;
    }
    return true;
  },

  // 验证确认密码
  validateConfirmPassword(confirmPassword) {
    if (!confirmPassword.trim()) {
      this.setData({ confirmPasswordError: '请确认密码' });
      return false;
    }
    if (confirmPassword !== this.data.password) {
      this.setData({ confirmPasswordError: '两次输入的密码不一致' });
      return false;
    }
    return true;
  },



  // 检查是否可以注册
  checkCanRegister() {
    const { username, password, confirmPassword, agreeToTerms } = this.data;
    
    // 清除之前的错误信息
    this.setData({
      termsError: ''
    });
    
    const canRegister = 
      username.trim() && 
      password.trim() && 
      confirmPassword.trim() && 
      agreeToTerms &&
      !this.data.usernameError &&
      !this.data.passwordError &&
      !this.data.confirmPasswordError;

    this.setData({ canRegister });
  },
  // 注册
  register() {
    if (!this.data.canRegister) {
      // 检查是否是因为没有同意协议
      if (!this.data.agreeToTerms) {
        this.setData({
          termsError: '请阅读并同意用户协议和隐私政策'
        });
      }
      wx.showToast({
        title: '请完善注册信息',
        icon: 'none'
      });
      return;
    }

    // 最终验证
    if (!this.validateUsername(this.data.username) ||
        !this.validatePassword(this.data.password) ||
        !this.validateConfirmPassword(this.data.confirmPassword) ||
        !this.data.agreeToTerms) {
      return;
    }

    this.setData({ isLoading: true });

    // 模拟注册请求
    setTimeout(() => {
      // 这里应该是真实的注册API调用
      if (this.simulateRegister()) {
        this.registerSuccess();
      } else {
        this.registerFailed();
      }
      this.setData({ isLoading: false });
    }, 2000);
  },

  // 模拟注册（这里应该是真实的API调用）
  simulateRegister() {
    // 模拟注册成功
    return true;
  },

  // 注册成功
  registerSuccess() {
    // 保存新注册的用户信息到本地存储，供登录时使用
    const newUser = {
      username: this.data.username,
      password: this.data.password
    };
    
    // 获取现有的用户列表
    let registeredUsers = wx.getStorageSync('registeredUsers') || [];
    
    // 检查用户名是否已存在
    const usernameExists = registeredUsers.some(user => user.username === newUser.username);
    if (usernameExists) {
      wx.showModal({
        title: '注册失败',
        content: '用户名已存在，请更换其他用户名',
        showCancel: false
      });
      return;
    }
    
    // 添加新用户
    registeredUsers.push(newUser);
    
    // 保存更新后的用户列表
    wx.setStorageSync('registeredUsers', registeredUsers);
    
    // 更新登录验证列表
    let loginUsers = wx.getStorageSync('loginUsers') || [
      { username: 'admin', password: '123456' },
      { username: 'user', password: '123456' },
      { username: 'test', password: '123456' },
      { username: 'demo', password: 'demo' },
      { username: '123', password: '123' },
      { username: 'abc', password: 'abc' },
      { username: 'test123', password: 'test123' },
      { username: 'admin123', password: 'admin123' }
    ];
    
    // 添加到登录验证列表
    loginUsers.push(newUser);
    wx.setStorageSync('loginUsers', loginUsers);

    // 自动登录新注册用户
    wx.setStorageSync('token', 'mock_token_' + Date.now());
    wx.setStorageSync('username', newUser.username);

    // 显示成功提示
    wx.showToast({
      title: '注册成功，正在登录',
      icon: 'success',
      duration: 1500
    });

    // 延迟跳转，确保用户看到成功提示
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }, 1500);
  },

  // 注册失败
  registerFailed() {
    wx.showModal({
      title: '注册失败',
      content: '注册失败，请检查网络连接或稍后重试。',
      showCancel: false,
      confirmText: '确定',
      confirmColor: '#ff6bb5'
    });
  },

  // 显示用户协议
  showTerms() {
    wx.showModal({
      title: '用户协议',
      content: `【AI穿搭魔法师用户协议】

一、服务说明
AI穿搭魔法师是一款基于人工智能技术的穿搭推荐小程序，旨在为用户提供个性化的穿搭建议和时尚参考。

二、用户账号
1. 您需要注册账号才能使用完整功能
2. 您应妥善保管账号信息，因个人保管不善造成的损失由用户自行承担
3. 我们不会向第三方透露您的账号密码

三、服务使用
1. 穿搭建议仅供参考，实际搭配请结合个人喜好
2. 请勿将本服务用于任何违法用途
3. AI生成的建议可能存在偏差，请理性参考

四、知识产权
1. 本程序的文字、图像、界面设计等均受知识产权保护
2. 未经授权，用户不得复制、传播或商业使用

五、免责声明
1. 因不可抗力导致的服务中断不承担责任
2. 用户因采纳建议产生的任何问题由用户自行负责
3. AI服务可能存在误差，介意者请谨慎使用

六、协议更新
我们保留随时更新本协议的权利，更新内容将在小程序内公示。`,
      showCancel: false,
      confirmText: '确定',
      confirmColor: '#ff6bb5',
      success: (res) => {
        if (res.confirm) {
          // 勾选同意
          if (!this.data.agreeToTerms) {
            this.setData({ agreeToTerms: true });
            this.checkCanRegister();
          }
        }
      }
    });
  },

  // 显示隐私政策
  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: `【AI穿搭魔法师隐私政策】

一、信息收集
1. 我们可能会收集您主动提供的信息（如用户名）
2. 您上传的图片仅用于AI穿搭分析，不会被保存或分享
3. 天气信息仅用于穿搭场景适配

二、信息使用
1. 您的个人信息用于提供个性化服务
2. 我们不会将您的信息出售给任何第三方
3. 本地存储的数据仅保存在您的设备上

三、信息保护
1. 我们采用合理的加密措施保护您的数据
2. 您的图片在处理完成后不会保留在我们的服务器

四、Cookie和本地存储
1. 我们使用本地存储记录您的偏好设置
2. 这些数据不会上传到服务器

五、第三方服务
1. 本程序可能包含第三方服务的链接
2. 第三方服务的隐私政策由第三方负责

六、联系我们
如有任何隐私相关问题，请通过小程序内反馈联系我们。`,
      showCancel: false,
      confirmText: '确定',
      confirmColor: '#ff6bb5',
      success: (res) => {
        if (res.confirm) {
          // 勾选同意
          if (!this.data.agreeToTerms) {
            this.setData({ agreeToTerms: true });
            this.checkCanRegister();
          }
        }
      }
    });
  },

  // 跳转到登录页面
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  }
});
