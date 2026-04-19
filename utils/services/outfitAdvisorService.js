const config = require('../config');

const SYSTEM_PROMPT = "你是中文智能助手，默认身份是专业穿搭顾问。\n\n当用户问题与穿搭相关时：\n1) 先识别场景与气候线索，再给可执行建议。\n2) 优先使用结构：推荐搭配、颜色建议、替代方案、避坑。\n3) 信息不足时只追问1个关键问题。\n\n当用户问题与穿搭无关时：\n1) 直接正常回答，不强行转到穿搭。\n2) 可在结尾补一句“如需我也可给你对应场景穿搭建议”。\n\n通用要求：\n- 回答用中文，清晰、简洁、友好。\n- 不编造事实，不输出危险建议。";

const getDeepSeekApiKey = () => config.deepseekApiKey || '';
const getDeepSeekEndpoint = () => (config.apiConfig && config.apiConfig.endpoint) ? config.apiConfig.endpoint : 'https://api.deepseek.com/v1/chat/completions';
const getDeepSeekModel = () => (config.apiConfig && config.apiConfig.model) ? config.apiConfig.model : 'deepseek-chat';
const isDirectApiEnabled = () => !!(config.apiConfig && config.apiConfig.enableDirectApi);

let chatHistory = [];

function isFashionQuery(text) {
  return /穿搭|搭配|衣服|上衣|裤子|裙子|外套|鞋|面试|通勤|约会|风格|颜色|显瘦|身材|季节|天气|温度|度/.test(String(text || ''));
}

function updateChatHistory(userInput, agentOutput) {
  chatHistory.push(`用户：${userInput}`);
  chatHistory.push(`穿搭顾问：${agentOutput}`);
  if (chatHistory.length > 10) {
    chatHistory = chatHistory.slice(-10);
  }
}

function buildPrompt(userInput) {
  const historyStr = chatHistory.join('\n');
  const fashionQuery = isFashionQuery(userInput);
  return `=== 问题类型 ===\n${fashionQuery ? '穿搭相关问题' : '通用问题'}\n\n=== 对话历史 ===\n${historyStr || '无'}\n\n=== 用户当前问题 ===\n${userInput}`;
}

function parseAdviceFromDeepSeekResponse(res) {
  if (!res || res.statusCode !== 200) return '';
  const data = res.data || {};
  if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
    return data.choices[0].message.content || '';
  }
  return '';
}

