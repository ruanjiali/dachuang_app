const { getOutfitAdvice, resetChatHistory } = require('../../utils/services/outfitAdvisorService.js');
const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MCP_OUTFIT_PATH = '/api/mini/outfit-advisor-mcp';
const MCP_OUTFIT_STREAM_PATH = '/api/mini/outfit-advisor-mcp-stream';
const GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/reverse';
const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const appConfig = require('../../utils/config');
const IMAGE_GUIDE_TEXT = '我会再给您生成一张搭配效果图，方便您直观看到穿搭建议。';
const QWEN_SYSTEM_PROMPT = `你是一位专业的个人形象顾问，拥有 10 年以上时尚造型经验，熟悉色彩搭配理论（四季色彩、色轮配色）、服装版型与身材管理、当季流行趋势以及不同场合的着装礼仪。

你的分析风格：
- 专业、细致、有温度，不使用模糊词汇
- 给出具体、可执行的建议（如推荐具体单品、颜色代号、品牌参考）
- 结合用户提供的个人信息（身材特征、天气、季节、场合）给出量身定制的方案
- 必要时指出穿搭中的问题，但语气温和建设性
- 输出结构清晰，使用 Markdown 分段呈现

分析框架（每次必须覆盖）：
1. **整体风格定位** — 判断当前穿搭风格标签（如：休闲、职场、街头、法式简约等）
2. **色彩搭配分析** — 主色/辅色/点缀色比例，色彩协调性评分（1-10）
3. **版型与身材适配** — 结合用户身材数据，分析当前穿搭的扬长避短效果
4. **场合适配度** — 当前穿搭在目标场合的合适程度
5. **天气 & 季节适配** — 面料、厚薄、层次感是否符合天气/季节
6. **具体改进建议** — 分优先级（必改 / 可选 / 加分项）给出 3-5 条可落地建议
7. **完整搭配方案推荐** — 给出 1-2 套在现有单品基础上的优化方案，或全新搭配思路`;

