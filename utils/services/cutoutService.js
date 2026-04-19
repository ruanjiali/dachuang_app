// 抠图服务模块
const request = require('../request');

module.exports = {
  /**
   * 上传图片到服务器
   * @param {string} base64Data - Base64格式的图片数据
   * @returns {Promise<Object>} 返回包含图片URL的对象
   */
  async uploadImage(base64Data) {
    try {
      // 确保移除Base64前缀（如果有）
      let cleanBase64 = base64Data;
      if (base64Data.startsWith('data:image')) {
        cleanBase64 = base64Data.split(',')[1];
      }
      
      // 调用上传接口
      const result = await request.post('/upload/image', {
        image: cleanBase64,
        type: 'cutout_result',
        timestamp: Date.now()
      }, {
        'content-type': 'application/json'
      });
      
      return result;
    } catch (error) {
      console.error('图片上传失败:', error);
      throw error;
    }
  },
  
  /**
   * 获取图片URL
   * @param {string} imageId - 图片ID或标识符
   * @returns {string} 返回完整的图片访问URL
   */
  getImageUrl(imageId) {
    // 返回完整的图片访问URL
    return `${request.baseURL}/images/${imageId}`;
  }
};