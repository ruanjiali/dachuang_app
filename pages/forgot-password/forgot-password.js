// pages/forgot-password/forgot-password.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    phone: '',
    code: '',
    newPassword: '',
    confirmPassword: '',
    countdown: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  // 手机号输入
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 验证码输入
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    });
  },

  // 新密码输入
  onNewPasswordInput(e) {
    this.setData({
      newPassword: e.detail.value
    });
  },

  // 确认密码输入
  onConfirmPasswordInput(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  // 获取验证码
  getVerificationCode() {
    const { phone, countdown } = this.data;

    if (countdown > 0) {
      return;
    }

    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    // 模拟发送验证码
    wx.showToast({
      title: '验证码发送成功',
      icon: 'success'
    });

    // 开始倒计时
    let seconds = 60;
    this.setData({
      countdown: seconds
    });

    const timer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(timer);
        this.setData({
          countdown: 0
        });
      } else {
        this.setData({
          countdown: seconds
        });
      }
    }, 1000);
  },

  // 重置密码
  resetPassword() {
    const { phone, code, newPassword, confirmPassword } = this.data;

    // 验证表单
    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!code) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      });
      return;
    }

    if (!newPassword) {
      wx.showToast({
        title: '请输入新密码',
        icon: 'none'
      });
      return;
    }

    if (newPassword.length < 6) {
      wx.showToast({
        title: '密码长度至少6位',
        icon: 'none'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次密码输入不一致',
        icon: 'none'
      });
      return;
    }

    // 模拟重置密码请求
    wx.showLoading({
      title: '重置中...',
    });

    setTimeout(() => {
      const registeredUsers = wx.getStorageSync('registeredUsers') || [];
      const loginUsers = wx.getStorageSync('loginUsers') || [];
      const matched = Array.isArray(registeredUsers)
        ? registeredUsers.find(user => String(user.phone || '') === String(phone))
        : null;
      if (!matched) {
        wx.hideLoading();
        wx.showToast({
          title: '该手机号未注册',
          icon: 'none'
        });
        return;
      }
      const nextRegisteredUsers = registeredUsers.map(user => {
        if (String(user.phone || '') !== String(phone)) return user;
        return {
          ...user,
          password: newPassword
        };
      });
      const nextLoginUsers = Array.isArray(loginUsers)
        ? loginUsers.map(user => {
            if (String(user.phone || '') !== String(phone)) return user;
            return {
              ...user,
              password: newPassword
            };
          })
        : [];
      wx.setStorageSync('registeredUsers', nextRegisteredUsers);
      wx.setStorageSync('loginUsers', nextLoginUsers);
      wx.hideLoading();

      wx.showToast({
        title: '密码重置成功',
        icon: 'success'
      });

      // 延迟返回登录页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1500);
  },

  // 返回登录页
  goBackToLogin() {
    wx.navigateBack();
  }
})