Page({
  /**
   * 页面的初始数据
   */
  data: {
    messages: [
      {
        id: 1,
        type: 'system',
        content: '你好！我是你的AI穿搭顾问。请问有什么可以帮你？例如：\n• 今天天气冷，我应该穿什么？\n• 面试应该穿什么？\n• 春天适合什么颜色的搭配？'
      }
    ],
    inputText: '',
    hasInput: false,
    isLoading: false,
    userAvatar: '',
    scrollToMessage: '',
    quickPrompts: [
      '今天 18 度通勤怎么穿？',
      '周末约会想要温柔风',
      '面试穿搭要注意什么？'
    ],
    lastQuestion: '',
    showProfilePanel: false,
    imagePath: '',
    useDashscope: true,
    dashscopeApiKey: '',
    dashscopeModel: 'qwen-vl-max',
    streamOutput: true,
    showHistoryPanel: false,
    sessions: [],
    currentSessionId: '',
    profile: {
      gender: '女',
      age: '20岁',
      height: '160cm',
      weight: '58kg',
      bodyType: '梨形身材',
      city: '北京',
      season: '',
      weather: '',
      temperature: '',
      occasion: '周末日常外出',
      stylePref: '简约休闲',
      extra: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const localKeyFromConfig = (appConfig && (appConfig.dashscopeApiKey || appConfig.DASHSCOPE_API_KEY)) ? String(appConfig.dashscopeApiKey || appConfig.DASHSCOPE_API_KEY) : '';
    const storedKey = String(wx.getStorageSync('dashscopeApiKey') || '');
    const initialKey = String(localKeyFromConfig || storedKey || '').trim();
    if (initialKey) {
      this.setData({
        dashscopeApiKey: initialKey
      });
    }

    this.bootstrapSessions();
    this.startNewSession();
    this.checkNetworkStatus();
    this.scrollToBottom();
  },
  
  /**
   * 检查网络状态
   */
  checkNetworkStatus: function() {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        console.log('网络类型:', networkType);
        if (networkType === 'none') {
          wx.showToast({
            title: '当前无网络连接',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('获取网络状态失败:', err);
      }
    });
  },

  /**
   * 处理输入框内容变化
   */
  onInputChange: function (e) {
    const value = (e && e.detail && e.detail.value !== undefined && e.detail.value !== null) ? String(e.detail.value) : '';
    this.setData({
      inputText: value,
      hasInput: value.trim().length > 0 || !!this.data.imagePath
    });
  },

  getHistoryKey: function () {
    const username = wx.getStorageSync('username') || 'anonymous';
    return `advisorChat_${username}`;
  },

  getSessionsKey: function () {
    const username = wx.getStorageSync('username') || 'anonymous';
    return `advisorChatSessions_${username}`;
  },

  bootstrapSessions: function () {
    const sessions = wx.getStorageSync(this.getSessionsKey()) || [];
    const normalizedSessions = Array.isArray(sessions) ? sessions.filter(s => s && s.id && Array.isArray(s.messages)) : [];

    const legacy = wx.getStorageSync(this.getHistoryKey()) || [];
    const legacyMessages = Array.isArray(legacy) ? legacy.filter(item => item && item.id && typeof item.content === 'string' && item.type) : [];
    if (legacyMessages.length) {
      const migrated = {
        id: `legacy_${Date.now()}`,
        title: '历史会话',
        createdAt: Date.now(),
        timeText: this.formatSessionTime(Date.now()),
        messages: legacyMessages.map(item => ({
          id: item.id,
          type: item.type,
          content: String(item.content || '')
        }))
      };
      wx.removeStorageSync(this.getHistoryKey());
      normalizedSessions.unshift(migrated);
    }

    const limited = normalizedSessions.slice(0, 15).map(s => Object.assign({}, s, {
      title: s.title || '历史会话',
      createdAt: Number(s.createdAt || Date.now()),
      timeText: s.timeText || this.formatSessionTime(Number(s.createdAt || Date.now()))
    }));
    this.setData({
      sessions: limited
    });
    wx.setStorageSync(this.getSessionsKey(), limited);
  },

  formatSessionTime: function (ts) {
    const d = new Date(Number(ts || Date.now()));
    const pad = (n) => (n < 10 ? `0${n}` : String(n));
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  buildInitMessages: function () {
    return [
      {
        id: Date.now(),
        type: 'system',
        content: '你好！我是你的AI穿搭顾问。请问有什么可以帮你？例如：\n• 今天天气冷，我应该穿什么？\n• 面试应该穿什么？\n• 春天适合什么颜色的搭配？'
      }
    ];
  },

  computeSessionTitle: function (messages) {
    const list = Array.isArray(messages) ? messages : [];
    const firstUser = list.find(m => m && m.type === 'user' && typeof m.content === 'string' && m.content.trim());
    if (!firstUser) return '新对话';
    const t = firstUser.content.replace(/\s+/g, ' ').trim();
    return t.length > 18 ? `${t.slice(0, 18)}…` : t;
  },

  startNewSession: function () {
    const id = `s_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const initMessages = this.buildInitMessages();
    const session = {
      id,
      title: '新对话',
      createdAt: Date.now(),
      timeText: this.formatSessionTime(Date.now()),
      messages: initMessages.map(item => ({
        id: item.id,
        type: item.type,
        content: String(item.content || '')
      }))
    };
    const sessions = [session].concat(this.data.sessions || []).slice(0, 15);
    this.setData({
      currentSessionId: id,
      sessions,
      showHistoryPanel: false,
      messages: initMessages.map(item => Object.assign({}, item, { nodes: this.formatAnswerNodes(item.content) })),
      inputText: '',
      hasInput: false,
      isLoading: false,
      scrollToMessage: '',
      lastQuestion: '',
      imagePath: ''
    });
    wx.setStorageSync(this.getSessionsKey(), sessions);
    resetChatHistory();
    this.clearTypingTimer();
    this.scrollToBottom();
  },

  previewSelectedImage: function () {
    const imagePath = this.data.imagePath || '';
    if (!imagePath) return;
    wx.previewImage({
      current: imagePath,
      urls: [imagePath]
    });
  },

  previewGeneratedImage: function (e) {
    const url = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.url || '') : '';
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  openHistoryPanel: function () {
    this.setData({
      showHistoryPanel: true
    });
  },

  closeHistoryPanel: function () {
    this.setData({
      showHistoryPanel: false
    });
  },

  switchSession: function (e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const sessions = this.data.sessions || [];
    const found = sessions.find(s => s && s.id === id);
    if (!found) return;
    const nextMessages = (found.messages || []).map(item => {
      if (item && (item.type === 'ai' || item.type === 'system')) {
        return Object.assign({}, item, { nodes: this.formatAnswerNodes(item.content) });
      }
      return item;
    });
    this.setData({
      currentSessionId: id,
      messages: nextMessages,
      showHistoryPanel: false,
      inputText: '',
      hasInput: !!this.data.imagePath,
      isLoading: false,
      scrollToMessage: '',
      lastQuestion: ''
    });
    this.clearTypingTimer();
    this.scrollToBottom();
  },

  deleteSession: function (e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const sessions = (this.data.sessions || []).filter(s => s && s.id !== id);
    this.setData({
      sessions
    });
    wx.setStorageSync(this.getSessionsKey(), sessions);
    if (this.data.currentSessionId === id) {
      this.startNewSession();
    }
  },

  clearAllSessions: function () {
    wx.showModal({
      title: '删除全部历史',
      content: '确定删除所有历史对话吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(this.getSessionsKey());
        this.setData({
          sessions: [],
          showHistoryPanel: false
        });
        this.startNewSession();
      }
    });
  },

  readChatHistory: function () {
    const list = wx.getStorageSync(this.getHistoryKey()) || [];
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && item.id && typeof item.content === 'string' && item.type;
    });
  },

  persistChatHistory: function (messages) {
    const max = 40;
    const normalizedMessages = (messages.length > max ? messages.slice(messages.length - max) : messages).map(item => ({
      id: item.id,
      type: item.type,
      content: String(item.content || ''),
      generatedImageUrl: String(item.generatedImageUrl || '')
    }));
    const sessions = (this.data.sessions || []).map(s => {
      if (!s || s.id !== this.data.currentSessionId) return s;
      return Object.assign({}, s, {
        title: this.computeSessionTitle(normalizedMessages),
        timeText: s.timeText || this.formatSessionTime(Number(s.createdAt || Date.now())),
        messages: normalizedMessages
      });
    });
    this.setData({ sessions });
    wx.setStorageSync(this.getSessionsKey(), sessions);
  },

  getDefaultProfile: function () {
    return {
      gender: '女',
      age: '20岁',
      height: '160cm',
      weight: '58kg',
      bodyType: '梨形身材',
      city: '北京',
      occasion: '周末日常外出',
      stylePref: '简约休闲'
    };
  },

  buildParamSummaryText: function (profileUsed, weatherContext) {
    const p = Object.assign({}, this.getDefaultProfile(), this.data.profile || {}, profileUsed || {});
    const d = this.getDefaultProfile();
    const mark = (val, def) => (String(val || '') === String(def || '') ? '默认' : '真实/用户');
    const hasWeatherApi = !!(weatherContext && weatherContext.weather);
    const weatherText = p.weather || (hasWeatherApi ? (weatherContext.weather.text || '') : '');
    const measuredTemp = hasWeatherApi ? (weatherContext.weather.temp || '') : '';
    const tempText = measuredTemp ? `${measuredTemp}°C` : (p.temperature || '');

    return [
      '【本次采用参数】',
      `- 性别：${p.gender || d.gender}（${mark(p.gender || d.gender, d.gender)}）`,
      `- 年龄：${p.age || d.age}（${mark(p.age || d.age, d.age)}）`,
      `- 身高：${p.height || d.height}（${mark(p.height || d.height, d.height)}）`,
      `- 体重：${p.weight || d.weight}（${mark(p.weight || d.weight, d.weight)}）`,
      `- 身材：${p.bodyType || d.bodyType}（${mark(p.bodyType || d.bodyType, d.bodyType)}）`,
      `- 城市：${p.city || d.city}（${mark(p.city || d.city, d.city)}）`,
      `- 天气：${weatherText || '未获取'}（${hasWeatherApi ? '实时天气API' : '用户/默认'}）`,
      `- 温度：${tempText || '未获取'}（${hasWeatherApi ? '实时实测温度' : '用户/默认'}）`,
      `- 场合：${p.occasion || d.occasion}（${mark(p.occasion || d.occasion, d.occasion)}）`,
      `- 风格偏好：${p.stylePref || d.stylePref}（${mark(p.stylePref || d.stylePref, d.stylePref)}）`
    ].join('\n');
  },

  buildFinalAnswerText: function (adviceText, profileUsed, weatherContext, withImageHint) {
    const intro = this.buildParamSummaryText(profileUsed, weatherContext);
    const body = String(adviceText || '').trim() || '暂时没有获取到建议，请稍后再试。';
    const imageHint = withImageHint ? `\n\n${IMAGE_GUIDE_TEXT}` : '';
    return `${intro}\n\n【详细分析】\n${body}${imageHint}`;
  },

  escapeHtml: function (text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  formatAnswerNodes: function (content) {
    const raw = String(content || '').replace(/\r\n/g, '\n');
    if (!raw) return [];

    const lines = raw.split('\n');
    const nodes = [];
    let inCode = false;
    let codeLines = [];

    const pushParagraph = (text, style) => {
      const t = String(text || '');
      if (!t) return;
      nodes.push({
        name: 'div',
        attrs: {
          style: style || 'font-size: 28rpx; line-height: 44rpx; color: #333; margin: 6rpx 0;'
        },
        children: [{ type: 'text', text: t }]
      });
    };

    const pushDivider = () => {
      nodes.push({
        name: 'div',
        attrs: { style: 'height: 12rpx;' },
        children: []
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = String(line || '').trim();

      if (trimmed.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLines = [];
        } else {
          inCode = false;
          const codeText = codeLines.join('\n');
          nodes.push({
            name: 'pre',
            attrs: {
              style:
                'background:#0f172a; color:#e2e8f0; padding:12rpx; border-radius:12rpx; font-size:24rpx; line-height:36rpx; white-space:pre-wrap;'
            },
            children: [{ type: 'text', text: codeText }]
          });
          pushDivider();
        }
        continue;
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      if (!trimmed) {
        pushDivider();
        continue;
      }

      const h3 = trimmed.match(/^###\s+(.+)$/);
      const h2 = trimmed.match(/^##\s+(.+)$/);
      const h1 = trimmed.match(/^#\s+(.+)$/);
      if (h1 || h2 || h3) {
        const text = (h1 && h1[1]) || (h2 && h2[1]) || (h3 && h3[1]) || '';
        const size = h1 ? 34 : h2 ? 32 : 30;
        pushParagraph(text, `font-size:${size}rpx; line-height:${size + 16}rpx; font-weight:700; color:#111; margin: 10rpx 0 6rpx;`);
        continue;
      }

      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        pushParagraph(`• ${bullet[1]}`, 'font-size: 28rpx; line-height: 44rpx; color: #333; margin: 4rpx 0;');
        continue;
      }

      const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numbered) {
        pushParagraph(`${numbered[1]}. ${numbered[2]}`, 'font-size: 28rpx; line-height: 44rpx; color: #333; margin: 4rpx 0;');
        continue;
      }

      const boldLine = trimmed.match(/^\*\*(.+)\*\*$/);
      if (boldLine) {
        pushParagraph(boldLine[1], 'font-size: 28rpx; line-height: 44rpx; color: #111; font-weight:700; margin: 8rpx 0 4rpx;');
        continue;
      }

      pushParagraph(line);
    }

    if (inCode && codeLines.length) {
      const codeText = codeLines.join('\n');
      nodes.push({
        name: 'pre',
        attrs: {
          style:
            'background:#0f172a; color:#e2e8f0; padding:12rpx; border-radius:12rpx; font-size:24rpx; line-height:36rpx; white-space:pre-wrap;'
        },
        children: [{ type: 'text', text: codeText }]
      });
    }

    return nodes;
  },

  clearTypingTimer: function () {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  },

  startTypingMessage: function (messageId, fullText) {
    this.clearTypingTimer();
    const text = String(fullText || '');
    if (!text) return;

    let idx = 0;
    const step = 18;
    const interval = 40;

    this.typingTimer = setInterval(() => {
      idx = Math.min(text.length, idx + step);
      const nextPart = text.slice(0, idx);
      const messages = (this.data.messages || []).map(item => {
        if (Number(item.id) !== Number(messageId)) return item;
        return Object.assign({}, item, { content: nextPart, nodes: this.formatAnswerNodes(nextPart) });
      });
      this.setData({
        messages,
        scrollToMessage: `message-${messageId}`
      });
      if (idx >= text.length) {
        this.clearTypingTimer();
        this.setData({
          isLoading: false
        }, () => {
          this.persistChatHistory(this.data.messages || []);
          this.scrollToBottom();
        });
      }
    }, interval);
  },

  onQuickPromptTap: function (e) {
    const text = e.currentTarget.dataset.text || '';
    this.setData({
      inputText: text,
      hasInput: String(text).trim().length > 0
    });
  },

  toggleProfilePanel: function () {
    this.setData({
      showProfilePanel: !this.data.showProfilePanel
    });
  },

  onProfileInput: function (e) {
    const field = e.currentTarget.dataset.field || '';
    if (!field) return;
    const value = e.detail.value || '';
    const profile = Object.assign({}, this.data.profile);
    profile[field] = value;
    this.setData({
      profile
    });
  },

  onDashscopeKeyInput: function (e) {
    const value = e && e.detail && e.detail.value ? String(e.detail.value) : '';
    this.setData({
      dashscopeApiKey: value
    });
    wx.setStorageSync('dashscopeApiKey', value);
  },

  buildUserContext: function () {
    const p = this.data.profile || {};
    const lines = [];
    if (p.gender) lines.push(`- 性别：${p.gender}`);
    if (p.age) lines.push(`- 年龄：${p.age}`);
    if (p.height || p.weight) {
      const hw = [];
      if (p.height) hw.push(`身高 ${p.height}`);
      if (p.weight) hw.push(`体重 ${p.weight}`);
      lines.push(`- 体型数据：${hw.join('，')}`);
    }
    if (p.bodyType) lines.push(`- 身材特征：${p.bodyType}`);
    if (p.season) lines.push(`- 当前季节：${p.season}`);
    if (p.weather) lines.push(`- 天气状况：${p.weather}`);
    if (p.temperature) lines.push(`- 气温：${p.temperature}`);
    if (p.occasion) lines.push(`- 穿搭场合：${p.occasion}`);
    if (p.stylePref) lines.push(`- 个人风格偏好：${p.stylePref}`);
    if (p.extra) lines.push(`- 其他补充：${p.extra}`);
    if (!lines.length) return '';
    return ['【我的个人信息】', ...lines].join('\n');
  },

  requestJson: function (url, data, timeout = 12000) {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: 'GET',
        data,
        timeout,
        success: (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP_${res.statusCode}`));
            return;
          }
          resolve(res.data || {});
        },
        fail: reject
      });
    });
  },

  mapWeatherCode: function (code) {
    const c = Number(code);
    if (c === 0) return '晴';
    if ([1, 2].includes(c)) return '多云';
    if (c === 3) return '阴';
    if ([45, 48].includes(c)) return '雾';
    if ([51, 53, 55, 56, 57].includes(c)) return '毛毛雨';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return '下雨';
    if ([71, 73, 75, 77, 85, 86].includes(c)) return '下雪';
    if ([95, 96, 99].includes(c)) return '雷雨';
    return '未知';
  },

  inferSeasonByTemp: function (temp) {
    const t = Number(temp);
    if (Number.isNaN(t)) return '';
    if (t >= 28) return '夏季';
    if (t >= 18) return '春季';
    if (t >= 10) return '秋季';
    return '冬季';
  },

  fetchRealtimeWeather: function () {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (loc) => {
          const lat = Number(loc.latitude || 0);
          const lon = Number(loc.longitude || 0);
          if (!lat || !lon) {
            resolve({});
            return;
          }
          Promise.all([
            this.requestJson(GEOCODE_ENDPOINT, { latitude: lat, longitude: lon, language: 'zh', count: 1 }).catch(() => ({})),
            this.requestJson(WEATHER_ENDPOINT, {
              latitude: lat,
              longitude: lon,
              current: 'temperature_2m,apparent_temperature,weather_code',
              timezone: 'auto'
            }).catch(() => ({}))
          ]).then(([geo, weather]) => {
            const city = geo && Array.isArray(geo.results) && geo.results[0] ? (geo.results[0].name || '') : '';
            const current = weather && weather.current ? weather.current : {};
            const temp = current.temperature_2m;
            const feels = current.apparent_temperature;
            const text = this.mapWeatherCode(current.weather_code);
            const season = this.inferSeasonByTemp(temp);
            resolve({
              city: city || '',
              weather: text || '',
              temperature: (temp !== undefined && temp !== null)
                ? `${feels !== undefined && feels !== null ? feels : temp}°C（实测 ${temp}°C）`
                : '',
              season: season || ''
            });
          }).catch(() => resolve({}));
        },
        fail: () => resolve({})
      });
    });
  },

  buildPromptWithPipeline: function (prompt, profile, weatherCtx) {
    const p = Object.assign({}, profile || {});
    const w = weatherCtx || {};
    if (w.weather && !p.weather) p.weather = w.weather;
    if (w.temperature && !p.temperature) p.temperature = w.temperature;
    if (w.season && !p.season) p.season = w.season;
    if (w.city && !p.city) p.city = w.city;

    const userContextLines = [];
    if (p.city) userContextLines.push(`- 城市：${p.city}`);
    if (p.gender) userContextLines.push(`- 性别：${p.gender}`);
    if (p.age) userContextLines.push(`- 年龄：${p.age}`);
    if (p.height || p.weight) {
      const hw = [];
      if (p.height) hw.push(`身高 ${p.height}`);
      if (p.weight) hw.push(`体重 ${p.weight}`);
      userContextLines.push(`- 体型数据：${hw.join('，')}`);
    }
    if (p.bodyType) userContextLines.push(`- 身材特征：${p.bodyType}`);
    if (p.season) userContextLines.push(`- 当前季节：${p.season}`);
    if (p.weather) userContextLines.push(`- 天气状况：${p.weather}`);
    if (p.temperature) userContextLines.push(`- 气温：${p.temperature}`);
    if (p.occasion) userContextLines.push(`- 穿搭场合：${p.occasion}`);
    if (p.stylePref) userContextLines.push(`- 风格偏好：${p.stylePref}`);
    if (p.extra) userContextLines.push(`- 其他补充：${p.extra}`);

    const textParts = [
      '请根据图片中的穿搭，结合下方个人信息与实时天气，给出专业、完整、可执行的穿搭分析。',
      userContextLines.length ? `【我的个人信息】\n${userContextLines.join('\n')}` : '',
      String(prompt || '').trim() ? `【用户问题】${String(prompt || '').trim()}` : '',
      '请严格按以下框架输出：\n1.整体风格定位\n2.色彩搭配分析\n3.版型与身材适配\n4.场合适配度\n5.天气&季节适配\n6.具体改进建议（必改/可选/加分项）\n7.完整搭配方案推荐（1-2套）'
    ].filter(Boolean);
    return {
      promptText: textParts.join('\n\n'),
      nextProfile: p
    };
  },

  getImageMime: function (filePath) {
    const path = String(filePath || '').toLowerCase();
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  },

  readFileAsBase64: function (filePath) {
    const fs = wx.getFileSystemManager();
    return new Promise((resolve, reject) => {
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(String(res.data || '')),
        fail: reject
      });
    });
  },

  getFileSize: function (filePath) {
    const fs = wx.getFileSystemManager();
    return new Promise((resolve) => {
      fs.getFileInfo({
        filePath,
        success: (res) => resolve(Number(res.size || 0)),
        fail: () => resolve(0)
      });
    });
  },

  compressImage: function (filePath, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  ensureImageSmallEnough: function (filePath) {
    const maxBytes = 900 * 1024;
    return this.getFileSize(filePath).then((size) => {
      if (size > 0 && size <= maxBytes) return filePath;
      const qualities = [70, 55, 40, 25];
      let chain = Promise.resolve(filePath);
      qualities.forEach((q) => {
        chain = chain.then((current) => this.getFileSize(current).then((s) => {
          if (s > 0 && s <= maxBytes) return current;
          return this.compressImage(current, q);
        }));
      });
      return chain.then((finalPath) => this.getFileSize(finalPath).then((finalSize) => {
        if (finalSize > 0 && finalSize <= maxBytes) return finalPath;
        return filePath;
      }));
    });
  },

  callDashscopeQwen: function (prompt) {
    const apiKey = String(this.data.dashscopeApiKey || '').trim();
    if (!apiKey) {
      return Promise.reject(new Error('DASHSCOPE_API_KEY_EMPTY'));
    }

    const model = String(this.data.dashscopeModel || 'qwen-vl-max');
    const imagePath = this.data.imagePath || '';
    const profile = Object.assign({}, this.data.profile || {});

    const requestWithContent = (userContent) => new Promise((resolve, reject) => {
      const url = String(DASHSCOPE_ENDPOINT || '').replace(/`/g, '').trim();
      wx.request({
        url,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 90000,
        data: {
          model,
          messages: [
            { role: 'system', content: QWEN_SYSTEM_PROMPT },
            { role: 'user', content: userContent }
          ],
          stream: false,
          temperature: 0.7,
          max_tokens: 2048
        },
        success: (res) => {
          if (res.statusCode !== 200 || !res.data) {
            reject(new Error('DASHSCOPE_REQUEST_FAILED'));
            return;
          }
          const data = res.data || {};
          const advice = data.choices && data.choices[0] && data.choices[0].message ? String(data.choices[0].message.content || '') : '';
          if (!advice) {
            reject(new Error('DASHSCOPE_EMPTY_RESPONSE'));
            return;
          }
          resolve(advice);
        },
        fail: (err) => {
          const msg = err && err.errMsg ? String(err.errMsg) : String(err || '');
          if (msg.includes('timeout')) {
            reject(new Error('DASHSCOPE_TIMEOUT'));
            return;
          }
          reject(err);
        }
      });
    });

    return this.fetchRealtimeWeather().then((weatherCtx) => {
      const built = this.buildPromptWithPipeline(prompt, profile, weatherCtx);
      const userText = built.promptText;
      if (weatherCtx && (weatherCtx.weather || weatherCtx.temperature || weatherCtx.season || weatherCtx.city)) {
        this.setData({
          profile: Object.assign({}, this.data.profile, {
            season: this.data.profile.season || built.nextProfile.season || '',
            weather: this.data.profile.weather || built.nextProfile.weather || '',
            temperature: this.data.profile.temperature || built.nextProfile.temperature || ''
          })
        });
      }

      if (!imagePath) {
        return requestWithContent(userText);
      }
      const mime = this.getImageMime(imagePath);
      return this.readFileAsBase64(imagePath).then((b64) => {
        const userContent = [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text: userText }
        ];
        return requestWithContent(userContent);
      });
    });
  },

  callMcpBackend: function (prompt) {
    const baseUrl = String((
      appConfig &&
      appConfig.serverConfig &&
      (appConfig.serverConfig.outfitMcpBaseUrl || appConfig.serverConfig.baseUrl)
    ) || '').trim().replace(/\/$/, '');
    if (!baseUrl) {
      return Promise.reject(new Error('MCP_BASEURL_EMPTY'));
    }
    const url = `${baseUrl}${MCP_OUTFIT_PATH}`;
    const profile = Object.assign({}, this.data.profile || {});
    const imagePath = this.data.imagePath || '';
    const formData = {
      prompt: String(prompt || ''),
      gender: profile.gender || '',
      age: profile.age || '',
      height: profile.height || '',
      weight: profile.weight || '',
      bodyType: profile.bodyType || '',
      city: profile.city || '',
      season: profile.season || '',
      weather: profile.weather || '',
      temperature: profile.temperature || '',
      occasion: profile.occasion || '',
      stylePref: profile.stylePref || '',
      extra: profile.extra || ''
    };

    if (imagePath) {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url,
          filePath: imagePath,
          name: 'image',
          formData,
          timeout: 120000,
          success: (res) => {
            if (res.statusCode !== 200) {
              reject(new Error('MCP_HTTP_ERROR'));
              return;
            }
            try {
              const data = JSON.parse(res.data || '{}');
              if (data && data.success && data.advice) {
                resolve(data);
                return;
              }
              reject(new Error('MCP_EMPTY'));
            } catch (e) {
              reject(e);
            }
          },
          fail: reject
        });
      });
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method: 'POST',
        timeout: 120000,
        header: { 'Content-Type': 'application/json' },
        data: formData,
        success: (res) => {
          const data = res.data || {};
          if (res.statusCode === 200 && data.success && data.advice) {
            resolve(data);
            return;
          }
          reject(new Error('MCP_HTTP_ERROR'));
        },
        fail: reject
      });
    });
  },

  decodeChunkText: function (buffer) {
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(new Uint8Array(buffer));
      }
    } catch (e) {}
    try {
      const bytes = new Uint8Array(buffer);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return decodeURIComponent(escape(out));
    } catch (e) {
      return '';
    }
  },

  callMcpBackendStream: function (prompt, onDelta, onImage, onMeta) {
    const baseUrl = String((
      appConfig &&
      appConfig.serverConfig &&
      (appConfig.serverConfig.outfitMcpBaseUrl || appConfig.serverConfig.baseUrl)
    ) || '').trim().replace(/\/$/, '');
    if (!baseUrl) {
      return Promise.reject(new Error('MCP_BASEURL_EMPTY'));
    }
    const url = `${baseUrl}${MCP_OUTFIT_STREAM_PATH}`;
    const profile = Object.assign({}, this.data.profile || {});
    const imagePath = this.data.imagePath || '';
    const payload = {
      prompt: String(prompt || ''),
      gender: profile.gender || '',
      age: profile.age || '',
      height: profile.height || '',
      weight: profile.weight || '',
      bodyType: profile.bodyType || '',
      city: profile.city || '',
      season: profile.season || '',
      weather: profile.weather || '',
      temperature: profile.temperature || '',
      occasion: profile.occasion || '',
      stylePref: profile.stylePref || '',
      extra: profile.extra || ''
    };

    const requestWithPayload = (dataPayload) => new Promise((resolve, reject) => {
      let finalText = '';
      let done = false;
      let imageUrl = '';
      let metaProfile = {};
      let metaWeather = {};
      let sseBuffer = '';

      const handleSse = (text) => {
        sseBuffer += String(text || '');
        const parts = sseBuffer.split('\n\n');
        sseBuffer = parts.pop() || '';
        parts.forEach((block) => {
          const lines = block.split('\n').filter(line => line.startsWith('data:'));
          lines.forEach((line) => {
            const jsonText = line.replace(/^data:\s*/, '');
            if (!jsonText) return;
            try {
              const evt = JSON.parse(jsonText);
              if (evt.type === 'meta') {
                metaProfile = evt.profile_used || {};
                metaWeather = evt.weather_context || {};
                if (typeof onMeta === 'function') onMeta(metaProfile, metaWeather);
              } else if (evt.type === 'token' && evt.delta) {
                finalText += String(evt.delta);
                if (typeof onDelta === 'function') onDelta(finalText);
              } else if (evt.type === 'image' && evt.url) {
                imageUrl = String(evt.url);
                if (typeof onImage === 'function') onImage(imageUrl);
              } else if (evt.type === 'done') {
                if (evt.advice) finalText = String(evt.advice);
                if (evt.generated_image_url) {
                  imageUrl = String(evt.generated_image_url);
                  if (typeof onImage === 'function') onImage(imageUrl);
                }
                done = true;
              }
            } catch (e) {}
          });
        });
      };

      const task = wx.request({
        url,
        method: 'POST',
        timeout: 120000,
        enableChunked: true,
        header: { 'Content-Type': 'application/json' },
        data: dataPayload,
        success: (res) => {
          if (typeof res.data === 'string') handleSse(res.data);
          if (!done && !finalText) {
            const direct = res && res.data && res.data.advice ? String(res.data.advice) : '';
            if (direct) finalText = direct;
          }
          if (finalText) {
            resolve({
              advice: finalText,
              generated_image_url: imageUrl,
              profile_used: metaProfile,
              weather_context: metaWeather
            });
            return;
          }
          reject(new Error('MCP_STREAM_EMPTY'));
        },
        fail: reject
      });

      if (task && typeof task.onChunkReceived === 'function') {
        task.onChunkReceived((res) => {
          const text = this.decodeChunkText(res.data);
          if (text) handleSse(text);
        });
      }
    });

    if (!imagePath) {
      return requestWithPayload(payload);
    }
    return this.readFileAsBase64(imagePath).then((b64) => {
      payload.imageBase64 = `data:${this.getImageMime(imagePath)};base64,${b64}`;
      return requestWithPayload(payload);
    });
  },

  chooseImage: function () {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res && res.tempFilePaths && res.tempFilePaths[0] ? res.tempFilePaths[0] : '';
        if (!path) return;
        wx.showLoading({ title: '处理图片...' });
        this.ensureImageSmallEnough(path)
          .then((safePath) => {
            wx.hideLoading();
            this.setData({
              imagePath: safePath,
              hasInput: !!safePath || String(this.data.inputText || '').trim().length > 0
            });
          })
          .catch(() => {
            wx.hideLoading();
            this.setData({
              imagePath: path,
              hasInput: !!path || String(this.data.inputText || '').trim().length > 0
            });
          });
      }
    });
  },

  removeImage: function () {
    this.setData({
      imagePath: '',
      hasInput: String(this.data.inputText || '').trim().length > 0
    });
  },

  clearConversation: function () {
    wx.showModal({
      title: '清空会话',
      content: '确定清空当前聊天记录吗？',
      success: (res) => {
        if (!res.confirm) return;
        const initMessages = this.buildInitMessages();
        this.setData({
          messages: initMessages,
          inputText: '',
          hasInput: false,
          isLoading: false,
          scrollToMessage: '',
          lastQuestion: '',
          imagePath: ''
        });
        resetChatHistory();
        this.persistChatHistory(initMessages);
        this.clearTypingTimer();
        wx.showToast({
          title: '已清空',
          icon: 'success'
        });
      }
    });
  },

  retryLastQuestion: function () {
    const text = this.data.lastQuestion || '';
    if ((!text && !this.data.imagePath) || this.data.isLoading) return;
    this.setData({
      isLoading: true
    });
    this.callOutfitAdvisorService(text);
  },

  /**
   * 发送消息
   */
  sendMessage: function () {
    const { inputText, isLoading } = this.data;
    const text = (inputText !== undefined && inputText !== null) ? String(inputText).trim() : '';
    
    console.log('尝试发送消息:', {
      inputText: inputText || '空',
      isLoading: isLoading
    });
    
    if (isLoading) {
      console.log('发送消息被阻止：正在加载中');
      return;
    }
    
    if (!text && !this.data.imagePath) {
      console.log('发送消息被阻止：输入内容为空');
      return;
    }
    
    console.log('准备发送消息到AI');
    
    // 添加用户消息到列表
    const userMessage = {
      id: Date.now(),
      content: text || '[上传了一张穿搭图片，请帮我分析]',
      type: 'user'
    };
    
    const messages = this.data.messages.concat(userMessage);
    
    this.setData({
      messages,
      inputText: '',
      hasInput: false,
      isLoading: true,
      lastQuestion: text || '[图片分析]'
    }, () => {
      this.persistChatHistory(messages);
      this.callOutfitAdvisorService(text);
    });
  },

  /**
   * 调用穿搭顾问服务
   */
  callOutfitAdvisorService: function (prompt) {
    const { messages } = this.data;
    if (this.data.streamOutput) {
      const aiMessage = {
        id: Date.now(),
        content: '',
        nodes: [],
        type: 'ai'
      };
      let streamBody = '';
      let streamMetaProfile = {};
      let streamMetaWeather = {};
      const updatedMessages = messages.concat(aiMessage);
      this.setData({
        messages: updatedMessages,
        scrollToMessage: `message-${aiMessage.id}`
      });
      this.callMcpBackendStream(prompt, (fullText) => {
        streamBody = fullText;
        const withHint = !!(this.data.messages || []).find(m => m.id === aiMessage.id && m.generatedImageUrl);
        const renderText = this.buildFinalAnswerText(streamBody, streamMetaProfile, streamMetaWeather, withHint);
        const nextMessages = (this.data.messages || []).map(item => {
          if (item.id !== aiMessage.id) return item;
          return Object.assign({}, item, {
            content: renderText,
            nodes: this.formatAnswerNodes(renderText)
          });
        });
        this.setData({
          messages: nextMessages,
          scrollToMessage: `message-${aiMessage.id}`
        });
      }, (imageUrl) => {
        const renderText = this.buildFinalAnswerText(streamBody, streamMetaProfile, streamMetaWeather, true);
        const nextMessages = (this.data.messages || []).map(item => {
          if (item.id !== aiMessage.id) return item;
          return Object.assign({}, item, {
            generatedImageUrl: imageUrl,
            content: renderText,
            nodes: this.formatAnswerNodes(renderText)
          });
        });
        this.setData({
          messages: nextMessages,
          scrollToMessage: `message-${aiMessage.id}`
        });
      }, (profileUsed, weatherContext) => {
        streamMetaProfile = profileUsed || {};
        streamMetaWeather = weatherContext || {};
      }).then((resultObj) => {
        const finalText = (resultObj && resultObj.advice) ? String(resultObj.advice) : '';
        const imageUrl = (resultObj && resultObj.generated_image_url) ? String(resultObj.generated_image_url) : '';
        const profileUsed = (resultObj && resultObj.profile_used) ? resultObj.profile_used : streamMetaProfile;
        const weatherCtx = (resultObj && resultObj.weather_context) ? resultObj.weather_context : streamMetaWeather;
        const renderText = this.buildFinalAnswerText(finalText, profileUsed, weatherCtx, !!imageUrl);
        const nextMessages = (this.data.messages || []).map(item => {
          if (item.id !== aiMessage.id) return item;
          return Object.assign({}, item, {
            content: renderText,
            nodes: this.formatAnswerNodes(renderText),
            generatedImageUrl: imageUrl || item.generatedImageUrl || ''
          });
        });
        this.setData({
          messages: nextMessages,
          isLoading: false,
          scrollToMessage: `message-${aiMessage.id}`
        }, () => {
          this.persistChatHistory(nextMessages);
          this.scrollToBottom();
        });
      }).catch(() => {
        this.setData({
          messages,
          isLoading: true
        }, () => {
          const runner = this.callMcpBackend(prompt).catch(() => this.callDashscopeQwen(prompt));
          Promise.resolve(runner).then((result) => {
            const rawContent = typeof result === 'string' ? result : (result && result.advice ? result.advice : '');
            const imageUrl = result && result.generated_image_url ? String(result.generated_image_url) : '';
            const profileUsed = result && result.profile_used ? result.profile_used : {};
            const weatherCtx = result && result.weather_context ? result.weather_context : {};
            const content = this.buildFinalAnswerText(rawContent, profileUsed, weatherCtx, !!imageUrl);
            const retryAi = {
              id: Date.now(),
              content: '',
              nodes: [],
              generatedImageUrl: imageUrl,
              type: 'ai'
            };
            const retryMessages = messages.concat(retryAi);
            this.setData({
              messages: retryMessages,
              scrollToMessage: `message-${retryAi.id}`
            }, () => {
              this.startTypingMessage(retryAi.id, content || '暂时没有获取到建议，请稍后再试。');
            });
          }).catch(() => {
            this.handleApiError('获取穿搭建议失败，请稍后重试');
          });
        });
      });
      return;
    }

    const runner = this.callMcpBackend(prompt).catch(() => this.callDashscopeQwen(prompt));
    Promise.resolve(runner)
      .then(result => {
        const rawContent = typeof result === 'string' ? result : (result && result.advice ? result.advice : '');
        const imageUrl = result && result.generated_image_url ? String(result.generated_image_url) : '';
        const profileUsed = result && result.profile_used ? result.profile_used : {};
        const weatherCtx = result && result.weather_context ? result.weather_context : {};
        const content = this.buildFinalAnswerText(rawContent, profileUsed, weatherCtx, !!imageUrl);
        const aiMessage = {
          id: Date.now(),
          content: this.data.streamOutput ? '' : (content || '暂时没有获取到建议，请稍后再试。'),
          nodes: this.data.streamOutput ? [] : this.formatAnswerNodes(content || '暂时没有获取到建议，请稍后再试。'),
          generatedImageUrl: imageUrl,
          type: 'ai'
        };
        
        const updatedMessages = messages.concat(aiMessage);
        
        this.setData({
          messages: updatedMessages,
          scrollToMessage: `message-${aiMessage.id}`
        }, () => {
          if (this.data.streamOutput) {
            this.startTypingMessage(aiMessage.id, content || '暂时没有获取到建议，请稍后再试。');
            return;
          }
          this.setData({ isLoading: false }, () => {
            this.persistChatHistory(updatedMessages);
            this.scrollToBottom();
          });
        });
      })
      .catch(error => {
        if (error && error.message === 'DASHSCOPE_API_KEY_EMPTY') {
          wx.showModal({
            title: '需要配置密钥',
            content: '请在“填写参数”里设置 DASHSCOPE_API_KEY 后再试。',
            showCancel: false
          });
          this.setData({ isLoading: false });
          return;
        }
        this.clearTypingTimer();
        const isTimeout = error && error.message === 'DASHSCOPE_TIMEOUT';
        const tip = isTimeout
          ? '百炼请求超时：请检查网络/是否开启“不校验合法域名”，或在小程序后台添加 request 合法域名 dashscope.aliyuncs.com。已先给出离线建议供参考。'
          : '百炼请求失败：已先给出离线建议供参考。';

        Promise.resolve(getOutfitAdvice(prompt))
          .then((res) => {
            const fallback = (res && res.advice) ? String(res.advice) : '暂时无法获取建议，请稍后再试。';
            const finalText = `${tip}\n\n${fallback}`;
            const aiMessage = {
              id: Date.now(),
              content: this.data.streamOutput ? '' : finalText,
              nodes: this.data.streamOutput ? [] : this.formatAnswerNodes(finalText),
              type: 'ai'
            };
            const updatedMessages = messages.concat(aiMessage);
            this.setData({
              messages: updatedMessages,
              scrollToMessage: `message-${aiMessage.id}`
            }, () => {
              if (this.data.streamOutput) {
                this.startTypingMessage(aiMessage.id, finalText);
                return;
              }
              this.setData({ isLoading: false }, () => {
                this.persistChatHistory(updatedMessages);
                this.scrollToBottom();
              });
            });
          })
          .catch(() => {
            this.handleApiError('获取穿搭建议失败，请稍后重试');
          });
      });
  },

  /**
   * 处理API错误
   */
  handleApiError: function (errorMessage) {
    wx.showToast({
      title: errorMessage || '服务调用失败，请稍后重试',
      icon: 'none'
    });
    
    // 添加错误消息到界面
    const errorMessageObj = {
      id: Date.now(),
      content: errorMessage,
      type: 'ai'
    };
    
    this.setData({
      messages: this.data.messages.concat(errorMessageObj),
      isLoading: false
    }, () => {
      this.persistChatHistory(this.data.messages);
      this.scrollToBottom();
    });
  },

  /**
   * 滚动到底部
   */
  scrollToBottom: function () {
    const messages = this.data.messages || [];
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    this.setData({
      scrollToMessage: `message-${last.id}`
    });
  },

  /**
   * 返回上一页
   */
  onBackPress: function () {
    // 确保页面可以正确返回
    try {
      wx.navigateBack();
    } catch (error) {
      console.error('返回页面失败:', error);
      // 如果返回失败，尝试跳转到首页
      wx.redirectTo({
        url: '/pages/index/index'
      });
    }
  },
  
  /**
   * 滚动到顶部事件
   */
  onScrollToUpper: function() {
    // 可以在这里实现加载更多历史消息的功能
    console.log('滚动到顶部');
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    this.clearTypingTimer();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: 'AI穿搭顾问',
      path: '/pages/clothes-advisor/clothes-advisor'
    };
  }
});
