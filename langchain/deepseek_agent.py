# 1. 导入核心包（极简，只留必需）
from langchain_deepseek import ChatDeepSeek
from dotenv import load_dotenv
import os
from pydantic import SecretStr

# 2. 专业穿搭顾问提示词（时尚专家定位）
SYSTEM_PROMPT = """你是一位专业的时尚穿搭顾问，精通各类风格搭配和季节性穿搭技巧。

=== 核心职责 ===
1. 提供个性化穿搭建议，考虑用户提到的场合（职场、约会、聚会、日常等）、季节、天气、个人偏好等因素。
2. 掌握各类风格的搭配要点：休闲风、商务风、甜美风、运动风、复古风等。
3. 给出实用的色彩搭配建议和单品推荐，考虑服装的实用性和时尚度。
4. 根据季节变化提供应景的穿搭方案，包括温度适应性建议。

=== 互动准则 ===
1. 语言活泼友好，使用时尚相关的表达，让建议既专业又有趣。
2. 回答简洁明了，每段建议控制在3-5句话，提供具体可行的搭配方案。
3. 保持对话连贯性，记住之前的交流内容，提供连贯的穿搭建议。
4. 当用户未提供足够信息时，主动询问关键细节（场合、季节、温度、个人风格偏好等）。
5. 使用中文回答用户的中文提问。"""

# 3. 加载环境变量（DeepSeek API Key）
load_dotenv()
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")

# 4. 配置DeepSeek模型或使用模拟模式
model = None
try:
    if deepseek_api_key and deepseek_api_key != "YOUR_API_KEY_HERE":
        model = ChatDeepSeek(
            model="deepseek-chat",
            api_key=SecretStr(deepseek_api_key),
            temperature=0.7,  # 平衡专业度和趣味性
            max_tokens=1024
        )
        print("✅ DeepSeek API 配置成功")
    else:
        print("⚠️  DeepSeek API Key 未配置或为默认值，请在 .env 文件中设置真实的API Key")
        print("⚠️  将使用模拟模式运行")
except Exception as e:
    print(f"⚠️  DeepSeek API 初始化失败: {e}")
    print("⚠️  将使用模拟模式运行")

# 5. 穿搭工具函数（辅助智能体提供专业建议）

def get_current_season(month=None):
    """获取当前季节，用于季节性穿搭建议"""
    import datetime
    if month is None:
        month = datetime.datetime.now().month
    
    if month in [3, 4, 5]:
        return "春季"
    elif month in [6, 7, 8]:
        return "夏季"
    elif month in [9, 10, 11]:
        return "秋季"
    else:  # 12, 1, 2
        return "冬季"

def get_outfit_by_temperature(temp):
    """根据温度推荐合适的穿搭"""
    try:
        temp = float(temp)
        if temp >= 30:
            return "炎热天气适合：轻薄透气的短袖、短裤、连衣裙、凉鞋、遮阳帽和太阳镜。"
        elif temp >= 20:
            return "温暖天气适合：短袖T恤、衬衫、休闲裤、半身裙、帆布鞋或单鞋。"
        elif temp >= 10:
            return "凉爽天气适合：长袖衬衫、薄毛衣、牛仔裤、休闲外套、运动鞋。"
        elif temp >= 0:
            return "寒冷天气适合：毛衣、夹克、外套、长裤、靴子、围巾。"
        else:
            return "严寒天气适合：羽绒服、厚毛衣、保暖裤、雪地靴、手套、帽子、围巾等多层保暖。"
    except:
        return "请提供有效的温度值，以便给出准确的穿搭建议。"

