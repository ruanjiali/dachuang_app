const DEFAULT_MAX_BYTES = 4 * 1024 * 1024 - 32 * 1024;

function getFileSize(filePath) {
  const fs = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    fs.getFileInfo({
      filePath,
      success: (res) => resolve(Number(res.size || 0)),
      fail: reject
    });
  });
}

function compressImage(filePath, quality) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

async function ensureUnderMaxSize(filePath, maxBytes) {
  let current = filePath;
  let size = await getFileSize(current);
  if (size <= maxBytes) return current;

  const qualities = [80, 60, 40];
  for (const q of qualities) {
    current = await compressImage(current, q);
    size = await getFileSize(current);
    if (size <= maxBytes) return current;
  }
  throw new Error('IMAGE_TOO_LARGE');
}

function chooseImages(options) {
  const count = options && options.count ? options.count : 1;
  const sizeType = (options && options.sizeType) || ['compressed'];
  const sourceType = (options && options.sourceType) || ['album'];
  const maxBytes = options && options.maxBytes ? options.maxBytes : DEFAULT_MAX_BYTES;
  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count,
      sizeType,
      sourceType,
      success: async (res) => {
        try {
          const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [];
          const nextPaths = [];
          for (const p of paths) {
            const safe = await ensureUnderMaxSize(p, maxBytes);
            nextPaths.push(safe);
          }
          resolve({
            ...res,
            tempFilePaths: nextPaths
          });
        } catch (e) {
          if (String(e && e.message) === 'IMAGE_TOO_LARGE') {
            wx.showModal({
              title: '图片过大',
              content: '当前图片超过4MB限制，请选择更小的图片或在相册中压缩后再试。',
              showCancel: false
            });
          } else {
            wx.showToast({ title: '处理图片失败', icon: 'none' });
          }
          reject(e);
        }
      },
      fail: reject
    });
  });
}

async function pickSingleFromAlbum() {
  const res = await chooseImages({ count: 1, sizeType: ['compressed'], sourceType: ['album'] });
  return res && res.tempFilePaths ? res.tempFilePaths[0] : '';
}

async function pickSingleFromCamera() {
  const res = await chooseImages({ count: 1, sizeType: ['compressed'], sourceType: ['camera'] });
  return res && res.tempFilePaths ? res.tempFilePaths[0] : '';
}

async function pickSingleFromAlbumOrCamera() {
  const res = await chooseImages({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] });
  return res && res.tempFilePaths ? res.tempFilePaths[0] : '';
}

module.exports = {
  chooseImages,
  pickSingleFromAlbum,
  pickSingleFromCamera,
  pickSingleFromAlbumOrCamera
};
