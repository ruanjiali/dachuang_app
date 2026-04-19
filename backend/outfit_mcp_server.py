import base64
import io
import json
import os
import time
from typing import Dict, Optional, Tuple

import httpx
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS
from openai import OpenAI
from PIL import Image

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
CORS(app)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")

QWEATHER_API_KEY = os.getenv("QWEATHER_API_KEY", "")
QWEATHER_API_HOST = os.getenv("QWEATHER_API_HOST", "pc63yxbvyc.re.qweatherapi.com")

MODEL_VL = os.getenv("OUTFIT_MODEL_VL", "qwen-vl-max")
MODEL_TEXT = os.getenv("OUTFIT_MODEL_TEXT", "qwen-max")
WANX_MODEL = os.getenv("OUTFIT_MODEL_IMAGE", "wanx-v1")

client = OpenAI(api_key=DASHSCOPE_API_KEY, base_url=DASHSCOPE_BASE_URL)

SYSTEM_PROMPT = """你是一位专业的个人形象顾问，拥有 10 年以上时尚造型经验，熟悉色彩搭配理论（四季色彩、色轮配色）、服装版型与身材管理、当季流行趋势以及不同场合的着装礼仪。

你的分析风格：
- 专业、细致、有温度，不使用模糊词汇
- 给出具体、可执行的建议（如推荐具体单品、颜色代号、品牌参考）
- 结合用户提供的个人信息（身材特征、天气、季节、场合）给出量身定制的方案
- 必要时指出穿搭中的问题，但语气温和建设性
- 输出结构清晰，使用 Markdown 分段呈现
"""


def infer_season_by_temp(temp: Optional[str], default: str = "") -> str:
    try:
        t = int(float(str(temp)))
    except Exception:
        return default
    if t >= 28:
        return "夏季"
    if t >= 18:
        return "春季"
    if t >= 10:
        return "秋季"
    return "冬季"


def fetch_qweather(city: str) -> Dict:
    if not QWEATHER_API_KEY or not city:
        return {}
    base = f"https://{QWEATHER_API_HOST}"
    geo_url = f"{base}/geo/v2/city/lookup"
    weather_url = f"{base}/v7/weather/now"
    air_url = f"{base}/v7/air/now"

    params = {"key": QWEATHER_API_KEY}
    result = {}
    with httpx.Client(timeout=10.0) as h:
        geo = h.get(geo_url, params={**params, "location": city, "lang": "zh"}).json()
        if geo.get("code") != "200" or not geo.get("location"):
            return {}
        loc = geo["location"][0]
        location_id = loc.get("id", "")
        city_name = loc.get("name", city)

        w = h.get(weather_url, params={**params, "location": location_id}).json()
        if w.get("code") == "200":
            now = w.get("now", {})
            result["weather"] = {
                "city": city_name,
                "temp": now.get("temp", ""),
                "text": now.get("text", ""),
                "humidity": now.get("humidity", ""),
                "windDir": now.get("windDir", ""),
                "windScale": now.get("windScale", ""),
                "feelsLike": now.get("feelsLike", ""),
                "full_text": (
                    f"【{city_name}实时天气】\n"
                    f"🌡️ 温度：{now.get('temp', '--')}°C\n"
                    f"🌤️ 天气：{now.get('text', '--')}\n"
                    f"💧 湿度：{now.get('humidity', '--')}%\n"
                    f"🌬️ 风向：{now.get('windDir', '--')} {now.get('windScale', '--')}级\n"
                    f"🤔 体感：{now.get('feelsLike', '--')}°C"
                ),
            }

        try:
            a = h.get(air_url, params={**params, "location": location_id}).json()
            if a.get("code") == "200":
                air = a.get("now", {})
                result["air"] = {
                    "text": f"AQI {air.get('aqi', '--')} {air.get('category', '--')}，PM2.5: {air.get('pm2p5', '--')}μg/m³",
                    "aqi": air.get("aqi", ""),
                    "category": air.get("category", ""),
                }
        except Exception:
            pass
    return result


