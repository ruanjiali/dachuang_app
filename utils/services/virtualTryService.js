/**
 * 虚拟试穿服务
 * 支持调用后端 Gradio 服务进行真实虚拟换衣
 */
const appConfig = require('../../config');

/**
 * 获取虚拟试穿服务地址
 */
function getVirtualTryUrl() {
  const serverConfig = appConfig && appConfig.serverConfig ? appConfig.serverConfig : {};
  const baseUrl = serverConfig.outfitMcpBaseUrl || serverConfig.baseUrl || '';
  const virtualTryUrl = serverConfig.virtualTryUrl || '';
  // 如果已配置完整URL直接返回
  if (virtualTryUrl && (virtualTryUrl.startsWith('http://') || virtualTryUrl.startsWith('https://'))) {
    return virtualTryUrl;
  }
  // 否则拼接
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/virtual-try` : '';
}

/**
 * 虚拟试穿API
 * @param {string} personImagePath - 人物图片路径（本地临时文件）
 * @param {object} clothesInfo - 服装信息 {id, name, category, image}
 * @returns {Promise<{success: boolean, resultImage?: string, message?: string}>}
 */
function virtualTryOn(personImagePath, clothesInfo) {
  return new Promise((resolve, reject) => {
    const virtualTryUrl = getVirtualTryUrl();

    if (!virtualTryUrl) {
      reject(new Error('VIRTUAL_TRY_URL_NOT_CONFIGURED'));
      return;
    }

    // 如果没有人物图片
    if (!personImagePath) {
      reject(new Error('PERSON_IMAGE_REQUIRED'));
      return;
    }

    // 读取图片为base64
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: personImagePath,
      encoding: 'base64',
      success: (res) => {
        const imageBase64 = res.data;
        const mime = personImagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

        // 调用虚拟试穿API
        wx.request({
          url: virtualTryUrl,
          method: 'POST',
          timeout: 60000,
          header: {
            'Content-Type': 'application/json'
          },
          data: {
            person_image: `data:${mime};base64,${imageBase64}`,
            clothes_id: clothesInfo ? clothesInfo.id : '',
            clothes_name: clothesInfo ? clothesInfo.name : '',
            clothes_category: clothesInfo ? clothesInfo.category : ''
          },
          success: (response) => {
            if (response.statusCode === 200 && response.data) {
              if (response.data.success && response.data.result_image) {
                resolve({
                  success: true,
                  resultImage: response.data.result_image,
                  message: response.data.message || '虚拟试穿成功'
                });
              } else {
                reject(new Error(response.data.error || 'VIRTUAL_TRY_FAILED'));
              }
            } else {
              reject(new Error('VIRTUAL_TRY_HTTP_ERROR'));
            }
          },
          fail: (err) => {
            if (err.errMsg && err.errMsg.includes('timeout')) {
              reject(new Error('VIRTUAL_TRY_TIMEOUT'));
            } else {
              reject(new Error('VIRTUAL_TRY_NETWORK_ERROR'));
            }
          }
        });
      },
      fail: (err) => {
        reject(new Error('READ_IMAGE_FAILED'));
      }
    });
  });
}

/**
 * 备用虚拟试穿（基于本地规则简化版）
 * 当API不可用时，返回模拟结果
 */
function mockVirtualTryOn(personImagePath, clothesInfo) {
  return new Promise((resolve) => {
    // 模拟处理延迟
    setTimeout(() => {
      resolve({
        success: true,
        resultImage: personImagePath, // 简化版本直接返回原图
        message: '当前服务暂不可用，显示原图作为预览'
      });
    }, 1500);
  });
}

module.exports = {
  virtualTryOn,
  mockVirtualTryOn,
  getVirtualTryUrl
};