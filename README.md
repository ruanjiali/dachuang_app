# AI智能穿搭魔法师（微信小程序）

面向“穿搭管理 + AI辅助决策 + 图像处理体验”的微信小程序项目。  
项目支持本地离线可运行的核心体验，同时预留后端能力接入（抠图、远程识图、虚拟试穿等）。

## 1. 项目定位

- 用户侧目标：降低穿搭决策成本，提供“选衣服、问建议、记录搭配、图像处理”的一站式体验。
- 技术侧目标：保证无后端时也能跑通主流程，有后端时可逐步增强能力。
- 工程侧目标：前端主包可预览、真机可调试、功能模块边界清晰、数据结构可维护。

---

## 2. 技术栈与运行环境

### 2.1 前端（小程序）

- 框架：微信小程序原生（WXML + WXSS + JS）
- 基础库能力：
  - `wx.request / wx.uploadFile / wx.downloadFile`
  - `wx.chooseImage / wx.compressImage / wx.previewImage`
  - `wx.getStorageSync / wx.setStorageSync`
  - `wx.canvasGetImageData`（本地识图特征提取）
- 工程配置：
  - `style: "v2"`
  - `componentFramework: "glass-easel"`
  - `lazyCodeLoading: "requiredComponents"`
  - 见 [app.json](file:///d:/dachuang_app/try/app.json#L1-L37)

### 2.2 后端（可选）

- Python 服务（示例）：
  - [backend/cutout_server.py](file:///d:/dachuang_app/try/backend/cutout_server.py)
  - [backend/requirements.txt](file:///d:/dachuang_app/try/backend/requirements.txt)
- 主要用于：抠图接口与异步结果查询

### 2.3 配置体系

- 安全默认配置： [utils/config.js](file:///d:/dachuang_app/try/utils/config.js)
- 本地私有配置：`utils/config.local.js`（需自行创建，不提交仓库）
- 默认策略：
  - `apiConfig.enableDirectApi = false`（默认离线模式，避免真机直连失败）
  - `serverConfig.baseUrl = ''`（未配置后端时不发起后端请求）

---

## 3. 项目框架（目录结构）

```text
try/
├─ app.js
├─ app.json
├─ app.wxss
├─ pages/
│  ├─ index/                首页聚合入口
│  ├─ login/ register/ forgot-password/   登录注册
│  ├─ clothes-selection/    服装库（筛选/搜索/收藏）
│  ├─ add-clothes/          添加服装
│  ├─ collection/           我的收藏（服装+建议）
│  ├─ fashion-advice/       AI穿搭建议页
│  ├─ chat-with-model/      AI助手对话（离线/直连可切换）
│  ├─ clothes-advisor/      穿搭顾问（对话建议）
│  ├─ ai-recognition/       AI识图（本地可运行，支持远程兜底）
│  ├─ photo-try/            随手拍（联动AI识图/搭配保存）
│  ├─ upload-outfit/        发布我的搭配
│  ├─ outfit-showcase/      搭配展示
│  ├─ cutout/               抠图
│  ├─ web-view/             H5容器（虚拟试穿/备用网页能力）
│  └─ debug-storage/        调试页（存储/错误排查）
├─ utils/
│  ├─ config.js             全局配置合并
│  ├─ request.js            请求封装
│  ├─ imagePicker.js        统一选图与自动压缩（4MB兜底）
│  ├─ netTrace.js           网络失败追踪
│  └─ services/             业务服务
├─ backend/                 可选后端（已在打包中忽略）
└─ web-cutout/              可选H5（已在打包中忽略）
```

---

## 4. 功能模块与能力说明

### 4.1 账号与首页

- 登录/注册/找回密码：本地存储模拟账号体系。
- 首页聚合导航：将“服装、建议、识图、抠图、搭配展示”等功能串联。

### 4.2 服装管理

- 挑选服装页：
  - 分类筛选、关键词搜索、卡片浏览、图片预览、收藏状态切换。
  - 默认服装数据 + 本地新增服装融合。
- 添加服装页：
  - 使用统一选图工具，支持相机/相册，保存到本地衣橱。

### 4.3 收藏中心

- 收藏服装与收藏建议分 Tab 管理。
- 支持搜索、排序、单条移除、清空收藏。
- 按用户隔离存储，避免串号。

### 4.4 AI能力

- AI穿搭建议页（`fashion-advice`）：
  - 风格 + 场景选择生成建议
  - 推荐单品可直接收藏
  - 建议可保存到“我的收藏”
- AI助手页（`chat-with-model`）：
  - 默认离线建议模式
  - 若启用直连并配置 key，可接 DeepSeek
- 穿搭顾问页（`clothes-advisor`）：
  - 对话建议 + 消息滚动
  - 已修复输入空值导致的 `trim` 崩溃

### 4.5 图像能力

- AI识图（`ai-recognition`）：
  - 无后端可运行：本地像素分析（亮度/饱和度/颜色倾向）推断风格/季节
  - 支持结果人工编辑后再存入衣橱
  - 有后端时可切换远程识别接口
- 抠图（`cutout`）：
  - 支持上传后端抠图与异步轮询结果
  - 可保存到相册
  - 支持备用网页入口（`cutoutWebUrl`）
- 随手拍（`photo-try`）：
  - 拍照/选图
  - 可一键进入 AI识图
  - 可一键存到“我的搭配”

---

## 5. 用户体验流程（推荐主路径）

### 流程 A：初次用户（无后端也可完整体验）

1. 登录/注册  
2. 进入挑选服装页，按分类和搜索浏览  
3. 收藏感兴趣单品，进入收藏页管理  
4. 打开 AI穿搭建议，选择风格与场景生成建议  
5. 使用随手拍 + AI识图，将自己的衣服加入衣橱  
6. 发布到“我的搭配”并在展示页查看

### 流程 B：图像增强（有后端时）

1. 在 `config.local.js` 配置后端 `baseUrl`  
2. 抠图页上传图片，获取抠图结果  
3. 保存结果或进入 H5 备用抠图/虚拟试穿  
4. 真机验证域名和证书配置

### 流程 C：AI增强（可选）

1. 在 `config.local.js` 设置 `deepseekApiKey`  
2. 打开 `apiConfig.enableDirectApi = true`（仅自用调试）  
3. 使用 AI助手/穿搭顾问进行对话增强  
4. 推荐生产方案改为“后端转发”，不要前端直放密钥

---

## 6. 数据模型与本地存储

核心键值（均为本地存储）：

- `token`、`username`：登录态
- `savedUsername`、`savedPassword`：记住登录信息
- `clothesList`：全量衣橱
- `collectedClothes_${username}`：收藏服装（用户隔离）
- `savedAdvices_${username}`：收藏建议（用户隔离）
- `outfits`：搭配发布内容
- `tryOnHistory`：试穿历史
- `lastNetworkFail`、`lastAppError`：调试追踪信息

---

## 7. 配置说明（必须看）

### 7.1 新建本地配置文件

创建 `utils/config.local.js`：

```js
module.exports = {
  deepseekApiKey: '',
  apiConfig: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    maxTokens: 5000,
    temperature: 0.7,
    enableDirectApi: false
  },
  serverConfig: {
    baseUrl: '',
    aiRecognitionUrl: '/api/mini/recognize-clothes',
    miniCutoutUrl: '/api/mini/remove-bg',
    miniCutoutJsonUrl: '/api/mini/remove-bg-json',
    miniCutoutResultUrl: '/api/mini/remove-bg/result',
    miniCutoutPollIntervalMs: 1500,
    miniCutoutPollTimeoutMs: 40000,
    cutoutWebUrl: '',
    virtualTryUrl: ''
  }
}
```

### 7.2 常见配置错误

- 对象属性必须用 `:`，不能写成 `virtualTryUrl='...'`
- 真机不能使用 `127.0.0.1/localhost` 作为后端地址
- 真机/上线必须配置合法域名 + HTTPS

---

## 8. 开发与调试

### 8.1 本地开发

1. 微信开发者工具导入项目根目录
2. 清缓存并重新编译
3. 先验证离线路径，再接入在线能力

### 8.2 真机调试建议

- 先跑离线功能（避免被网络条件阻塞）
- 再验证联网功能（抠图/直连 AI）
- 使用调试页查看：
  - `lastNetworkFail`
  - `lastAppError`

### 8.3 包体与预览限制（重点）

- 预览失败 `80051` 常见原因：单文件超过 4MB 或工程带入后端大文件
- 当前工程已通过以下配置规避：
  - [project.config.json](file:///d:/dachuang_app/try/project.config.json)
  - [project.private.config.json](file:///d:/dachuang_app/try/project.private.config.json)
  - 忽略 `backend/**`、`web-cutout/**`、`langchain/**`

---

## 9. 已落地的稳定性改进

- 统一选图工具 + 自动压缩，规避大图上传失败
- 网络失败追踪与全局错误记录
- 收藏键统一与历史数据迁移
- 注册跳转栈修复
- 页面样式变量兜底，减少“样式丢失”
- 对话输入空值防护，避免 `trim` 崩溃

---

## 10. 安全与上线建议

- 不要把真实 API Key 放在前端发布包
- `config.local.js` 仅本地使用，不提交仓库
- 生产建议采用“后端网关转发 AI 请求”
- 逐步将核心页面做分包（减少主包压力，提升启动性能）

---

## 11. 后续可演进方向

- 真正的分包拆分（首页主包 + 图像能力分包 + AI能力分包）
- AI识图接入标准服饰识别模型，替换规则推断
- 建立统一埋点与转化漏斗（首页 → 识图 → 入衣橱 → 建议）
- 收藏与衣橱改为云端持久化，多端同步

---

## 12. 许可证与说明

本项目用于学习与业务原型验证。  
接入第三方服务时请遵循对应平台的使用条款与数据合规要求。