def parse_profile(payload: Dict) -> Dict:
    defaults = {
        "gender": "女",
        "age": "20岁",
        "height": "170cm",
        "weight": "55kg",
        "body_type": "梨形身材",
        "city": "北京",
        "season": "",
        "weather": "",
        "temperature": "",
        "occasion": "周末日常外出",
        "style_pref": "简约休闲",
        "extra": "",
    }
    profile = {
        "gender": str(payload.get("gender", defaults["gender"]) or defaults["gender"]).strip(),
        "age": str(payload.get("age", defaults["age"]) or defaults["age"]).strip(),
        "height": str(payload.get("height", defaults["height"]) or defaults["height"]).strip(),
        "weight": str(payload.get("weight", defaults["weight"]) or defaults["weight"]).strip(),
        "body_type": str(payload.get("bodyType", "") or payload.get("body_type", "") or defaults["body_type"]).strip(),
        "city": str(payload.get("city", defaults["city"]) or defaults["city"]).strip(),
        "season": str(payload.get("season", defaults["season"]) or defaults["season"]).strip(),
        "weather": str(payload.get("weather", defaults["weather"]) or defaults["weather"]).strip(),
        "temperature": str(payload.get("temperature", defaults["temperature"]) or defaults["temperature"]).strip(),
        "occasion": str(payload.get("occasion", defaults["occasion"]) or defaults["occasion"]).strip(),
        "style_pref": str(payload.get("stylePref", "") or payload.get("style_pref", "") or defaults["style_pref"]).strip(),
        "extra": str(payload.get("extra", defaults["extra"]) or defaults["extra"]).strip(),
    }
    return profile


def encode_image_bytes(image_bytes: bytes, filename: str = "", mime: str = "") -> Tuple[str, str]:
    ext = os.path.splitext(filename or "")[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    guessed = mime_map.get(ext, "image/jpeg")
    image_mime = mime or guessed

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)
        data = out.getvalue()
        return base64.b64encode(data).decode("utf-8"), "image/jpeg"
    except Exception:
        return base64.b64encode(image_bytes).decode("utf-8"), image_mime


def decode_image_base64(raw: str) -> bytes:
    value = str(raw or "").strip()
    if "," in value and value.startswith("data:image"):
        value = value.split(",", 1)[1]
    return base64.b64decode(value)


def call_once(messages: list, model: str) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        max_tokens=1600,
        stream=False,
    )
    return resp.choices[0].message.content if resp and resp.choices else ""


