const config = require('../../utils/config');
const { pickSingleFromAlbum, pickSingleFromCamera } = require('../../utils/imagePicker');
const { joinUrl } = require('../../utils/util');

Page({
  data: {
    sourceImage: '',
    resultImage: '',
    isImageGenerated: false,
    processing: false,
    statusText: '',
    lastError: '',
    attemptLog: [],
    showAdvanced: false
  },

  onLoad() {
    this.setData({
      showAdvanced: !!(config.serverConfig && config.serverConfig.cutoutWebUrl)
    });
  },

  chooseImage() {
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照'],
      success: (res) => {
        if (res.tapIndex === 0) this.chooseImageFromAlbum();
        if (res.tapIndex === 1) this.takePhoto();
      }
    });
  },

  chooseImageFromAlbum() {
    pickSingleFromAlbum()
      .then((tempFilePath) => {
        if (!tempFilePath) return;
        this.setData({
          sourceImage: tempFilePath,
          resultImage: '',
          isImageGenerated: false,
          lastError: '',
          statusText: '图片已选择',
          attemptLog: []
        });
      })
      .catch((err) => {
        if (err && err.errMsg !== 'chooseImage:fail cancel') {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
      });
  },

  takePhoto() {
    pickSingleFromCamera()
      .then((tempFilePath) => {
        if (!tempFilePath) return;
        this.setData({
          sourceImage: tempFilePath,
          resultImage: '',
          isImageGenerated: false,
          lastError: '',
          statusText: '照片已拍摄',
          attemptLog: []
        });
      })
      .catch((err) => {
        if (err && err.errMsg !== 'chooseImage:fail cancel') {
          wx.showToast({ title: '拍照失败', icon: 'none' });
        }
      });
  },

  appendAttempt(message) {
    const time = new Date().toLocaleTimeString();
    const current = Array.isArray(this.data.attemptLog) ? this.data.attemptLog : [];
    this.setData({
      attemptLog: [...current.slice(-6), `${time} ${message}`]
    });
  },

  parsePayload(raw) {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return { raw };
      }
    }
    if (raw && typeof raw === 'object') return raw;
    return {};
  },

  extractErr(payload) {
    const errCode = Number((payload && (payload.err_code || payload.errcode || payload.code)) || 0);
    const errMsg = String((payload && (payload.errMsg || payload.errmsg || payload.message || payload.msg || payload.error)) || '');
    return { errCode, errMsg };
  },

  extractResult(payload, baseUrl) {
    const candidate =
      (payload && payload.data && (payload.data.url || payload.data.resultUrl || payload.data.result_url || payload.data.imageUrl || payload.data.image_url || payload.data.fileUrl || payload.data.file_url || payload.data.output || payload.data.result || payload.data.image)) ||
      (payload && (payload.url || payload.resultUrl || payload.result_url || payload.imageUrl || payload.image_url || payload.fileUrl || payload.file_url || payload.output || payload.result || payload.image)) ||
      '';
    if (!candidate) return '';
    const value = String(candidate);
    if (value.startsWith('http') || value.startsWith('data:image')) return value;
    return `${String(baseUrl || '').replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
  },

  extractTaskId(payload) {
    return (
      (payload && payload.data && (payload.data.taskId || payload.data.task_id || payload.data.jobId || payload.data.job_id || payload.data.id)) ||
      (payload && (payload.taskId || payload.task_id || payload.jobId || payload.job_id || payload.id)) ||
      ''
    );
  },

  async uploadByFile(url) {
    return await new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath: this.data.sourceImage,
        name: 'image',
        formData: { timestamp: String(Date.now()) },
        success: resolve,
        fail: reject
      });
    });
  },

  async uploadByBase64(url) {
    const fs = wx.getFileSystemManager();
    const base64Data = await new Promise((resolve, reject) => {
      fs.readFile({
        filePath: this.data.sourceImage,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
    return await new Promise((resolve, reject) => {
      wx.request({
        url,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: {
          image: base64Data,
          imageBase64: base64Data,
          timestamp: Date.now()
        },
        success: (res) => resolve({
          statusCode: res.statusCode,
          data: res.data
        }),
        fail: reject
      });
    });
  },

  async pollResult(resultUrl, taskId, baseUrl) {
    const interval = Number((config.serverConfig && config.serverConfig.miniCutoutPollIntervalMs) || 1500);
    const timeout = Number((config.serverConfig && config.serverConfig.miniCutoutPollTimeoutMs) || 40000);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${resultUrl}${resultUrl.includes('?') ? '&' : '?'}taskId=${encodeURIComponent(taskId)}`,
          method: 'GET',
          success: resolve,
          fail: reject
        });
      });
      const payload = this.parsePayload(res.data);
      const { errCode, errMsg } = this.extractErr(payload);
      if (errCode === 42001 || errMsg.includes('access_token expired')) {
        throw new Error('WECHAT_ACCESS_TOKEN_EXPIRED');
      }
      const finalUrl = this.extractResult(payload, baseUrl);
      if (finalUrl) return finalUrl;
      const state = String(
        (payload && payload.data && (payload.data.status || payload.data.state)) ||
        (payload && (payload.status || payload.state)) ||
        ''
      ).toLowerCase();
      if (state && ['failed', 'fail', 'error', 'canceled', 'cancelled'].includes(state)) {
        throw new Error(errMsg || '异步任务失败');
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error('抠图任务超时');
  },

  async startCutout() {
    if (this.data.processing) return;
    if (!this.data.sourceImage) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    const baseUrl = (config.serverConfig && config.serverConfig.baseUrl) ? config.serverConfig.baseUrl : '';
    const miniCutoutUrl = (config.serverConfig && config.serverConfig.miniCutoutUrl) ? config.serverConfig.miniCutoutUrl : '';
    if (!baseUrl || !miniCutoutUrl) {
      wx.showModal({
        title: '未配置抠图服务',
        content: '请在 utils/config.local.js 中配置 serverConfig.baseUrl 与 serverConfig.miniCutoutUrl 后再试。',
        showCancel: false
      });
      return;
    }
    const uploadUrl = joinUrl(baseUrl, miniCutoutUrl);
    const jsonUrl = joinUrl(baseUrl, (config.serverConfig && config.serverConfig.miniCutoutJsonUrl) || miniCutoutUrl);
    const resultUrl = joinUrl(baseUrl, (config.serverConfig && config.serverConfig.miniCutoutResultUrl) || '/api/mini/remove-bg/result');

    this.setData({
      processing: true,
      resultImage: '',
      isImageGenerated: false,
      lastError: '',
      statusText: '正在抠图...',
      attemptLog: []
    });
    wx.showLoading({ title: '正在抠图...', mask: true });

    try {
      this.appendAttempt(`方案A 文件上传：${uploadUrl}`);
      let res = await this.uploadByFile(uploadUrl);
      let payload = this.parsePayload(res.data);
      let { errCode, errMsg } = this.extractErr(payload);
      if (errCode === 42001 || errMsg.includes('access_token expired')) throw new Error('WECHAT_ACCESS_TOKEN_EXPIRED');

      let finalUrl = this.extractResult(payload, baseUrl);
      if (!finalUrl) {
        const taskIdA = this.extractTaskId(payload);
        if (taskIdA) {
          this.appendAttempt(`方案A返回任务ID：${taskIdA}`);
          finalUrl = await this.pollResult(resultUrl, taskIdA, baseUrl);
        }
      }

      if (!finalUrl) {
        this.appendAttempt(`方案B Base64 JSON：${jsonUrl}`);
        res = await this.uploadByBase64(jsonUrl);
        payload = this.parsePayload(res.data);
        ({ errCode, errMsg } = this.extractErr(payload));
        if (errCode === 42001 || errMsg.includes('access_token expired')) throw new Error('WECHAT_ACCESS_TOKEN_EXPIRED');
        finalUrl = this.extractResult(payload, baseUrl);
        if (!finalUrl) {
          const taskIdB = this.extractTaskId(payload);
          if (taskIdB) {
            this.appendAttempt(`方案B返回任务ID：${taskIdB}`);
            finalUrl = await this.pollResult(resultUrl, taskIdB, baseUrl);
          }
        }
        if (!finalUrl) {
          throw new Error(errMsg || `服务返回异常（HTTP ${res.statusCode || 'unknown'}）`);
        }
      }

      const displayImage = await this.normalizeResultImage(finalUrl);
      this.setData({
        resultImage: displayImage || finalUrl,
        isImageGenerated: true,
        statusText: '抠图完成'
      });
    } catch (error) {
      const message = String(error && error.message ? error.message : error || '未知错误');
      if (message === 'WECHAT_ACCESS_TOKEN_EXPIRED') {
        wx.showModal({
          title: '后端微信令牌已过期',
          content: '后端调用微信安全接口的 access_token 已过期，请后端刷新 access_token 后重试。',
          showCancel: false
        });
      } else {
        wx.showModal({
          title: '抠图失败',
          content: `请检查后端接口返回格式或切换备用方案。\n${message}`,
          showCancel: false
        });
      }
      this.setData({
        lastError: message,
        statusText: '抠图失败'
      });
    } finally {
      wx.hideLoading();
      this.setData({ processing: false });
    }
  },

  requestImageToTemp(url) {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode !== 200 || !res.data) {
            reject(new Error(`拉取结果图失败，状态码：${res.statusCode}`));
            return;
          }
          const fs = wx.getFileSystemManager();
          const filePath = this.getWritableFilePath(`cutout_result_${Date.now()}.png`);
          fs.writeFile({
            filePath,
            data: res.data,
            encoding: 'binary',
            success: () => resolve(filePath),
            fail: (err) => reject(new Error(err && err.errMsg ? err.errMsg : '写入临时文件失败'))
          });
        },
        fail: (err) => reject(new Error(err && err.errMsg ? err.errMsg : '请求结果图失败'))
      });
    });
  },

  async normalizeResultImage(url) {
    const value = String(url || '');
    if (!value) return '';
    if (value.startsWith('wxfile://') || value.startsWith(wx.env.USER_DATA_PATH)) return value;
    if (value.startsWith('data:image')) {
      return await this.writeBase64ToTempFile(value);
    }
    if (value.startsWith('http')) {
      try {
        return await this.requestImageToTemp(value);
      } catch (e) {
        this.appendAttempt(`结果图本地化失败，回退远程URL：${e && e.message ? e.message : e}`);
        return value;
      }
    }
    return value;
  },

  onImageError() {
    this.setData({
      lastError: '结果图加载失败，请检查返回图片地址',
      statusText: '图片加载失败'
    });
  },

  getWritableFilePath(fileName) {
    return `${wx.env.USER_DATA_PATH}/${fileName}`;
  },

  writeBase64ToTempFile(dataUrl) {
    const fs = wx.getFileSystemManager();
    const base64 = String(dataUrl).includes(',') ? String(dataUrl).split(',')[1] : String(dataUrl);
    const filePath = this.getWritableFilePath(`cutout_${Date.now()}.png`);
    return new Promise((resolve, reject) => {
      fs.writeFile({
        filePath,
        data: base64,
        encoding: 'base64',
        success: () => resolve(filePath),
        fail: reject
      });
    });
  },

  downloadToTemp(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            resolve(res.tempFilePath);
            return;
          }
          reject(new Error(`下载失败，状态码：${res.statusCode}`));
        },
        fail: reject
      });
    });
  },

  ensureAlbumPermission() {
    return new Promise((resolve, reject) => {
      const authorizeAlbum = () => {
        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => resolve(),
          fail: () => {
            wx.showModal({
              title: '需要授权',
              content: '请在设置中允许“保存到相册”权限后重试。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  reject(new Error('用户取消授权'));
                  return;
                }
                wx.openSetting({
                  success: (openRes) => {
                    const ok = openRes.authSetting && openRes.authSetting['scope.writePhotosAlbum'];
                    if (ok) resolve();
                    else reject(new Error('未授予相册权限'));
                  },
                  fail: (err) => reject(new Error(err && err.errMsg ? err.errMsg : '打开设置失败'))
                });
              }
            });
          }
        });
      };

      wx.getSetting({
        success: (settingRes) => {
          const hasAuth = settingRes.authSetting && settingRes.authSetting['scope.writePhotosAlbum'];
          if (hasAuth) {
            resolve();
            return;
          }
          authorizeAlbum();
        },
        fail: (err) => {
          authorizeAlbum();
          this.appendAttempt(`读取权限失败，已降级到直接授权：${err && err.errMsg ? err.errMsg : 'unknown'}`);
        }
      });
    });
  },

  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject
      });
    });
  },

  async saveResultToAlbum() {
    if (!this.data.resultImage) return;
    try {
      wx.showLoading({ title: '正在保存...', mask: true });
      let localPath = this.data.resultImage;
      if (localPath.startsWith('http')) {
        localPath = await this.downloadToTemp(localPath);
      } else if (localPath.startsWith('data:image')) {
        localPath = await this.writeBase64ToTempFile(localPath);
      }
      await this.ensureAlbumPermission();
      await this.saveToAlbum(localPath);
      this.setData({ statusText: '已保存到相册' });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      const message = String(error && error.message ? error.message : error || '保存失败');
      this.setData({
        lastError: message,
        statusText: '保存失败'
      });
      wx.showModal({
        title: '保存失败',
        content: `请确认相册权限和图片地址可访问。\n${message}`,
        showCancel: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  openCutoutWeb() {
    const url = config.serverConfig && config.serverConfig.cutoutWebUrl;
    if (!url) {
      wx.showToast({ title: '未配置备用网页抠图地址', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/web-view/web-view?url=${encodeURIComponent(url)}`
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