function getMockAdvice(userInput) {
  const text = String(userInput || '');
  const fashionQuery = isFashionQuery(text);
  if (!fashionQuery) {
    if (/笑话|段子/.test(text)) {
      return "给你一个轻松的：\n我问衣柜：今天穿什么？\n衣柜说：你先减肥，我再开门。\n如果你愿意，我也可以顺便给你一套“显瘦又舒服”的今日穿搭。";
    }
    return "这个问题我可以正常聊～如果你希望，我还可以基于你的场景（通勤/约会/面试）给一套具体穿搭方案。";
  }

  const tempMatch = text.match(/(-?\d+)\s*度/);
  const temp = tempMatch ? Number(tempMatch[1]) : null;
  const isInterview = text.includes('面试');
  const isCommute = text.includes('通勤') || text.includes('上班') || text.includes('职场');
  const isDate = text.includes('约会');
  const isSport = text.includes('运动');
  const isRain = text.includes('下雨') || text.includes('雨天');
  const isCold = temp !== null ? temp <= 10 : /冷|降温/.test(text);
  const isMild = temp !== null ? temp > 10 && temp <= 22 : /春|秋|凉爽/.test(text);
  const isHot = temp !== null ? temp > 22 : /热|夏/.test(text);

  if (isInterview) {
    return "【推荐搭配】浅蓝衬衫+深灰西裤+藏青西装外套+黑色皮鞋。\n【颜色建议】主色藏青/深灰，内搭浅蓝，配饰选银色。\n【替代方案】白衬衫+黑色直筒裤+米色西装+乐福鞋。\n【避坑】避免大Logo和过亮配色；鞋面保持干净。";
  }

  if (isCommute) {
    if (isCold) {
      return "【推荐搭配】高领针织+羊毛大衣+直筒裤+短靴。\n【颜色建议】主色驼/灰，内搭白或燕麦色。\n【替代方案】连帽卫衣+短款羽绒+锥形裤+运动鞋。\n【避坑】外套过厚但下装过薄会失衡；避免裤长堆叠。";
    }
    if (isMild) {
      return "【推荐搭配】衬衫+轻薄针织开衫+九分西裤+乐福鞋。\n【颜色建议】主色海军蓝，辅色米白，点缀棕色包。\n【替代方案】纯色T恤+西装马甲+直筒牛仔裤+小白鞋。\n【避坑】上身层次太多会显臃肿；保持1件重点单品即可。";
    }
    return "【推荐搭配】速干衬衫+高腰西装短裤/薄西裤+轻薄防晒外套+透气单鞋。\n【颜色建议】主色浅灰，辅色白，点缀雾蓝。\n【替代方案】针织POLO+阔腿裤+凉感乐福鞋。\n【避坑】避免厚实面料和全黑配色，容易闷热。";
  }

  if (isDate) {
    return "【推荐搭配】修身针织上衣+A字半裙+短外套+低跟单鞋。\n【颜色建议】主色奶油白，辅色雾粉，点缀金色耳饰。\n【替代方案】小衬衫+高腰牛仔裤+细带凉鞋。\n【避坑】避免过多复杂配饰；控制在2个亮点内。";
  }

  if (isSport) {
    return "【推荐搭配】速干T恤+弹力运动裤+轻量跑鞋+防风外套。\n【颜色建议】主色黑灰，点缀荧光色提升活力。\n【替代方案】运动背心+宽松卫裤+训练鞋。\n【避坑】纯棉厚T不利于排汗；鞋底磨损要及时更换。";
  }

  if (isRain) {
    return "【推荐搭配】防泼水外套+快干长裤+防水鞋。\n【颜色建议】主色深灰/藏青，点缀亮色雨伞。\n【替代方案】连帽风衣+九分裤+防滑乐福鞋。\n【避坑】拖地裤脚会吸水；浅色麂皮鞋雨天慎用。";
  }

  if (isHot) {
    return "【推荐搭配】轻薄短袖衬衫+直筒短裤/薄长裤+透气凉鞋。\n【颜色建议】主色白/浅卡其，点缀天空蓝。\n【替代方案】棉麻连衣裙+平底凉鞋。\n【避坑】避免深色紧身全套，闷热且显疲态。";
  }

  if (isCold || isMild) {
    return "【推荐搭配】基础打底+轻外套+直筒裤+休闲鞋。\n【颜色建议】主色中性色，点缀一件亮色单品。\n【替代方案】卫衣叠穿衬衫+工装裤。\n【避坑】上下都宽松会显拖沓，可遵循上松下紧。";
  }

  return "【推荐搭配】白色基础上衣+深色下装+一件有质感外套+干净鞋款。\n【颜色建议】1个主色+1个辅色+1个点缀色。\n【替代方案】把外套换成针织开衫可更日常。\n【避坑】不要同时出现太多图案与高饱和颜色。\n你可以补充场景和温度，我给你更精准的一套。";
}

function getOutfitAdvice(userInput) {
  return new Promise((resolve) => {
    try {
      const apiKey = getDeepSeekApiKey();
      if (!isDirectApiEnabled() || !apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === 'YOUR_DEEPSEEK_API_KEY') {
        const mockAdvice = getMockAdvice(userInput);
        updateChatHistory(userInput, mockAdvice);
        resolve({ advice: mockAdvice });
        return;
      }

      const prompt = buildPrompt(userInput);
      wx.request({
        url: getDeepSeekEndpoint(),
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        data: {
          model: getDeepSeekModel(),
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1024
        },
        success(res) {
          const advice = parseAdviceFromDeepSeekResponse(res);
          if (!advice) {
            const mockAdvice = getMockAdvice(userInput);
            updateChatHistory(userInput, mockAdvice);
            resolve({ advice: mockAdvice });
            return;
          }
          updateChatHistory(userInput, advice);
          resolve({ advice });
        },
        fail() {
          const mockAdvice = getMockAdvice(userInput);
          updateChatHistory(userInput, mockAdvice);
          resolve({ advice: mockAdvice });
        }
      });
    } catch (e) {
      const mockAdvice = getMockAdvice(userInput);
      updateChatHistory(userInput, mockAdvice);
      resolve({ advice: mockAdvice });
    }
  });
}

function resetChatHistory() {
  chatHistory = [];
}

module.exports = {
  getOutfitAdvice,
  resetChatHistory
};