def vision_parse(image_b64: str, image_mime: str) -> Dict:
    prompt = """请仔细观察图片中的穿搭，输出以下结构化信息（JSON 格式）：
{
  "items": ["上衣", "下装", "外套（若有）", "鞋子", "配饰（若有）"],
  "colors": {"main": "主色", "secondary": "辅色", "accent": "点缀色"},
  "silhouette": "整体廓形",
  "fabric_guess": "面料推测",
  "style_tags": ["风格标签"],
  "occasion_guess": "推测适合场合",
  "season_guess": "推测适合季节"
}
只输出 JSON，不要额外解释。"""
    raw = call_once(
        [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{image_mime};base64,{image_b64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
        model=MODEL_VL,
    )
    txt = (raw or "").strip()
    if txt.startswith("```"):
        lines = txt.split("\n")
        txt = "\n".join(lines[1:-1]) if lines and lines[-1].strip() == "```" else "\n".join(lines[1:])
    try:
        return json.loads(txt)
    except Exception:
        return {"raw": raw}


def style_analyze(profile: Dict, vision: Dict, weather_ctx: Dict) -> str:
    weather_text = ""
    if "weather" in weather_ctx:
        weather_text += weather_ctx["weather"].get("full_text", "")
    if "air" in weather_ctx:
        weather_text += f"\n\n{weather_ctx['air'].get('text', '')}"

    profile_text = "\n".join([f"- {k}: {v}" for k, v in profile.items() if v]) or "未提供"
    vision_text = json.dumps(vision, ensure_ascii=False, indent=2)

    prompt = f"""你是专业形象顾问。基于以下信息进行 5 维度深度分析：
## 实时天气数据
{weather_text or "暂无"}
## 用户画像
{profile_text}
## 视觉识别结果
{vision_text}

请分析：
1. 风格定位
2. 色彩搭配
3. 版型与身材适配
4. 场合适配度（结合实时天气）
5. 天气与季节适配（结合实时天气给出具体建议）
每维度 2-4 句话，专业具体。"""

    return call_once(
        [{"role": "system", "content": "你是专业形象顾问，善用天气数据支持穿搭建议。"}, {"role": "user", "content": prompt}],
        model=MODEL_TEXT,
    )


def generate_report(profile: Dict, vision: Dict, weather_ctx: Dict, analysis: str, user_prompt: str) -> str:
    data_source = "和风天气实时API" if weather_ctx else "用户输入/无实时天气"
    context = "\n".join([
        f"视觉识别：{json.dumps(vision, ensure_ascii=False)}",
        f"用户画像：{json.dumps(profile, ensure_ascii=False)}",
        f"天气数据：{json.dumps(weather_ctx, ensure_ascii=False)}",
        f"多维分析：{analysis}",
        f"用户问题：{user_prompt or '请综合分析'}",
    ])
    prompt = f"""你是专业形象顾问。综合以下信息给出最终建议：
{context}

请输出：
## 🔍 综合评价（2-3句）
## ✅ 五维评分（每项 1-10⭐）
## 🛠 改进建议（必改/可选/加分项）
## 👗 两套搭配方案
## 🌤️ 天气适配建议（结合实时天气）
数据来源：{data_source}
使用 Markdown，内容具体可执行。"""

    return call_once(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        model=MODEL_TEXT,
    )


def build_report_prompt(profile: Dict, vision: Dict, weather_ctx: Dict, analysis: str, user_prompt: str) -> str:
    data_source = "和风天气实时API" if weather_ctx else "用户输入/无实时天气"
    context = "\n".join([
        f"视觉识别：{json.dumps(vision, ensure_ascii=False)}",
        f"用户画像：{json.dumps(profile, ensure_ascii=False)}",
        f"天气数据：{json.dumps(weather_ctx, ensure_ascii=False)}",
        f"多维分析：{analysis}",
        f"用户问题：{user_prompt or '请综合分析'}",
    ])
    return f"""你是专业形象顾问。综合以下信息给出最终建议：
{context}

请输出：
## 🔍 综合评价（2-3句）
## ✅ 五维评分（每项 1-10⭐）
## 🛠 改进建议（必改/可选/加分项）
## 👗 两套搭配方案
## 🌤️ 天气适配建议（结合实时天气）
数据来源：{data_source}
使用 Markdown，内容具体可执行。"""


def build_pipeline(prompt: str, payload: Dict, image_bytes: Optional[bytes], image_name: str, image_mime: str):
    profile = parse_profile(payload)

    weather_ctx = {}
    city = profile.get("city", "")
    try:
        weather_ctx = fetch_qweather(city) if city else {}
        if weather_ctx.get("weather"):
            w = weather_ctx["weather"]
            profile["weather"] = profile.get("weather") or w.get("text", "")
            profile["temperature"] = profile.get("temperature") or f"{w.get('feelsLike', w.get('temp', ''))}°C（实测 {w.get('temp', '')}°C）"
            profile["season"] = profile.get("season") or infer_season_by_temp(w.get("temp", ""), default=profile.get("season", ""))
    except Exception:
        weather_ctx = {}

    vision = {"note": "未上传图片，跳过视觉识别"}
    if image_bytes:
        b64, mime = encode_image_bytes(image_bytes, filename=image_name, mime=image_mime)
        vision = vision_parse(b64, mime)

    analysis = style_analyze(profile, vision, weather_ctx)
    report_prompt = build_report_prompt(profile, vision, weather_ctx, analysis, prompt)
    return profile, weather_ctx, vision, analysis, report_prompt


def extract_outfit_desc(report: str) -> str:
    prompt = f"""从以下穿搭分析报告中提取“方案一”的搭配描述（上衣+下装+外套+鞋子+配饰），不超过60字，只输出描述本身：
{(report or '')[:1800]}"""
    text = call_once(
        [{"role": "system", "content": "你是穿搭提取助手，只输出纯描述文本。"}, {"role": "user", "content": prompt}],
        model=MODEL_TEXT
    )
    return (text or "").strip().replace("\n", " ")


def generate_outfit_image_url(outfit_desc: str, gender: str = "女") -> str:
    if not DASHSCOPE_API_KEY or not outfit_desc:
        return ""
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }
    gender_word = "young woman" if "女" in str(gender) else "young man"
    image_prompt = (
        f"A professional fashion photo of a {gender_word}, wearing {outfit_desc}, "
        "full body shot, white clean background, natural lighting, high resolution, fashion magazine style"
    )
    payload = {
        "model": WANX_MODEL,
        "input": {"prompt": image_prompt, "negative_prompt": "low quality, blurry, deformed"},
        "parameters": {"style": "<auto>", "size": "720*1280", "n": 1},
    }
    with httpx.Client(timeout=30.0) as h:
        resp = h.post(
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
            headers=headers,
            json=payload,
        )
        data = resp.json()
        task_id = (data.get("output") or {}).get("task_id", "")
        if not task_id:
            return ""
        query_headers = {"Authorization": f"Bearer {DASHSCOPE_API_KEY}"}
        for _ in range(24):
            time.sleep(5)
            q = h.get(f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}", headers=query_headers).json()
            status = (q.get("output") or {}).get("task_status", "")
            if status == "SUCCEEDED":
                results = (q.get("output") or {}).get("results") or []
                if results and isinstance(results, list):
                    return str(results[0].get("url", "") or "")
                return ""
            if status == "FAILED":
                return ""
    return ""


@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "time": int(time.time()),
        "dashscope": bool(DASHSCOPE_API_KEY),
        "qweather": bool(QWEATHER_API_KEY),
    })


