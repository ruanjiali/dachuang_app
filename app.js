// app.js
App({
  onLaunch() {
    try {
      const { installNetworkTrace } = require('./utils/netTrace')
      installNetworkTrace()
    } catch (e) {}

    // 展示本地存储能力
    // logs 数组限制长度，防止无限增长
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs.slice(0, 100))

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })

    const username = wx.getStorageSync('username') || 'anonymous'
    const legacyCollected = wx.getStorageSync('collectedClothes') || []
    const userCollectedKey = `collectedClothes_${username}`
    const userCollected = wx.getStorageSync(userCollectedKey) || []
    if (Array.isArray(legacyCollected) && legacyCollected.length > 0 && (!Array.isArray(userCollected) || userCollected.length === 0)) {
      wx.setStorageSync(userCollectedKey, legacyCollected)
      wx.removeStorageSync('collectedClothes')
    }

    const storedClothes = wx.getStorageSync('clothesList') || []
    if (Array.isArray(storedClothes) && storedClothes.length > 0) {
      this.globalData.clothesList = storedClothes
    } else {
      this.globalData.clothesList = []
    }
  },
  onError(err) {
    try {
      wx.setStorageSync('lastAppError', {
        type: 'onError',
        errMsg: String(err || ''),
        time: new Date().toISOString()
      })
    } catch (e) {}
  },
  onUnhandledRejection(res) {
    try {
      const reason = res && res.reason ? res.reason : res
      wx.setStorageSync('lastAppError', {
        type: 'onUnhandledRejection',
        errMsg: reason && reason.errMsg ? String(reason.errMsg) : String(reason || ''),
        time: new Date().toISOString()
      })
    } catch (e) {}
  },
  globalData: {
    userInfo: null,
    clothesList: []
  }
})
