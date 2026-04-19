const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 拼接URL
 * @param {string} baseUrl - 基础URL
 * @param {string} path - 路径
 * @returns {string} 拼接后的URL
 */
const joinUrl = (baseUrl, path) => {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const p = String(path || '');
  if (!p) return base;
  if (p.startsWith('http')) return p;
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

module.exports = {
  formatTime,
  joinUrl
}