@app.post("/api/mini/outfit-advisor-mcp")
def outfit_advisor_mcp():
    if not DASHSCOPE_API_KEY:
        return jsonify({"code": 500, "message": "DASHSCOPE_API_KEY is not set"}), 500

    payload = request.get_json(silent=True) or {}
    if request.form:
        payload = dict(request.form)
    prompt = str(payload.get("prompt", "") or payload.get("userInput", "") or "").strip()
    image_file = request.files.get("image")
    image_bytes = None
    image_mime = "image/jpeg"
    image_name = ""
    if image_file:
        image_bytes = image_file.read()
        image_mime = image_file.mimetype or image_mime
        image_name = image_file.filename or ""
    elif payload.get("imageBase64"):
        try:
            image_bytes = decode_image_base64(str(payload.get("imageBase64")))
        except Exception:
            return jsonify({"code": 400, "message": "invalid imageBase64"}), 400

    profile, weather_ctx, vision, analysis, report_prompt = build_pipeline(
        prompt=prompt,
        payload=payload,
        image_bytes=image_bytes,
        image_name=image_name,
        image_mime=image_mime,
    )
    report = call_once(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": report_prompt}],
        model=MODEL_TEXT,
    )
    outfit_desc = extract_outfit_desc(report or analysis)
    generated_image_url = generate_outfit_image_url(outfit_desc, profile.get("gender", "女"))

    return jsonify({
        "success": True,
        "advice": report or analysis or "已完成分析，但结果为空。",
        "analysis": analysis,
        "vision_result": vision,
        "weather_context": weather_ctx,
        "profile_used": profile,
        "outfit_desc": outfit_desc,
        "generated_image_url": generated_image_url,
    })