def get_outfit_by_occasion(occasion):
    """根据场合推荐穿搭风格"""
    occasion_map = {
        "职场": "职场穿搭建议：简约衬衫搭配西裤或铅笔裙，选择中性色调如黑白灰蓝，避免过于暴露或休闲的服装，鞋子可选择高跟鞋或正装皮鞋。",
        "约会": "约会穿搭建议：根据约会类型选择，正式餐厅可穿连衣裙或衬衫+半裙，休闲约会可选择时尚T恤+牛仔裤，整体风格保持精致但不过于正式。",
        "聚会": "聚会穿搭建议：可根据聚会主题选择，一般可选择时尚的上衣、修身裤装或裙子，配饰可适当夸张，展现个人风格。",
        "面试": "面试穿搭建议：选择保守专业的服装，深色西装搭配浅色衬衫，避免鲜艳色彩和过多配饰，展现专业可靠的形象。",
        "运动": "运动穿搭建议：选择透气吸汗的运动服装，合适的运动鞋，根据运动类型选择专业装备，确保舒适和安全。",
        "日常": "日常穿搭建议：舒适休闲为主，T恤、牛仔裤、卫衣、运动鞋等，可根据个人风格添加时尚元素，注重实用性和舒适度。",
        "旅行": "旅行穿搭建议：轻便易搭配的服装，选择耐脏的颜色，舒适的鞋子，可准备一件外套应对温度变化，注重功能性。"
    }
    
    for key, advice in occasion_map.items():
        if key in occasion:
            return advice
    return "可提供更具体的场合信息（如职场、约会、聚会、面试等），以便给出更精准的穿搭建议。"

def get_color_matching(primary_color):
    """提供颜色搭配建议"""
    color_map = {
        "红色": "红色搭配建议：可与黑色、白色、灰色经典搭配；与米色、驼色温暖搭配；避免与过于鲜艳的颜色如荧光色搭配。",
        "蓝色": "蓝色搭配建议：深蓝色可与白色、灰色、棕色搭配；浅蓝色可与白色、淡黄色、粉色搭配；同色系深浅搭配也很和谐。",
        "黑色": "黑色搭配建议：黑色百搭，可与任何颜色搭配；与白色形成经典对比；与亮色如红色、黄色、蓝色形成鲜明对比。",
        "白色": "白色搭配建议：白色干净清爽，可与任何颜色搭配；与黑色形成经典对比；与淡色系形成柔和效果。",
        "灰色": "灰色搭配建议：灰色中性百搭，可与黑色、白色、蓝色、粉色等搭配；深灰接近黑色，浅灰接近白色，都很实用。",
        "粉色": "粉色搭配建议：可与白色、米色、灰色搭配呈现柔和感；与黑色形成对比；避免与过于鲜艳的颜色搭配以免俗艳。",
        "黄色": "黄色搭配建议：淡黄色可与白色、浅蓝色搭配；深黄色可与棕色、黑色搭配；避免与绿色等对比度过高的颜色搭配。",
        "绿色": "绿色搭配建议：浅绿色可与白色、米色搭配；深绿色可与棕色、黑色搭配；与同色系深浅搭配效果优雅。"
    }
    
    for key, advice in color_map.items():
        if key in primary_color:
            return advice
    return "可提供具体的颜色（如红色、蓝色、黑色、白色等），以便给出精准的颜色搭配建议。"

# 6. 对话记忆（本地简单维护，避免重复提问）
chat_history = []

