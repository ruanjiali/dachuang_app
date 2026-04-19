let lastToastAt = 0;

function safeGetUrl(options) {
  if (!options || typeof options !== 'object') return '';
  return String(options.url || '');
}

function shouldToast() {
  const now = Date.now();
  if (now - lastToastAt < 2500) return false;
  lastToastAt = now;
  return true;
}

function wrapWxMethod(methodName) {
  const original = wx[methodName];
  if (typeof original !== 'function') return;
  if (original.__wrapped__) return;

  const wrapped = function (options) {
    const opts = options && typeof options === 'object' ? { ...options } : {};
    const url = safeGetUrl(opts);
    const userFail = opts.fail;
    const userComplete = opts.complete;

    opts.fail = function (err) {
      const payload = {
        method: methodName,
        url,
        errMsg: err && err.errMsg ? err.errMsg : String(err || ''),
        time: new Date().toISOString()
      };
      try {
        wx.setStorageSync('lastNetworkFail', payload);
      } catch (e) {}
      console.error('network_fail', payload);
      if (shouldToast()) {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none',
          duration: 2000
        });
      }
      if (typeof userFail === 'function') userFail(err);
    };

    opts.complete = function (res) {
      if (typeof userComplete === 'function') userComplete(res);
    };

    return original.call(wx, opts);
  };

  wrapped.__wrapped__ = true;
  wx[methodName] = wrapped;
}

function installNetworkTrace() {
  wrapWxMethod('request');
  wrapWxMethod('uploadFile');
  wrapWxMethod('downloadFile');
}

module.exports = {
  installNetworkTrace
};