@app.post("/api/mini/fashion-advice")
def fashion_advice():
    """风格+场景穿搭建议 API"""
    payload = request.get_json(silent=True) or {}
    style = str(payload.get("style", "") or "").strip()
    scene = str(payload.get("scene", "") or "").strip()
    username = str(payload.get("username", "") or "anonymous").strip()

    if not style or not scene:
        return jsonify({"success": False, "message": "style 和 scene 参数必填"}), 400

    # 风格和场景的穿搭建议 prompt
    prompt = f"""你是专业时尚穿搭顾问。请为以下场景提供穿搭建议：

用户风格偏好：{style}
使用场景：{scene}
用户名：{username}

请提供：
1. 整体穿搭思路（2-3句话）
2. 推荐的具体单品搭配（上下装+外套+鞋子+配饰）
3. 色彩搭配建议
4. 3个实用穿搭小贴士

要求：
- 结合场景实用性
- 给出可操作的建议
- 不要使用任何 Markdown 格式符号（如 ##、**、- 等），直接用自然段落输出"""

    advice_text = ""
    if DASHSCOPE_API_KEY:
        try:
            advice_text = call_once(
                [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
                model=MODEL_TEXT,
            )
        except Exception as e:
            advice_text = f"AI服务调用失败: {str(e)}"
    else:
        advice_text = f"未配置 DASHSCOPE_API_KEY，无法生成AI建议。风格：{style}，场景：{scene}"

    # 解析建议文本，提取小贴士
    tips = []
    if "1." in advice_text or "①" in advice_text:
        import re
        tip_matches = re.findall(r'[（(][^）)]*[）)]', advice_text)
        tips = [t.strip('（）()').strip() for t in tip_matches if len(t) < 50][:3]

    return jsonify({
        "success": True,
        "advice": advice_text or f"基于{style}风格，为{scene}场合的穿搭建议已生成。",
        "style": style,
        "scene": scene,
        "tips": tips or ["注意整体色彩搭配", "选择适合场合的服装", "保持舒适自信最重要"]
    })


@app.post("/api/mini/outfit-advisor-mcp-stream")
def outfit_advisor_mcp_stream():
    if not DASHSCOPE_API_KEY:
        return jsonify({"code": 500, "message": "DASHSCOPE_API_KEY is not set"}), 500

    payload = request.get_json(silent=True) or {}
    if request.form:
        payload = dict(request.form)
    prompt = str(payload.get("prompt", "") or payload.get("userInput", "") or "").strip()
    image_file = request.files.get("image")
    image_bytes = None
    image_mime = "image/jpeg"
    image_name = ""
    if image_file:
        image_bytes = image_file.read()
        image_mime = image_file.mimetype or image_mime
        image_name = image_file.filename or ""
    elif payload.get("imageBase64"):
        try:
            image_bytes = decode_image_base64(str(payload.get("imageBase64")))
        except Exception:
            return jsonify({"code": 400, "message": "invalid imageBase64"}), 400

    profile, weather_ctx, vision, analysis, report_prompt = build_pipeline(
        prompt=prompt,
        payload=payload,
        image_bytes=image_bytes,
        image_name=image_name,
        image_mime=image_mime,
    )

    def _event(data: Dict) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    @stream_with_context
    def generate():
        yield _event({"type": "meta", "profile_used": profile, "weather_context": weather_ctx, "vision_result": vision})
        full = []
        try:
            stream = client.chat.completions.create(
                model=MODEL_TEXT,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": report_prompt},
                ],
                stream=True,
                temperature=0.7,
                max_tokens=2048,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk and chunk.choices else None
                token = getattr(delta, "content", None) if delta else None
                if token:
                    full.append(token)
                    yield _event({"type": "token", "delta": token})
            final_report = "".join(full)
            outfit_desc = extract_outfit_desc(final_report or analysis)
            generated_image_url = generate_outfit_image_url(outfit_desc, profile.get("gender", "女"))
            if generated_image_url:
                yield _event({"type": "image", "url": generated_image_url, "desc": outfit_desc})
            yield _event({
                "type": "done",
                "advice": final_report,
                "analysis": analysis,
                "outfit_desc": outfit_desc,
                "generated_image_url": generated_image_url
            })
        except Exception as e:
            yield _event({"type": "error", "message": str(e)})
            yield _event({"type": "done", "advice": "", "analysis": analysis})

    headers = {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return Response(generate(), headers=headers)


if __name__ == "__main__":
    host = os.environ.get("OUTFIT_HOST", "0.0.0.0")
    port = int(os.environ.get("OUTFIT_PORT", "5001"))
    app.run(host=host, port=port, debug=True)
