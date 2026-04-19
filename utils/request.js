// utils/request.js
// 封装请求工具
const config = require('./config');

const request = {
  // 基础配置
  baseURL: (config.serverConfig && config.serverConfig.baseUrl) ? config.serverConfig.baseUrl : '',
  timeout: 10000, // 请求超时时间

  /**
   * 发送请求
   * @param {string} url - 请求URL
   * @param {string} method - 请求方法
   * @param {Object} data - 请求数据
   * @param {Object} header - 请求头
   * @returns {Promise}
   */
  async send(url, method = 'GET', data = {}, header = {}) {
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    try {
      // 合并基础URL
      const isAbsolute = /^https?:\/\//i.test(String(url || ''));
      if (!isAbsolute && !this.baseURL) {
        wx.showToast({
          title: '未配置后端地址',
          icon: 'none'
        });
        return Promise.reject({ message: 'baseUrl is empty' });
      }
      const base = String(this.baseURL || '').replace(/\/$/, '');
      const path = String(url || '');
      const fullUrl = isAbsolute ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

      // 准备请求参数
      const requestOptions = {
        url: fullUrl,
        method,
        data,
        header: {
          'content-type': 'application/json',
          ...header
        },
        timeout: this.timeout
      };

      // 添加token
      const token = wx.getStorageSync('token');
      if (token) {
        requestOptions.header['Authorization'] = `Bearer ${token}`;
      }

      // 发送请求
      const res = await new Promise((resolve, reject) => {
        wx.request({
          ...requestOptions,
          success: resolve,
          fail: reject
        });
      });

      // 检查响应
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (res.data && typeof res.data === 'object' && Object.prototype.hasOwnProperty.call(res.data, 'success')) {
          if (res.data.success) return res.data.data;
          wx.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          });
          return Promise.reject(res.data);
        }
        return res.data;
      } else if (res.statusCode === 401) {
        // 未授权，跳转到登录页
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        wx.navigateTo({
          url: '/pages/login/login'
        });
        return Promise.reject({ message: '未授权' });
      } else {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        return Promise.reject({ message: '网络错误' });
      }
    } catch (error) {
      console.error('请求异常:', error);
      wx.showToast({
        title: '请求异常',
        icon: 'none'
      });
      return Promise.reject(error);
    } finally {
      // 隐藏加载提示
      wx.hideLoading();
    }
  },

  // GET请求
  get(url, data = {}, header = {}) {
    return this.send(url, 'GET', data, header);
  },

  // POST请求
  post(url, data = {}, header = {}) {
    return this.send(url, 'POST', data, header);
  },

  // PUT请求
  put(url, data = {}, header = {}) {
    return this.send(url, 'PUT', data, header);
  },

  // DELETE请求
  delete(url, data = {}, header = {}) {
    return this.send(url, 'DELETE', data, header);
  }
};

module.exports = request;
