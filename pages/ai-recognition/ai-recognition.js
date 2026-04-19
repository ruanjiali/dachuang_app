const config = require('../../utils/config');
const { joinUrl } = require('../../utils/util');

Page({
  data: {
    tempFilePath: '',
    recognitionResult: [],
    loading: false,
    statusText: '',
    useRemote: false
  },

  onLoad() {
    const hasRemote = !!(config.serverConfig && config.serverConfig.baseUrl && config.serverConfig.aiRecognitionUrl);
    this.setData({
      useRemote: hasRemote
    });

    const cached = wx.getStorageSync('tempAiRecognitionImage');
    if (cached) {
      wx.removeStorageSync('tempAiRecognitionImage');
      this.setData({
        tempFilePath: cached,
        recognitionResult: [],
        statusText: '图片已选择'
      });
      this.runRecognition(cached);
    }
  },

  chooseImage() {
    const { pickSingleFromAlbumOrCamera } = require('../../utils/imagePicker');
    pickSingleFromAlbumOrCamera()
      .then(async (tempFilePath) => {
        if (!tempFilePath) return;
        this.setData({
          tempFilePath,
          recognitionResult: [],
          statusText: '图片已选择'
        });
        await this.runRecognition(tempFilePath);
      })
      .catch(() => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      });
  },

  async runRecognition(filePath) {
    this.setData({
      loading: true,
      statusText: '识别中...'
    });
    wx.showLoading({ title: 'AI识别中...', mask: true });
    try {
      let result = [];
      if (this.data.useRemote) {
        result = await this.fetchRecognitionByApi(filePath);
      }
      if (!Array.isArray(result) || result.length === 0) {
        result = await this.buildLocalRecognitionResult(filePath);
      }
      this.setData({
        recognitionResult: result,
        statusText: `识别完成，共${result.length}件`
      });
    } catch (error) {
      const fallback = await this.buildLocalRecognitionResult(filePath);
      this.setData({
        recognitionResult: fallback,
        statusText: '远程识别失败，已使用本地识别结果'
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  analyzeImage(filePath) {
    const size = 64;
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
        success: (info) => {
          const srcPath = info && (info.path || info.tempFilePath) ? (info.path || info.tempFilePath) : filePath;
          const ctx = wx.createCanvasContext('analyzeCanvas', this);
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(srcPath, 0, 0, size, size);
          ctx.draw(false, () => {
            wx.canvasGetImageData({
              canvasId: 'analyzeCanvas',
              x: 0,
              y: 0,
              width: size,
              height: size,
              success: (res) => {
                const data = res.data || [];
                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;
                let satSum = 0;
                for (let i = 0; i < data.length; i += 4) {
                  const rr = data[i];
                  const gg = data[i + 1];
                  const bb = data[i + 2];
                  const aa = data[i + 3];
                  if (aa < 16) continue;
                  r += rr;
                  g += gg;
                  b += bb;
                  const max = Math.max(rr, gg, bb);
                  const min = Math.min(rr, gg, bb);
                  const sat = max === 0 ? 0 : (max - min) / max;
                  satSum += sat;
                  count += 1;
                }
                if (!count) {
                  resolve(null);
                  return;
                }
                const avgR = r / count;
                const avgG = g / count;
                const avgB = b / count;
                const brightness = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
                const saturation = satSum / count;
                resolve({
                  width: info.width,
                  height: info.height,
                  brightness,
                  saturation,
                  rgb: { r: avgR, g: avgG, b: avgB }
                });
              },
              fail: reject
            });
          });
        },
        fail: reject
      });
    });
  },

  buildItemName(type) {
    if (type === 'dress') return '连衣裙';
    if (type === 'outer') return '外套';
    if (type === 'bottom') return '下装';
    return '上装';
  },

  guessSeason(feature) {
    if (!feature) return '四季';
    if (feature.brightness >= 0.75) return '夏季';
    if (feature.brightness <= 0.45) return '秋冬';
    return '春秋';
  },

  guessStyle(feature) {
    if (!feature) return '休闲';
    const { r, g, b } = feature.rgb || {};
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (feature.saturation <= 0.18) return '简约';
    if (feature.brightness <= 0.38) return '街头';
    if (max === r && r - g > 18) return '甜美';
    if (max === b && b - g > 12) return '商务';
    if (max === g && g - r > 12) return '运动';
    if (min < 60 && max > 170) return '复古';
    return '休闲';
  },

  mapStyleToCategory(style) {
    if (style === '商务') return '商务';
    if (style === '运动') return '运动';
    if (style === '街头') return '街头';
    if (style === '甜美') return '甜美';
    if (style === '复古') return '复古';
    return '休闲';
  },

  fetchRecognitionByApi(filePath) {
    const baseUrl = config.serverConfig && config.serverConfig.baseUrl;
    const apiPath = config.serverConfig && config.serverConfig.aiRecognitionUrl;
    const url = joinUrl(baseUrl, apiPath);
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'image',
        formData: { timestamp: String(Date.now()) },
        success: (res) => {
          let payload = res.data;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch (e) {
              payload = {};
            }
          }
          const items = (payload && (payload.items || payload.data || payload.result)) || [];
          if (Array.isArray(items)) {
            const normalized = items.map((item, index) => ({
              id: Date.now() + index,
              name: item.name || '识别单品',
              season: item.season || '四季',
              style: item.style || '日常',
              fit: item.fit || '常规',
              description: item.description || '建议补充面料和颜色细节',
              image: item.image || filePath
            }));
            resolve(normalized);
            return;
          }
          reject(new Error('invalid api result'));
        },
        fail: reject
      });
    });
  },

  chooseRecognizeMode(filePath, feature) {
    const ratio = feature && feature.width && feature.height ? feature.height / feature.width : 1.5;
    const defaultMode = ratio >= 1.35 ? 'dress' : 'set';
    const options = ['上装', '下装', '外套', '连衣裙', '套装(上装+下装)'];
    return new Promise((resolve) => {
      wx.showActionSheet({
        itemList: options,
        success: (res) => {
          const map = ['top', 'bottom', 'outer', 'dress', 'set'];
          resolve(map[res.tapIndex] || defaultMode);
        },
        fail: () => resolve(defaultMode)
      });
    });
  },

  async buildLocalRecognitionResult(filePath) {
    let feature = null;
    try {
      feature = await this.analyzeImage(filePath);
    } catch (e) {
      feature = null;
    }
    const season = this.guessSeason(feature);
    const style = this.guessStyle(feature);
    const fit = feature && feature.saturation >= 0.45 ? '宽松' : '常规';
    const mode = await this.chooseRecognizeMode(filePath, feature);
    const base = {
      season,
      style,
      fit,
      description: '可在结果里点“编辑”调整风格/季节/版型后保存到衣橱。',
      image: filePath
    };
    if (mode === 'set') {
      return [
        { id: Date.now(), name: this.buildItemName('top'), ...base },
        { id: Date.now() + 1, name: this.buildItemName('bottom'), ...base }
      ];
    }
    return [
      { id: Date.now(), name: this.buildItemName(mode), ...base }
    ];
  },

  editItem(e) {
    const id = Number(e.currentTarget.dataset.id);
    const index = this.data.recognitionResult.findIndex(item => Number(item.id) === id);
    if (index < 0) return;
    const seasons = ['四季', '夏季', '春秋', '秋冬'];
    wx.showActionSheet({
      itemList: ['改季节', '改风格'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showActionSheet({
            itemList: seasons,
            success: (s) => {
              const season = seasons[s.tapIndex] || seasons[0];
              const list = [...this.data.recognitionResult];
              list[index] = { ...list[index], season };
              this.setData({ recognitionResult: list });
            }
          });
        }
        if (res.tapIndex === 1) {
          const styles = ['休闲', '商务', '运动', '复古', '街头', '甜美', '简约'];
          wx.showActionSheet({
            itemList: styles,
            success: (s) => {
              const style = styles[s.tapIndex] || styles[0];
              const list = [...this.data.recognitionResult];
              list[index] = { ...list[index], style };
              this.setData({ recognitionResult: list });
            }
          });
        }
      }
    });
  },

  deleteImage(e) {
    const id = e.currentTarget.dataset.id;
    if (id === undefined || id === null) {
      this.setData({
        tempFilePath: '',
        recognitionResult: [],
        statusText: ''
      });
      return;
    }
    const recognitionResult = this.data.recognitionResult.filter(item => Number(item.id) !== Number(id));
    this.setData({
      recognitionResult,
      statusText: recognitionResult.length ? `剩余${recognitionResult.length}件` : '已清空识别结果'
    });
  },

  saveAllToCloset() {
    if (!this.data.recognitionResult.length) {
      wx.showToast({
        title: '暂无可保存内容',
        icon: 'none'
      });
      return;
    }
    const app = getApp();
    const current = Array.isArray(app.globalData && app.globalData.clothesList) ? app.globalData.clothesList : (wx.getStorageSync('clothesList') || []);
    const mapped = this.data.recognitionResult.map((item, index) => ({
      id: Date.now() + index,
      name: item.name,
      image: item.image || this.data.tempFilePath,
      category: this.mapStyleToCategory(item.style),
      season: item.season || '四季',
      style: item.style || '休闲',
      price: 99,
      userCollections: {},
      isCollected: false
    }));
    const merged = [...mapped, ...current];
    if (app.globalData) app.globalData.clothesList = merged;
    wx.setStorageSync('clothesList', merged);
    wx.showToast({
      title: `已保存${mapped.length}件`,
      icon: 'success'
    });
  },

  closeModal() {
    wx.navigateBack();
  }
});
