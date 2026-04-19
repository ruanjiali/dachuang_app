# 长期记忆

## 项目概况
- **项目**: AI智能穿搭小程序（微信小程序）
- **目录**: `d:/dachuang_app/try`
- **前端**: 19个页面，2个自定义组件，glass-easel框架，lazyCodeLoading
- **后端**: Python Flask，两个服务：cutout_server.py(port 5000, rembg) + outfit_mcp_server.py(port 5001, qwen-vl-max/qwen-max/wanx-v1)
- **AI服务**: 阿里百炼DashScope API + DeepSeek API
- **认证**: mock本地存储登录体系，8个测试账号(admin/123456等)

## 关键配置
- API密钥在 `utils/config.local.js`（不要提交到 git）
- 服务器地址: `http://10.21.227.234:5000/5001/7865`
- config.js 会自动 merge config.local.js

## 已完成的修复（2026-04-06）
1. config.local.js virtualTryUrl 双重定义 → 已修复
2. 首页动态问候语（早/下午/晚上好）
3. 首页调试按钮隐藏
4. 首页 AI助手/穿搭顾问图标修正
5. 首页硬编码 position offset 全部清除
6. 我的搭配 → 增加删除功能
7. AI助手 → 增加清除历史功能
8. 收藏页 → 服装卡片点击跳转到挑选服装页，建议卡片增加跳转功能

## 新增功能（2026-04-06 下午）
- **穿搭建议 API**: 后端新增 `/api/mini/fashion-advice` 接口，接收风格+场景，调用通义千问生成真实 AI 穿搭建议
- **前端优化**: fashion-advice 调用增加 loading 提示，超时时间延长至60秒
- **样式优化**: 建议结果区域增加渐变背景和左边框高亮，更好地展示 Markdown 格式内容

## 穿搭建议页面样式大改（2026-04-06 傍晚）
- **顶部装饰**: 渐变背景 + 圆角设计
- **步骤指示器**: 三步骤进度展示（选择风格→选择场景→获取建议）
- **选中状态标签**: 实时显示已选风格和场景
- **风格卡片**: 选中动效 + 勾选图标 + 缩放动画
- **场景选择**: Emoji图标 + 渐变高亮
- **生成按钮**: 闪光动画 + 加载状态
- **结果卡片**: AI标签 + 分区展示 + 卡片阴影
- **建议内容**: 渐变背景 + 左边框高亮 + 大字体行间距
- **单品推荐**: 渐变卡片 + 阴影
- **小贴士**: 渐变徽章 + 暖色背景

## 主要页面
- clothes-advisor: 最复杂，1478行，4级降级链(SSE→JSON→DashScope直连→本地规则)
- photo-try: 虚拟试穿，**目前是 mock 实现**，tryOnClothes() 直接返回原图
- fashion-advice: 6风格×6场景穿搭建议
- clothes-selection: 18件默认服装，图片均存在于/images/