# 7. 交互入口（优化用户体验，集成穿搭工具）
if __name__ == "__main__":
    print("👗  专业穿搭顾问已上线！输入 '退出' 结束对话～")
    print("💡  你可以咨询：")
    print("  • 季节性穿搭：如'春天穿什么好看？'")
    print("  • 场合穿搭：如'职场面试怎么穿？'")
    print("  • 温度穿搭：如'25度适合穿什么？'")
    print("  • 颜色搭配：如'红色衣服怎么搭配？'")
    print("  • 个人风格：如'日常休闲风推荐'")

    while True:
        try:
            user_input = input("\n你：").strip()
            if user_input.lower() in ['退出', 'quit', 'exit']:
                print("智能体：时尚之路永不止步，期待下次为你提供更多穿搭灵感～ 👋")
                break
            if not user_input:
                print("智能体：想知道今天怎么穿？告诉我场合、季节、温度或颜色偏好，我来为你量身定制！")
                continue

            # 智能检测并调用相应工具，收集辅助信息
            auxiliary_info = []
            
            # 检测是否包含温度信息（数字+度）
            import re
            temp_match = re.search(r'(\d+)度', user_input)
            if temp_match:
                temp = temp_match.group(1)
                temp_advice = get_outfit_by_temperature(temp)
                auxiliary_info.append(f"温度相关建议：{temp_advice}")
            
            # 检测是否包含场合信息
            occasion_advice = get_outfit_by_occasion(user_input)
            if occasion_advice != "可提供更具体的场合信息（如职场、约会、聚会、面试等），以便给出更精准的穿搭建议。":
                auxiliary_info.append(occasion_advice)
            
            # 检测是否包含颜色信息
            color_advice = get_color_matching(user_input)
            if color_advice != "可提供具体的颜色（如红色、蓝色、黑色、白色等），以便给出精准的颜色搭配建议。":
                auxiliary_info.append(color_advice)
            
            # 自动添加当前季节信息（如果用户没有指定季节）
            if not any(season in user_input for season in ["春", "夏", "秋", "冬", "春季", "夏季", "秋季", "冬季"]):
                current_season = get_current_season()
                auxiliary_info.append(f"当前为{current_season}，{current_season}穿搭需考虑温度变化和时尚趋势。")
            
            # 整合辅助信息、历史对话和当前输入
            auxiliary_info_str = "\n".join(auxiliary_info)
            history_str = "\n".join(chat_history)
            
            # 构建模型输入
            prompt = f"""
{SYSTEM_PROMPT}

=== 辅助信息 ===
{auxiliary_info_str}

=== 对话历史 ===
{history_str}

=== 用户当前问题 ===
{user_input}

=== 请根据以上信息，提供专业、实用且个性化的穿搭建议 ===
"""

            # 调用模型获取回应或使用模拟回复
            if model is not None:
                try:
                    response = model.invoke(prompt)
                    agent_output = response.content if hasattr(response, "content") else str(response)
                except Exception as e:
                    print(f"⚠️  API调用失败: {e}")
                    agent_output = "很抱歉，暂时无法连接到AI服务。请稍后再试或检查您的API配置。"
            else:
                # 模拟回复，基于用户输入类型
                if "温度" in user_input or "度" in user_input:
                    agent_output = "根据温度建议，您可以选择轻薄透气的衣物。具体可参考系统提示中的温度穿搭指南。"
                elif any(occasion in user_input for occasion in ["职场", "约会", "聚会", "面试"]):
                    agent_output = "针对您提到的场合，建议选择得体且适合该场景的服装。具体可参考系统中的场合穿搭建议。"
                elif any(color in user_input for color in ["红色", "蓝色", "黑色", "白色", "粉色", "黄色", "绿色"]):
                    agent_output = "关于颜色搭配，建议遵循经典的色彩搭配原则。具体可参考系统中的颜色搭配指南。"
                elif any(season in user_input for season in ["春", "夏", "秋", "冬"]):
                    agent_output = f"{user_input}，建议选择适合该季节气候特点的服装。"
                else:
                    agent_output = "感谢您的咨询！请提供更多细节，如场合、温度、季节或颜色偏好，以便我为您提供更精准的穿搭建议。"
            
            print(f"智能体：{agent_output}")

            # 更新对话记忆
            chat_history.append(f"用户：{user_input}")
            chat_history.append(f"穿搭顾问：{agent_output}")
            # 保持对话历史长度，只保留最近5轮
            if len(chat_history) > 10:
                chat_history = chat_history[-10:]

        except KeyboardInterrupt:
            print("\n智能体：穿搭灵感随时在线，期待下次为你服务～ 👋")
            break
        except Exception as e:
            # 捕获错误并给出友好提示
            print(f"智能体：哎呀，暂时无法获取灵感！请尝试提供更具体的信息，比如场合、温度或风格偏好。")
            continue