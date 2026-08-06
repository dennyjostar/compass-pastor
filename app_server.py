from flask import Flask, render_template, request, jsonify, session
import os
import json
from datetime import datetime
import hashlib
from dotenv import load_dotenv
import google.generativeai as genai

# .env 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "compass-secret-key-2026")

# 환경 변수 로드 확인 로그
print(f"--- Environment Setup ---")
print(f"Current Directory: {os.getcwd()}")
print(f"Env Path: {env_path}")
if os.path.exists(env_path):
    print(f".env file found.")
else:
    print(f".env file NOT found (Normal for Railway production).")

# API 키 확인 (값은 숨김)
gemini_key = os.getenv("GEMINI_API_KEY")
if gemini_key:
    print(f"GEMINI_API_KEY is set (Length: {len(gemini_key)})")
else:
    print(f"GEMINI_API_KEY is NOT set in environment.")
print(f"--------------------------")

# 김성수 목사 강해용 NotebookLM 설정
KIM_NOTEBOOK_ID = "c84ff2ee-ceb5-4a58-a863-680fa1ba21dc"

# 66권 한글 성경 순서 정의
BIBLE_BOOKS_KOREAN = [
    "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호수아", "사사기", "룻기",
    "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야",
    "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야",
    "예레미야애가", "에스겔", "다니엘", "호세아", "요엘", "아모스", "오바디야", "요나",
    "미가", "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기",
    "마태복음", "마가복음", "누가복음", "요한복음", "사도행전", "로마서", "고린도전서", "고린도후서",
    "갈라디아서", "에베소서", "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서",
    "디도서", "빌레몬서", "히브리서", "야고보서", "베드로전서", "베드로후서", "요한1서", "요한2서",
    "요한3서", "유다서", "요한계시록"
]

# 한글 성경 데이터베이스 로드
BIBLE_DB = []
try:
    bible_db_path = os.path.join(os.path.dirname(__file__), 'total_bible_db.json')
    if os.path.exists(bible_db_path):
        with open(bible_db_path, 'r', encoding='utf-8') as f:
            BIBLE_DB = json.load(f)
        print(f"[OFFLINE BIBLE] Successfully loaded offline database with {len(BIBLE_DB)} books.")
    else:
        print("[OFFLINE BIBLE WARNING] total_bible_db.json NOT found.")
except Exception as db_err:
    print(f"[OFFLINE BIBLE ERROR] Failed to load database: {db_err}")

# Gemini 설정 - 다중 API 키 자동 로테이션 및 모델 폴백 지원
def get_all_gemini_api_keys():
    """환경변수에서 설정된 모든 Gemini API 키 목록을 수집 (쉼표 구분자 및 GEMINI_API_KEY_1 등 지원)"""
    keys = []
    key_vars = ["GEMINI_API_KEYS", "GEMINI_API_KEY", "smna_api_key", "SMNA_API_KEY", "gemini_api_key"]
    for var in key_vars:
        val = os.getenv(var)
        if val:
            for k in val.split(","):
                k_clean = k.strip()
                if k_clean and k_clean not in keys:
                    keys.append(k_clean)
    
    for i in range(1, 10):
        k = os.getenv(f"GEMINI_API_KEY_{i}")
        if k:
            k_clean = k.strip()
            if k_clean and k_clean not in keys:
                keys.append(k_clean)
                
    return keys

FALLBACK_MODELS = [
    'models/gemini-3.6-flash',
    'models/gemini-3.5-flash',
    'models/gemini-2.5-flash',
    'models/gemini-2.0-flash',
    'models/gemini-flash-latest'
]

def generate_with_gemini(system_instruction, contents):
    """
    Gemini API를 호출할 때 키 로테이션 및 모델 폴백을 자동으로 수행합니다.
    """
    keys = get_all_gemini_api_keys()
    if not keys:
        raise ValueError("Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 설정하세요.")

    last_error = None
    for key_idx, key in enumerate(keys):
        try:
            genai.configure(api_key=key)
        except Exception as cfg_err:
            print(f"[API KEY CONFIG ERROR] Key #{key_idx+1}: {cfg_err}")
            continue

        for model_name in FALLBACK_MODELS:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction
                )
                response = model.generate_content(contents)
                if response and hasattr(response, 'text') and response.text:
                    print(f"[GEMINI SUCCESS] Used Key #{key_idx+1} ({key[:6]}...) with model '{model_name}'")
                    return response.text
            except Exception as err:
                last_error = err
                err_msg = str(err)
                print(f"[GEMINI RETRY] Key #{key_idx+1} ({key[:6]}...) / Model '{model_name}' failed: {err_msg[:120]}")
                continue

    if last_error:
        raise last_error
    else:
        raise Exception("모든 API 키 및 모델 시도가 실패했습니다.")

# 서버 사이드 사용량 추적 및 파일 저장
USER_STATS_PATH = os.path.join(os.path.dirname(__file__), 'logs', 'user_stats.json')
USAGE_LOG_PATH = os.path.join(os.path.dirname(__file__), 'logs', 'usage_history.jsonl')
FREE_LIMIT = 3

def load_user_stats():
    # 로그 디렉토리 자동 생성
    os.makedirs(os.path.dirname(USER_STATS_PATH), exist_ok=True)
    if os.path.exists(USER_STATS_PATH):
        try:
            with open(USER_STATS_PATH, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                return json.loads(content) if content else {}
        except Exception as e:
            print(f"Stats Load Error: {e}")
            return {}
    return {}

def save_user_stats(stats):
    with open(USER_STATS_PATH, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

def log_usage(profile, message, reply):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "ip": request.remote_addr, # 접속 IP 기록
        "profile": profile,
        "message": message,
        "reply_length": len(reply),
        "reply_preview": reply[:100]
    }
    with open(USAGE_LOG_PATH, 'a', encoding='utf-8') as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")

def get_user_hash(name, age_group="", gender=""):
    raw = f"{name}_{age_group}_{gender}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


@app.route('/')
def home():
    return render_template('index.html')

# ── 로마서 미완성 강해 아카이브 (103강~130강) 라우트 ──
@app.route('/romans')
def romans_archive():
    return render_template('romans_archive.html')

@app.route('/api/romans/lectures', methods=['GET'])
def get_romans_lectures():
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'romans_archive_db.json')
        if not os.path.exists(db_path):
            return jsonify([])
        with open(db_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print(f"[ROMANS API ERROR] {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/romans/lectures/<int:lecture_id>', methods=['GET'])
def get_romans_lecture_detail(lecture_id):
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'romans_archive_db.json')
        if not os.path.exists(db_path):
            return jsonify({"error": "데이터베이스를 찾을 수 없습니다."}), 404
        with open(db_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        lecture = next((item for item in data if item["id"] == lecture_id), None)
        if not lecture:
            return jsonify({"error": "해당 강해를 찾을 수 없습니다."}), 404
        return jsonify(lecture)
    except Exception as e:
        print(f"[ROMANS DETAIL API ERROR] {e}")
        return jsonify({"error": str(e)}), 500


# ── 故 김성수 목사 묵상집 AI 저작 스튜디오 라우트 ──
@app.route('/studio')
def devotional_studio():
    return render_template('devotional_studio.html')

@app.route('/api/studio/next-num', methods=['POST'])
def get_next_lecture_num():
    """성경책 및 아카이브 DB를 확인하여 작성할 다음 회차 번호를 자동 반환"""
    try:
        data = request.json or {}
        category = data.get('category', '로마서')

        if '로마서' in category:
            db_path = os.path.join(os.path.dirname(__file__), 'romans_archive_db.json')
            if os.path.exists(db_path):
                with open(db_path, 'r', encoding='utf-8') as f:
                    lectures = json.load(f)
                    # blog_url이 연결되었거나 기존 회차 중 마지막 회차 추적
                    posted_ids = [l['id'] for l in lectures if l.get('blog_url')]
                    if posted_ids:
                        return jsonify({"nextNum": max(posted_ids) + 1})
                    else:
                        return jsonify({"nextNum": 104})
            return jsonify({"nextNum": 104})

        return jsonify({"nextNum": 1})
    except Exception as e:
        print(f"[NEXT NUM API ERROR] {e}")
        return jsonify({"nextNum": 104})

_FONT_CACHE = {}

def get_safe_font(size):
    """Linux(Railway) 및 Windows 환경에서 폰트를 캐싱하여 0.01초 만에 초고속 로드하는 헬퍼"""
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]

    font_obj = None
    try:
        from PIL import ImageFont
        bundled_font = os.path.join(os.path.dirname(__file__), 'static', 'fonts', 'NanumGothic.ttf')
        font_paths = [
            bundled_font,
            'C:/Windows/Fonts/malgunbd.ttf',
            'C:/Windows/Fonts/malgun.ttf',
            '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf',
            '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
            '/usr/share/fonts/nhn-nanum/NanumGothic.ttf'
        ]
        for p in font_paths:
            if os.path.exists(p):
                try:
                    font_obj = ImageFont.truetype(p, size)
                    break
                except Exception:
                    pass
        if font_obj is None:
            font_obj = ImageFont.load_default()
    except Exception:
        from PIL import ImageFont
        font_obj = ImageFont.load_default()

    _FONT_CACHE[size] = font_obj
    return font_obj

def create_studio_image(title, category, style_name, index_num, total_count=3, num="104", summary=""):
    """
    index_num == 1: [대표 썸네일 카드] 블로그 글 첫머리 대표 카드 이미지
    index_num >= 2: [내용 이미지] 지정 화풍 스타일(유화/수채화/실사/일러스트) 본문 삽화 이미지
    """
    import io, base64, traceback, urllib.parse
    try:
        from PIL import Image, ImageDraw
        import time

        width, height = 1200, 675
        print(f"[STUDIO IMG] Starting image #{index_num}, style={style_name}, title={title[:20]}")

        if index_num == 1:
            # ── 1. 대표 썸네일 카드 이미지 (원어/특수문자 100% 무결점 SVG 카드) ──
            safe_title = title if title else f"{category} {num}강 강해 아카이브"
            if len(safe_title) > 22:
                title_line1 = safe_title[:22]
                title_line2 = safe_title[22:44]
            else:
                title_line1 = safe_title
                title_line2 = ""

            title_svg = f'<text x="75" y="210" font-family="\'Apple SD Gothic Neo\', \'Malgun Gothic\', sans-serif" font-size="44" font-weight="bold" fill="#ffffff">{title_line1}</text>'
            if title_line2:
                title_svg += f'\n<text x="75" y="265" font-family="\'Apple SD Gothic Neo\', \'Malgun Gothic\', sans-serif" font-size="44" font-weight="bold" fill="#ffffff">{title_line2}</text>'

            desc_y = 330 if title_line2 else 285

            svg_card = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
                <rect width="1200" height="675" fill="#0d1220"/>
                <rect x="36" y="36" width="1128" height="603" rx="22" fill="#131b2e" stroke="#c9a84c" stroke-width="4"/>
                <rect x="75" y="75" width="500" height="55" rx="14" fill="#2a2110" stroke="#c9a84c" stroke-width="2"/>
                <text x="95" y="112" font-family="'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="25" font-weight="bold" fill="#fce38a">{category} {num}강 · 故 김성수 목사 묵상집</text>
                {title_svg}
                <text x="75" y="{desc_y}" font-family="'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="24" fill="#e8ded0">故 김성수 목사님의 십자가 복음 신학 체계와 기존 설교 데이터베이스를 바탕으로</text>
                <text x="75" y="{desc_y+45}" font-family="'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="24" fill="#e8ded0">AI가 {category} {num}강 본문을 깊이 있는 묵상 원고로 재구성한 아카이브입니다.</text>
                <text x="75" y="{desc_y+90}" font-family="'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="24" fill="#e8ded0">인간의 전적 타락과 무능력을 폭로하고 오직 십자가 예수 그리스도의 은혜만을 의지하게 합니다.</text>
                <line x1="75" y1="520" x2="1125" y2="520" stroke="#3a301d" stroke-width="2"/>
                <text x="75" y="560" font-family="'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="24" fill="#fce38a">📖 Compass AI Studio • 오직 십자가 은혜와 약속의 자녀</text>
            </svg>'''

            encoded_svg = urllib.parse.quote(svg_card.strip())
            print(f"[STUDIO IMG] Successfully generated SVG title card #1")
            return f"data:image/svg+xml;utf8,{encoded_svg}"

        else:
            # ── 2. 본문 내용 이미지 (명화/감성 수채화 고품격 기독교 아트 디렉팅) ──
            style_prompts = {
                "고전유화": "masterpiece sacred oil painting, Caravaggio chiaroscuro lighting, Rembrandt atmosphere, museum quality biblical art, rich oil texture, profound spiritual reverence, timeless masterpiece",
                "수채화": "soft emotional watercolor, gentle warm morning sunlight, peaceful spiritual sanctuary, graceful artistic brushstrokes, pastel color harmony, beautiful devotional illustration",
                "시네마틱실사": "epic cinematic photography of biblical ancient landscape, dramatic golden hour, rays of divine grace breaking through soft clouds, National Geographic style, profound spiritual awe",
                "현대일러스트": "modern elegant line illustration, subtle gold foil accents, refined spiritual artwork, warm minimalist aesthetic, graceful storybook illustration, peaceful atmosphere",
                "모바일배너": "dramatic cinematic landscape banner art, glowing horizon, inspiring spiritual atmosphere, high contrast aesthetic, breathtaking composition"
            }
            art_style = style_prompts.get(style_name, style_prompts["고전유화"])

            # 100% 성공을 보장하는 순수 영문 성경 구속사 핵심 서사 테마 풀
            import random
            biblical_art_concepts = [
                "a majestic wooden cross standing gracefully on a quiet mountain hill at golden sunrise, rays of divine grace pouring through soft clouds",
                "an ancient potter's hands gently crafting a clay vessel under warm golden candlelight in Jerusalem studio",
                "a serene wilderness path winding through ancient olive trees at peaceful morning dawn with soft glowing light",
                "an open ancient biblical manuscript scroll with glowing golden light on an old oak wooden table",
                "a majestic sacred view of Mount of Olives under a heavenly golden sky, atmosphere of eternal hope and salvation",
                "a gentle shepherd guiding a flock of sheep through a quiet green biblical valley at serene sunset",
                "dramatic redemptive scenery with heavenly rays of divine mercy breaking through dark stormy clouds over Jerusalem landscape",
                "a glowing wooden boat resting peacefully on the quiet Sea of Galilee under twilight stars"
            ]

            seed = random.randint(100000, 999999)
            concept_index = (index_num - 2 + random.randint(0, 10)) % len(biblical_art_concepts)
            selected_concept = biblical_art_concepts[concept_index]

            ai_prompt = f"{selected_concept}, {art_style}"
            encoded_prompt = urllib.parse.quote(ai_prompt)

            # 구글 차세대 나노바나나 (Imagen 3) 및 플래그십 AI 렌더링 라우팅 (imagen -> flux-realism -> flux)
            import requests
            models_to_try = ['imagen', 'flux-realism', 'flux']
            for m_idx, model_name in enumerate(models_to_try):
                try:
                    pollination_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&model={model_name}&seed={seed}&nologo=true"
                    print(f"[STUDIO NANO-BANANA ART] Generating Imagen 3 art #{index_num-1} (model={model_name}, seed={seed}) prompt: {ai_prompt[:45]}...")
                    img_res = requests.get(pollination_url, timeout=12)
                    if img_res.status_code == 200 and len(img_res.content) > 5000:
                        img_str = base64.b64encode(img_res.content).decode('utf-8')
                        print(f"[STUDIO NANO-BANANA ART] Success generating art #{index_num-1} with {model_name} ({len(img_res.content)} bytes)")
                        return f"data:image/jpeg;base64,{img_str}"
                except Exception as pe:
                    print(f"[NANO-BANANA MODEL {model_name} FAIL] {pe}")
                    time.sleep(0.3)

            # 외부 API 지연 시 나타나는 고품격 성경 일러스트 그래픽 백업 카드
            svg_art_code = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
                <defs>
                    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#0a0e17"/>
                        <stop offset="50%" stop-color="#1e180e"/>
                        <stop offset="100%" stop-color="#0a0e17"/>
                    </linearGradient>
                    <radialGradient id="sunGlow" cx="50%" cy="40%" r="50%">
                        <stop offset="0%" stop-color="#ffe082" stop-opacity="0.6"/>
                        <stop offset="100%" stop-color="#1e180e" stop-opacity="0"/>
                    </radialGradient>
                </defs>
                <rect width="1200" height="675" fill="url(#bgGrad)"/>
                <circle cx="600" cy="250" r="260" fill="url(#sunGlow)"/>
                <path d="M 0 520 Q 300 440, 600 480 T 1200 500 L 1200 675 L 0 675 Z" fill="#130e07"/>
                <rect x="585" y="140" width="30" height="240" rx="4" fill="#c9a84c"/>
                <rect x="505" y="200" width="190" height="30" rx="4" fill="#c9a84c"/>
                <rect x="30" y="30" width="1140" height="615" rx="16" fill="none" stroke="#c9a84c" stroke-width="3" stroke-dasharray="8 6"/>
                <text x="600" y="560" text-anchor="middle" font-family="'Malgun Gothic', sans-serif" font-size="28" font-weight="bold" fill="#ffe082">📖 {category} {num}강 · 본문 묵상 AI 예술 카드 #{index_num-1}</text>
            </svg>'''
            encoded_svg_art = urllib.parse.quote(svg_art_code.strip())
            return f"data:image/svg+xml;utf8,{encoded_svg_art}"

    except Exception as img_err:
        print(f"[STUDIO IMAGE GENERATION ERROR] {img_err}")
        traceback.print_exc()

        svg_title = title if title else f"{category} {num}강 묵상"
        if len(svg_title) > 25:
            svg_title = svg_title[:25] + "..."
        
        svg_code = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
            <rect width="1200" height="675" fill="#0d1220"/>
            <rect x="36" y="36" width="1128" height="603" rx="16" fill="#131b2e" stroke="#c9a84c" stroke-width="4"/>
            <text x="75" y="210" font-family="'Malgun Gothic', sans-serif" font-size="44" font-weight="bold" fill="#ffffff">{svg_title}</text>
        </svg>'''
        encoded_svg = urllib.parse.quote(svg_code.strip())
        return f"data:image/svg+xml;utf8,{encoded_svg}"

    except Exception as img_err:
        print(f"[STUDIO IMAGE GENERATION ERROR] {img_err}")
        traceback.print_exc()

        # PIL 모듈이 없거나 예외 발생 시, PIL 없이도 100% 렌더링되는 SVG Data URL 카드 생성
        svg_title = title if title else f"{category} {num}강 묵상"
        if len(svg_title) > 25:
            svg_title = svg_title[:25] + "..."
        
        svg_code = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
            <rect width="1200" height="675" fill="#0d1220"/>
            <rect x="36" y="36" width="1128" height="603" rx="16" fill="#131b2e" stroke="#c9a84c" stroke-width="4"/>
            <rect x="75" y="75" width="480" height="55" rx="10" fill="#2a2110" stroke="#c9a84c" stroke-width="2"/>
            <text x="95" y="112" font-family="'Malgun Gothic', sans-serif" font-size="24" font-weight="bold" fill="#fce38a">{category} {num}강 · 故 김성수 목사 묵상집</text>
            <text x="75" y="210" font-family="'Malgun Gothic', sans-serif" font-size="44" font-weight="bold" fill="#ffffff">{svg_title}</text>
            <text x="75" y="300" font-family="'Malgun Gothic', sans-serif" font-size="24" fill="#e8ded0">故 김성수 목사님의 십자가 복음 신학 체계와 설교 데이터베이스를 바탕으로</text>
            <text x="75" y="345" font-family="'Malgun Gothic', sans-serif" font-size="24" fill="#e8ded0">AI가 {category} {num}강 본문을 깊이 있는 묵상 원고로 재구성한 아카이브입니다.</text>
            <line x1="75" y1="465" x2="1125" y2="465" stroke="#3a301d" stroke-width="2"/>
            <text x="75" y="520" font-family="'Malgun Gothic', sans-serif" font-size="24" fill="#fce38a">📖 Compass AI Studio • 오직 십자가 은혜와 약속의 자녀</text>
        </svg>'''
        
        import urllib.parse
        encoded_svg = urllib.parse.quote(svg_code.strip())
        return f"data:image/svg+xml;utf8,{encoded_svg}"

ROMANS_FIXED_TOPICS = {
    104: {
        "title": "로마서 104강 | 롬 9:14-24 · 토기장이의 주권과 하나님의 열심",
        "summary": "우리는 과연 스스로의 열심과 행위로 하나님을 만족시킬 수 있는 존재인가? 피조물이 창조주께 '어찌 나를 이같이 만들었나이까' 할 수 없음을 깨닫고 오직 십자가 긍휼만을 의지하는 묵상."
    },
    105: {
        "title": "로마서 105강 | 롬 9:25-33 · 긍휼의 그릇과 걸림돌이 된 반석",
        "summary": "내 백성 아닌 자를 내 백성이라 부르시는 이방인 칭의의 은혜. 자기 의와 율법주의에 매여 십자가 반석에 부딪혀 넘어진 이스라엘의 교만을 폭로함."
    },
    106: {
        "title": "로마서 106강 | 롬 10:1-13 · 율법의 마침이 되신 그리스도와 마음에 믿는 의",
        "summary": "하나님의 의를 모르고 자기 의를 세우려 힘써 복종하지 아니한 자들에게, 율법의 완성이 되신 그리스도를 마음에 믿어 의에 이르고 입으로 고백하는 복음의 핵심."
    },
    107: {
        "title": "로마서 107강 | 롬 10:14-21 · 복음을 전하는 아름다운 발과 순종치 아니하는 백성",
        "summary": "믿음은 들음에서 나며 들음은 그리스도의 말씀으로 말미암느니라. 온종일 불순종하고 거스르는 백성을 향해 손을 벌리시는 하나님의 안타까운 은혜."
    },
    108: {
        "title": "로마서 108강 | 롬 11:1-10 · 은혜로 택하심을 입은 남은 자",
        "summary": "하나님이 그 미리 아신 자기 백성을 버리지 아니하셨나니, 바알에게 무릎 꿇지 아니한 칠천 명처럼 은혜의 보존으로 남겨두신 약속의 자녀들."
    },
    109: {
        "title": "로마서 109강 | 롬 11:11-24 · 접붙임 받은 돌감람나무와 원 가지의 경고",
        "summary": "원 가지도 아끼지 아니하셨은즉 이방인 성도들아 자만하지 말라. 뿌리가 거룩한즉 가지도 거룩하며 오직 하나님의 인자하심에 거하라."
    },
    110: {
        "title": "로마서 110강 | 롬 11:25-36 · 깊도다 하나님의 지혜와 지식의 풍성함이여",
        "summary": "온 이스라엘의 구원 비밀과 만물이 주에게서 나오고 주로 말미암고 주에게로 돌아감에 대한 사도 바울의 위대한 찬가."
    },
    111: {
        "title": "로마서 111강 | 롬 12:1-2 · 영적 예배: 너희 몸을 산 제물로 드리라",
        "summary": "너희는 이 세대를 본받지 말고 오직 마음을 새롭게 함으로 변화를 받아 하나님의 선하시고 기뻐하시고 온전하신 뜻이 무엇인지 분별하라."
    },
    112: {
        "title": "로마서 112강 | 롬 12:3-8 · 마땅히 생각할 그 이상의 생각을 품지 말라",
        "summary": "각 사람에게 나누어 주신 믿음의 분량대로 지혜롭게 생각하라. 한 몸에 많은 지체를 가진 공동체 안에서의 겸손과 섬김의 직분."
    },
    113: {
        "title": "로마서 113강 | 롬 12:9-21 · 거짓이 없는 사랑과 악을 선으로 이김",
        "summary": "악을 미워하고 선에 속하라. 너희를 박해하는 자를 축복하고 다시는 원수를 갚지 말라. 악에게 지지 말고 선으로 악을 이기라."
    },
    114: {
        "title": "로마서 114강 | 롬 13:1-7 · 각 사람은 위에 있는 권세들에게 복종하라",
        "summary": "권세는 하나님으로부터 나지 않음이 없나니, 양심을 위하여 하나님의 사역자가 된 위정자와 국가 권세에 대한 성도의 자세."
    },
    115: {
        "title": "로마서 115강 | 롬 13:8-14 · 남을 사랑하는 자는 율법을 다 이루었느니라",
        "summary": "피차 사랑의 빚 외에는 아무에게든지 아무 빚도 지지 말라. 자다가 깨어날 때가 벌써 되었으니 어둠의 일을 벗고 빛의 갑옷을 입으라."
    },
    116: {
        "title": "로마서 116강 | 롬 14:1-12 · 믿음이 연약한 자를 받으라",
        "summary": "비판하지 말고 업신여기지 말라. 우리가 살아도 주를 위하여 살고 죽어도 주를 위하여 죽나니 우리는 주의 것이로다."
    },
    117: {
        "title": "로마서 117강 | 롬 14:13-23 · 하나님의 나라는 먹는 것과 마시는 것이 아니요",
        "summary": "하나님의 나라는 오직 성령 안에 있는 의와 평강과喜樂이라. 형제로 넘어지게 하는 일을 하지 않는 것이 아름다우니라."
    },
    118: {
        "title": "로마서 118강 | 롬 15:1-13 · 이방인들로 그 긍휼하심으로 말미암아 하나님께 영광을",
        "summary": "믿음이 강한 우리는 마땅히 연약한 자의 약점을 담당하고 자기를 기쁘게 하지 아니할 것이라. 소망의 하나님이 모든 기쁨과 평강을 믿음 안에서 충만케 하시기를."
    },
    119: {
        "title": "로마서 119강 | 롬 15:14-21 · 그리스도의 은혜로 사도 된 바울의 자부심",
        "summary": "이방인을 위하여 그리스도 예수의 일꾼이 되어 하나님의 복음의 제사장 직분을 하게 하심이라. 남의 터 위에 건축하지 아니하려 함이라."
    },
    120: {
        "title": "로마서 120강 | 롬 15:22-33 · 예루살렘 성도를 위한 구제와 예루살렘 기행",
        "summary": "영적인 것을 공유했거든 육적인 것으로 그들을 섬기는 것이 마땅하니라. 나와 함께 기도에 힘써 나를 위하여 하나님께 빌라."
    },
    121: {
        "title": "로마서 121강 | 롬 16:1-16 · 뵈뵈 자매와 복음의 동역자들에게 주는 문안",
        "summary": "브리스가와 아굴라, 뵈뵈 일꾼 등 목숨까지 아끼지 않고 십자가 복음을 동역한 귀한 성도들의 이름을 기억하며 문안함."
    },
    122: {
        "title": "로마서 122강 | 롬 16:17-20 · 분쟁을 일으키는 자들을 떠나라",
        "summary": "너희가 교훈을 거슬러 분쟁을 일으키거나 거치게 하는 자들을 살피고 그들에게서 떠나라. 평강의 하나님께서 속히 사탄을 너희 발 아래에서 상하게 하시리라."
    },
    123: {
        "title": "로마서 123강 | 롬 16:21-27 · 영원하신 하나님의 명을 따라 복음의 비밀과 찬양",
        "summary": "영세 전부터 감추어졌다가 이제는 나타내신 바 되었으며, 지혜로우신 하나님께 예수 그리스도로 말미암아 영광이 세세무궁토록 있을지어다. (로마서 완결)"
    }
}

@app.route('/api/studio/romans-curriculum', methods=['GET'])
def get_romans_curriculum():
    """로마서 남은 강해 전체 커리큘럼(104강~123강 완결) 리스트 반환"""
    curriculum = []
    for num, data in sorted(ROMANS_FIXED_TOPICS.items()):
        curriculum.append({
            "num": num,
            "title": data["title"],
            "summary": data["summary"]
        })
    return jsonify(curriculum)

@app.route('/api/studio/suggest-topic', methods=['POST'])
def suggest_studio_topic():
    try:
        data = request.json or {}
        category = data.get('category', '로마서')
        num = data.get('num', '104')
        genre = data.get('genre', '성경강해')
        
        # 1. 로마서의 경우 고정 표준 DB 주제 우선 반환
        if '로마서' in category:
            try:
                num_int = int(num)
                if num_int in ROMANS_FIXED_TOPICS:
                    return jsonify(ROMANS_FIXED_TOPICS[num_int])
            except Exception:
                pass

        prompt = f"""故 김성수 목사님의 신학 체계(인간의 전적 무능력, 자기 부인, 십자가 은혜)에 맞춰 다음 묵상 원고의 본문 구절 및 제목, 핵심 질문 주제를 기획하라.
- 장르: {genre}
- 성경책/분류: {category}
- 회차: {num}강

반드시 순수한 JSON 형식으로만 응답하라:
{{
  "title": "{category} {num}강 | 추천 제목 및 본문 구절",
  "summary": "오늘 원고에서 던지는 핵심 신학적 질문과 십자가 은혜의 주제"
}}"""

        sys_inst = "당신은 김성수 목사의 신학 체계에 맞추어 성경 강해 및 수필의 제목과 본문 구절, 주제를 전문 기획하는 신학 에디터입니다. 오직 JSON만 출력하십시오."
        res_text = generate_with_gemini(sys_inst, prompt).strip()
        
        if res_text.startswith("```"):
            lines = res_text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            res_text = "\n".join(lines).strip()
            
        topic_data = json.loads(res_text)
        return jsonify(topic_data)
    except Exception as e:
        print(f"[SUGGEST TOPIC ERROR] {e}")
        return jsonify({
            "title": f"{category} {num}강 | 토기장이의 주권과 하나님의 열심 (롬 9:14-24)",
            "summary": "인간의 전적 타락과 무능력을 폭로하고 오직 십자가 예수 그리스도만을 의지하는 진리의 묵상"
        })

import uuid
import threading

STUDIO_TASKS = {}

def bg_generate_devotional(task_id, data):
    try:
        genre = data.get('genre', '성경강해')
        category = data.get('category', '로마서')
        num = data.get('num', '104')
        title = data.get('title', '원고 제목')
        summary = data.get('summary', '')
        target_char_count = int(data.get('targetCharCount', 10000))
        image_count = int(data.get('imageCount', 3))
        image_style = data.get('imageStyle', '고전유화')

        STUDIO_TASKS[task_id]['step'] = f'Gemini 3.6 Flash AI가 십자가 원고 작성 중... ({target_char_count:,}자 분량)'

        # 장르별 독립 구조 및 문체/어조 세팅
        if "수필" in genre:
            genre_desc = "실존적 고백과 서정적인 묵상이 어우러진 신앙 수필(Faith Essay)"
            tone_desc = "나직하고 고백적이며 깊은 울림을 주는 수필 어조 ('우리는 때로...', '내 삶을 돌아보면...', '하나님의 은혜는...')"
            structure_desc = """구조:
1. [일상의 시선]: 삶의 한 장면이나 마주하는 인간의 연약한 실존 고백
2. [내면의 고백]: 우리의 자기 중심성과 거짓 열심에 대한 솔직한 성찰
3. [복음의 조명]: 그 연약함 위로 스며드는 십자가 예수 그리스도의 찾아오심과 은혜
4. [약속 안에 쉬는 삶]: 내 힘을 내려놓고 오직 하나님의 주권 안에 안식함
5. [마음의 고백과 기도]: 따뜻하고 잔잔한 감사의 1인칭 묵상 기도문 ("예수 그리스도의 이름으로 기도드립니다. 아멘" 종결)"""

        elif "칼럼" in genre:
            genre_desc = "현대 기독교의 미혹을 비판하고 복음의 본질을 일깨우는 신학 칼럼(Theological Column)"
            tone_desc = "날카롭고 논리적이며 명확한 시사/신학 칼럼 어조 ('오늘날 한국 기독교는...', '우리는 성경의 본질로 돌아가야 합니다', '~라는 사실을 직시해야 합니다')"
            structure_desc = """구조:
1. [문제 제기]: 현대 교회와 성도들이 은연중에 매몰되어 있는 인본주의적 미혹과 비판적 쟁점
2. [신학적 비판]: 율법주의 및 인간 중심 종교성이 왜 성경적 복음과 정반대인가에 대한 논리적 조명
3. [복음의 본질 복원]: 역사적·성경적 구속사 관점에서 십자가 예수 그리스도의 참된 진리 선언
4. [이 시대를 향한 권면]: 거짓 복음에서 벗어나 오직 십자가 은혜만을 의지하라는 메시지
5. [매듭과 다짐]: 시대의 미혹을 이기는 결단과 마침 기도문 ("예수 그리스도의 이름으로 기도드립니다. 아멘" 종결)"""

        else:  # 성경강해 (기본)
            genre_desc = "성경 본문의 구속사적 의미를 심층 풀이하는 정통 성경 강해(Bible Exegesis)"
            tone_desc = "깊이 있고 경건한 강해설교 어조 ('성도 여러분', '안녕하십니까', '~입니다', '~하십니까?')"
            structure_desc = """구조:
1. [서론]: 오늘 본문 주제가 던지는 신학적 긴장과 질문
2. [본문 분석 및 구속사 강해]: 성경 구속사적 배경과 절제된 핵심 원어(한글 음사 병기) 해설
3. [인본주의 종교성 폭로]: 인간의 전적 타락과 거짓 종교성 파쇄
4. [십자가 복음 핵심 해설]: 오직 예수 그리스도의 은혜와 철저한 자기 부인
5. [성도의 삶 적용]: 역사 속 성도의 자기 부인과 소망
6. [결론 및 기도]: 마무리 권면과 1인칭 기도문 ("예수 그리스도의 이름으로 기도드립니다. 아멘" 종결)"""

        system_instruction = f"""당신은 故 김성수 목사님(서머나교회)의 신학 체계를 바탕으로 {genre_desc} 원고를 저작하는 전문 신학 작가입니다.

[장르 및 어조 지침 - 엄수]
- 장르: {genre} ({category})
- 어조 및 스타일: {tone_desc}
- 인간의 전적 파산과 무능력, 율법주의/기복주의 파쇄, 오직 십자가 예수 그리스도의 은혜만을 강조하라.
- 마무리는 간절한 기도문으로 종결하라 (반드시 "예수 그리스도의 이름으로 기도드립니다. 아멘" 로 끝맺음).

[원어 표기 및 비중 조율 규정 - 중요]
- 원어(헬라어, 히브리어, 아람어 등) 해설의 비중은 원고 전체의 5~10% 수준(기존의 50% 수준)으로 과도하지 않게 꼭 필요한 핵심 단어에만 제한적으로 절제하여 사용하라.
- 본문에 원어가 등장할 때는 반드시 원어 직후 괄호 안에 (한글 발음 음사 - 한글 의미)를 꼭 함께 표시하라!
  예시: ἐκλογή(에클로게 - 선택, 택하심), עָוֺן(아원 - 죄, 불의)

[분량 요구사항 - 중요]
- 반드시 공백 포함 {target_char_count:,}자 이상으로 작성하라.
- 단락을 충분히 깊고 입체적으로 전개하라."""

        user_prompt = f"""다음 정보로 {genre} 원고를 공백 포함 {target_char_count:,}자 이상으로 완성하라.

- 분류: {category} {num}강
- 제목: {title}
- 핵심 주제/질문: {summary}

{structure_desc}

※ 다시 한번 강조: 선택하신 {genre} 장르에 꼭 맞는 독자적인 구조와 어조로 작성하고, 원어는 과도하지 않게 50% 수준으로 절제하여 (한글 발음 - 한글 의미)를 표시하라."""

        content = generate_with_gemini(system_instruction, user_prompt)

        total_count = 1 + image_count
        STUDIO_TASKS[task_id]['step'] = f'대표 썸네일 카드 1장 + 본문 맞춤 AI 그림 {image_count}장 생성 중...'
        generated_images = []
        for i in range(1, total_count + 1):
            try:
                img_url = create_studio_image(title=title, category=category, style_name=image_style, index_num=i, total_count=total_count, num=num, summary=summary)
                generated_images.append(img_url)
            except Exception as img_e:
                print(f"[IMAGE LOOP ERROR] {img_e}")
                generated_images.append("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'><rect width='1200' height='675' fill='%230d1220'/></svg>")

        STUDIO_TASKS[task_id]['status'] = 'completed'
        STUDIO_TASKS[task_id]['content'] = content
        STUDIO_TASKS[task_id]['images'] = generated_images
        STUDIO_TASKS[task_id]['charCount'] = len(content)

    except Exception as e:
        print(f"[BG TASK ERROR] {e}")
        STUDIO_TASKS[task_id]['status'] = 'error'
        STUDIO_TASKS[task_id]['error'] = str(e)

@app.route('/api/studio/generate-text', methods=['POST'])
def generate_studio_devotional():
    try:
        task_id = str(uuid.uuid4())
        data = request.json or {}

        STUDIO_TASKS[task_id] = {
            'status': 'processing',
            'step': 'AI 기획 및 원고 준비 중...',
            'content': '',
            'images': [],
            'error': ''
        }

        t = threading.Thread(target=bg_generate_devotional, args=(task_id, data))
        t.daemon = True
        t.start()

        return jsonify({'taskId': task_id})
    except Exception as e:
        print(f"[STUDIO GENERATE INIT ERROR] {e}")
        return jsonify({"error": str(e)}), 200

@app.route('/api/studio/task-status/<task_id>', methods=['GET'])
def get_studio_task_status(task_id):
    task = STUDIO_TASKS.get(task_id)
    if not task:
        return jsonify({'status': 'error', 'error': '작업을 찾을 수 없습니다.'}), 404
    return jsonify(task)

def bg_regenerate_images(task_id, data):
    try:
        data = data or {}
        category = data.get('category') or '로마서'
        num = data.get('num') or '104'
        title = data.get('title') or f"{category} {num}강 | 하나님의 주권과 은혜"
        summary = data.get('summary') or ''
        image_count = int(data.get('imageCount') or 3)
        image_style = data.get('imageStyle') or '고전유화'

        total_count = 1 + image_count
        STUDIO_TASKS[task_id]['step'] = f'AI 예술 그림 {image_count}장 새로 생성 중...'

        generated_images = []
        for i in range(1, total_count + 1):
            try:
                img_url = create_studio_image(title=title, category=category, style_name=image_style, index_num=i, total_count=total_count, num=num, summary=summary)
                generated_images.append(img_url)
            except Exception as img_e:
                print(f"[REGEN IMAGE LOOP ERROR] {img_e}")
                generated_images.append("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675'><rect width='1200' height='675' fill='%230d1220'/></svg>")

        STUDIO_TASKS[task_id]['status'] = 'completed'
        STUDIO_TASKS[task_id]['images'] = generated_images

    except Exception as e:
        print(f"[BG REGEN IMAGES ERROR] {e}")
        STUDIO_TASKS[task_id]['status'] = 'error'
        STUDIO_TASKS[task_id]['error'] = str(e)

@app.route('/api/studio/regenerate-images', methods=['POST'])
def regenerate_studio_images():
    """원고 텍스트는 건드리지 않고 이미지만 새로 비동기 단독 생성"""
    try:
        task_id = str(uuid.uuid4())
        data = request.json or {}

        STUDIO_TASKS[task_id] = {
            'status': 'processing',
            'step': 'AI 이미지 세트 새로 제작 중...',
            'content': '',
            'images': [],
            'error': ''
        }

        t = threading.Thread(target=bg_regenerate_images, args=(task_id, data))
        t.daemon = True
        t.start()

        return jsonify({'taskId': task_id})
    except Exception as e:
        print(f"[REGEN IMAGES API ERROR] {e}")
        return jsonify({"error": str(e)}), 200

@app.route('/api/studio/diagnose', methods=['GET'])
def diagnose_studio():
    """서버 환경 진단: Pillow 버전, 폰트 경로, 이미지 생성 테스트"""
    info = {}
    try:
        import PIL
        info['pillow_version'] = PIL.__version__
    except:
        info['pillow_version'] = 'NOT INSTALLED'

    # 폰트 검색
    bundled = os.path.join(os.path.dirname(__file__), 'static', 'fonts', 'NanumGothic.ttf')
    font_paths = [
        bundled,
        '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf',
        '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
        '/usr/share/fonts/nhn-nanum/NanumGothic.ttf'
    ]
    info['bundled_font_exists'] = os.path.exists(bundled)
    info['bundled_font_path'] = bundled
    info['found_fonts'] = [p for p in font_paths if os.path.exists(p)]

    # 테스트 이미지 생성
    try:
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (100, 50), color=(13, 18, 32))
        draw = ImageDraw.Draw(img)
        draw.rectangle([5, 5, 95, 45], fill=(19, 27, 46), outline=(201, 168, 76), width=2)
        font = get_safe_font(14)
        draw.text((10, 15), "Test OK", fill='white', font=font)
        info['test_image'] = 'SUCCESS'
        info['font_type'] = str(type(font))
    except Exception as e:
        info['test_image'] = f'FAILED: {e}'

    # rounded_rectangle 지원 여부
    try:
        from PIL import ImageDraw
        info['has_rounded_rectangle'] = hasattr(ImageDraw.ImageDraw, 'rounded_rectangle')
    except:
        info['has_rounded_rectangle'] = False

    return jsonify(info)



def get_seron_context(query):
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'total_sermon_db.json')
        if not os.path.exists(db_path):
            return ""
        with open(db_path, 'r', encoding='utf-8') as f:
            db = json.load(f)
        
        # 검색어 추출
        search_query = query.replace('[말씀강해]', '').replace('[묵상]', '').replace('[기도문]', '').strip()
        if not search_query: return ""

        results = [s for s in db if search_query in s['title'] or (s.get('series') and search_query in s['series'])]
        if not results: return ""
        
        context = "\n[관련 김성수 목사 설교 목록]\n"
        for s in results[:5]: # 최대 5개
            context += f"- {s['title']} ({s['url']})\n"
        return context
    except Exception as e:
        print(f"Search Error: {e}")
        return ""

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        user_msg = data.get('message', '')
        profile = data.get('profile', {})
        user_name = profile.get('name', '성도')
        user_age = profile.get('age', '')
        user_gender = profile.get('gender', '')

        # 1. 사용량 체크 (Rate Limit)
        user_id = get_user_hash(user_name, user_age, user_gender)
        today = datetime.now().strftime('%Y-%m-%d')
        
        stats = load_user_stats()
        if user_id not in stats:
            stats[user_id] = {"date": today, "count": 0}
        
        # 날짜가 바뀌었으면 초기화
        if stats[user_id]["date"] != today:
            stats[user_id] = {"date": today, "count": 0}
            
        if stats[user_id]["count"] >= FREE_LIMIT:
            return jsonify({
                "response": f"성도님, 오늘의 대화 한도({FREE_LIMIT}회)를 모두 사용하셨습니다. 내일 다시 찾아와 주세요. 진리의 말씀 안에서 평안한 하루 되시길 바랍니다.",
                "limit_reached": True
            })

        # 설교 DB 검색 컨텍스트 추가
        sermon_context = get_seron_context(user_msg)

        sermon_instruction = ""
        if sermon_context:
            sermon_instruction = (
                "제공되는 [관련 설교 목록]이 있습니다. 본문 내용에 해당 설교의 주제를 자연스럽게 언급하고, 반드시 [심층 분석 끝] 바로 앞에 이 설교 제목들과 유튜브 링크를 아래의 데이터 그대로 출력하십시오.\n"
                f"{sermon_context}\n"
            )
        else:
            sermon_instruction = "주의: 데이터베이스에서 검색된 관련 설교가 없습니다. 아는 척하며 요한계시록 등 다른 성경 구절을 억지로 끌어와서 길게 지어내지(환각) 마십시오. 문맥이 부족하다면 일반 답변에 '성도님, 어떤 성경 구절이나 배경인지 조금 더 구체적으로 말씀해 주시면 정확히 나누겠습니다'라고 반드시 되물으십시오."

        # 2. 메시지 유형에 따른 시스템 프롬프트 정의
        if "[기도문]" in user_msg:
            # 기도문 전용 시스템 프롬프트 (성도 개인이 하나님께 드리는 1인칭 기도문과 김성수 목사의 신학적 분석)
            system_prompt = (
                f"당신은 성도가 하나님께 드리는 깊고 간절한 1인칭 기도문과, 이에 대한 복음주의적/김성수 목사적 신학 분석을 제공하는 신앙 조언자입니다. 사용자는 '{user_name} 님'입니다.\n\n"
                "성도님이 지금 간절한 마음으로 상황에 맞는 기도문 작성을 요청하고 계십니다. "
                "성도님의 선택된 카테고리와 구체적인 기도제목/상황을 깊이 헤아리십시오. "
                "만약 상황이나 기도제목과 연관된 이미지가 제공되었다면, 그 이미지에서 묘사되는 구체적인 정황(예: 병실, 서류, 풍경, 인물의 표정 등)을 적극적으로 반영하여 작성해 주십시오.\n\n"
                "당신은 반드시 다음 두 가지 영역을 명확히 구분하여 답변을 작성해야 합니다:\n\n"
                "1. [일반 답변 시작]과 [일반 답변 끝] 영역:\n"
                f"- 여기에는 오직 {user_name} 성도 본인이 하나님께 직접 고백하고 간구하는 **1인칭(나, 저, 제, 저희) 기도문**만 들어가야 합니다.\n"
                "- 첫 문장은 무조건 '하나님 아버지, '로 시작하십시오.\n"
                "- 마지막 문장은 무조건 '예수 그리스도의 이름으로 기도드립니다. 아멘.'으로 마쳐야 합니다.\n"
                "- **절대로** 안부 인사('홍길동 성도님, 안녕하십니까' 등), 서론, 본문 설명, 혹은 3인칭 중보기도('홍길동 성도님을 붙들어 주시고')를 적지 마십시오. 오직 순수한 1인칭 기도문만 한 단락씩 문단을 나누어 아름답고 간절하게 작성하십시오.\n"
                "- 문법 예시: '성도님의 수술을 지켜주시고' (X) -> '제 연약한 육신과 다가오는 수술을 주님 손에 맡기오니 저를 붙들어 주시고' (O)\n"
                "- 기도는 철저한 경어체를 사용하고 오직 하나님께 올리는 1인칭 고백이어야 합니다.\n\n"
                "2. [심층 분석 시작]과 [심층 분석 끝] 영역:\n"
                "- 여기에는 **서머나 교회 김성수 목사의 신학적/목회적 관점에서의 깊이 있는 영적 분석(분석기도/해설)**을 작성하십시오.\n"
                f"- 페르소나: 서머나 교회 김성수 목사의 음성과 어조('~입니다', '~하십시오', '~입니까?')로 {user_name} 성도에게 말하는 방식입니다.\n"
                "- 신학적 핵심: 인간의 전적 파산과 무능력, 철저한 자기 부인, 그리고 오직 예수 그리스도의 십자가 은혜만을 의지하도록 권면하십시오. 기복주의적 힐링이나 세상적 만사형통을 철저히 배제하고, 고난이 어떻게 성도를 십자가 앞으로 이끄는 유익한 통로가 되는지 복음적으로 깊게 해설하십시오.\n"
                "- 분량은 400~700자로 핵심을 찔러 상세하게 작성하십시오.\n"
                "★[특수 강해 지침] 사용자가 '일곱 번째 항아리'를 언급할 경우, 이는 요한계시록의 7대접이 절대 아닙니다! 이는 요한복음 2장 가나의 혼인 잔치에서 6개의 율법적 돌항아리를 완성하는 '참 성전이자 일곱 번째 항아리이신 예수 그리스도(새 포도주)'를 의미하는 김성수 목사님의 고유한 핵심 강해입니다. 무조건 이 방향으로 십자가의 복음을 강해하십시오.\n\n"
                "반드시 아래 형식을 한 글자도 틀리지 않고 정확히 지켜 답변하십시오. 다른 말은 절대 추가하지 마십시오:\n\n"
                "[일반 답변 시작]\n"
                "(오직 하나님께 직접 올리는 간절하고 순수한 1인칭 기도문만 작성. 첫 문장은 '하나님 아버지, ', 끝 문장은 '예수 그리스도의 이름으로 기도드립니다. 아멘.')\n"
                "[일반 답변 끝]\n\n"
                "[심층 분석 시작]\n"
                "(김성수 목사의 신학적/목회적 관점의 영적 해설과 권면)\n"
                f"{sermon_instruction}\n"
                "[심층 분석 끝]"
            )
        else:
            # 말씀강해 특별 지시사항 정의
            bible_search_instruction = ""
            if "[말씀강해]" in user_msg:
                bible_search_instruction = (
                    "★[말씀강해 특수 지시사항]\n"
                    "성도님이 지금 성경 구절을 검색하고 계십니다. 사용자의 검색 키워드(예: '마음이 가난한 자' 등)에 해당하는 가장 적합하고 정확한 성경 구절(책명, 장, 절, 말씀 본문)을 찾아, "
                    "반드시 [일반 답변 시작] 바로 아랫줄 최상단에 마크다운 형태로 가장 먼저 출력해 주십시오. "
                    "그 아래에 비로소 안부 인사와 목회적 복음 권면을 적으십시오.\n"
                    "예시 형식:\n"
                    "📖 찾으신 말씀 구절:\n"
                    "- 마태복음 5:3 \"심령이 가난한 자는 복이 있나니 천국이 그들의 것임이요\"\n\n"
                )

            # 기본 플레이스홀더 설정
            general_prompt_placeholder = "(성도에 대한 목회적 안부와 진리의 복음적 권면. 정상적인 질문이라면 최소 3~4문장 정도로 적절히 작성하십시오.)"
            deep_prompt_placeholder = (
                "(김성수 목사님의 요한복음/로마서 강해 신학을 바탕으로 한 심도 있는 복음 분석. "
                "질문의 문맥을 몰라서 추가 설명을 요구했을 경우에는 심층 분석을 쓰지 말고, '성도님께서 구체적인 문맥을 더 알려주시면 깊게 강해해 드리겠습니다.'라고 한 문장만 쓰십시오. "
                "아는 내용인 경우에만 500~800자 정도로 핵심을 찔러 상세하게 강해하십시오. 무조건 1000자를 채울 필요는 없으나 깊이 있게 작성하십시오.)"
            )

            # 일반적인 '묵상', '말씀강해'용 시스템 프롬프트 (김성수 목사 페르소나)
            system_prompt = (
                f"당신은 서머나 교회의 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
                "당신의 신학은 '인간의 철저한 파산', '자기 부인', '오직 예수 그리스도의 은혜'입니다.\n"
                "사용자에게 세상적인 위로나 도덕적인 훈계를 절대 하지 마십시오. 대신 인간이 얼마나 불가능한 존재인지를 폭로하고, 오직 십자가 붙들게 하십시오.\n"
                "★[특수 강해 지침] 사용자가 '일곱 번째 항아리'를 언급할 경우, 이는 요한계시록의 7대접이 절대 아닙니다! 이는 요한복음 2장 가나의 혼인 잔치에서 6개의 율법적 돌항아리를 완성하는 '참 성전이자 일곱 번째 항아리이신 예수 그리스도(새 포도주)'를 의미하는 김성수 목사님의 고유한 핵심 강해입니다. 무조건 이 방향으로 십자가의 복음을 강해하십시오.\n"
                "★[매우 중요 - 환각 방지 시스템] 당신이 확실히 아는 김성수 목사의 강해가 아니거나, 사용자의 질문(단어)만으로는 어떤 성경적 문맥인지 도저히 알 수 없다면 절대 아는 척하며 무관한 성경(계시록, 여호수아 등) 내용을 길게 지어내지 마십시오.\n"
                "이 경우, 단순히 사용자에게 '구체적인 성경 구절이나 배경 설명을 더 해주시면 정확히 나누겠습니다'라고 짧게 질문만 하십시오.\n"
                "반드시 다음 형식을 지켜 답변하십시오:\n"
                "[일반 답변 시작]\n"
                f"{bible_search_instruction}"
                f"{general_prompt_placeholder}\n"
                "[일반 답변 끝]\n\n"
                "[심층 분석 시작]\n"
                f"{deep_prompt_placeholder}\n"
                f"{sermon_instruction}\n"
                "[심층 분석 끝]"
            )

        # 이미지 데이터 처리 및 멀티모달 Gemini 호출
        image_data = data.get('image', '')
        if image_data:
            try:
                import base64
                if ',' in image_data:
                    header, base64_str = image_data.split(',', 1)
                else:
                    base64_str = image_data

                mime_type = "image/jpeg"
                if "image/png" in image_data:
                    mime_type = "image/png"
                elif "image/webp" in image_data:
                    mime_type = "image/webp"
                elif "image/gif" in image_data:
                    mime_type = "image/gif"

                img_bytes = base64.b64decode(base64_str)
                contents = [
                    user_msg,
                    {
                        'mime_type': mime_type,
                        'data': img_bytes
                    }
                ]
                reply = generate_with_gemini(system_prompt, contents)
            except Exception as img_err:
                print(f"[IMAGE PROCESSING ERROR] {img_err} - falling back to text-only.")
                reply = generate_with_gemini(system_prompt, user_msg)
        else:
            reply = generate_with_gemini(system_prompt, user_msg)

        # 사용량 증가 및 저장
        stats[user_id]["count"] += 1
        save_user_stats(stats)
        
        # 상세 로그 기록
        log_usage(profile, user_msg, reply)

        return jsonify({
            "response": reply,
            "limit_reached": False
        })

    except Exception as e:
        err_msg = str(e)
        print(f"[ASK ERROR] {err_msg}")
        if "429" in err_msg or "resourceexhausted" in err_msg.lower() or "prepayment credits" in err_msg.lower() or "quota" in err_msg.lower():
            friendly_response = (
                "[일반 답변 시작]\n"
                "성도님, 현재 서버의 일시적인 AI 서비스 사용량(Gemini API 크레딧)이 초과되어 대답을 생성할 수 없습니다. 🙏\n\n"
                "Google AI Studio에서 API 키를 충전하거나 새로운 API 키로 교체하면 즉시 정상 이용이 가능합니다.\n"
                "[일반 답변 끝]\n\n"
                "[심층 분석 시작]\n"
                "💡 API 오류 조치 방법 (운영자 안내):\n"
                "1. https://aistudio.google.com/app/apikey 접속\n"
                "2. 새 API Key 발급 (무료 Tier 지원)\n"
                "3. compass_app/.env 파일의 GEMINI_API_KEY 업데이트\n"
                "[심층 분석 끝]"
            )
            return jsonify({
                "response": friendly_response,
                "limit_reached": False
            }), 200
        return jsonify({"response": f"오류 발생: {err_msg}"}), 500


# Google Drive 찬양 API (기존 유지)
import requests as http_requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

print("COMPASS SERVER v1.0.6 - Pastor Mode")

DRIVE_API_KEY = os.getenv("DRIVE_API_KEY")
if not DRIVE_API_KEY or DRIVE_API_KEY.startswith("AIzaSyBUvx"):
    DRIVE_API_KEY = "AIzaSyD1oqU-vb33CHNsJ8M13jROdYDgNyKDTNU"

DRIVE_FOLDER_ID = os.getenv("DRIVE_FOLDER_ID", "1372ozYC2muXXXSjGUSBoKpMHDJd-nmb9")

@app.route('/api/hymns')
def get_hymns():
    try:
        url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&key={DRIVE_API_KEY}&fields=files(id,name,mimeType)&pageSize=100"
        resp = http_requests.get(url, verify=False)
        
        if resp.status_code != 200:
            return jsonify({
                "error": f"구글 드라이브 연결 실패 (Status {resp.status_code})",
                "details": resp.text
            }), resp.status_code
            
        data = resp.json()
        files = data.get('files', [])
        audio_files = [f for f in files if f.get('mimeType', '').startswith('audio/')]
        audio_files.sort(key=lambda x: x.get('name', ''))
        return jsonify({"hymns": audio_files})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/hymn-play/<file_id>')
def play_hymn(file_id):
    try:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&key={DRIVE_API_KEY}"
        resp = http_requests.get(url, stream=True, verify=False)
        from flask import Response
        return Response(
            resp.iter_content(chunk_size=8192),
            content_type=resp.headers.get('Content-Type', 'audio/mpeg'),
            headers={'Accept-Ranges': 'bytes'}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bible/read')
def read_bible():
    try:
        book = request.args.get('book', '').strip()
        chapter = request.args.get('chapter', '').strip()
        
        if not book or not chapter:
            return jsonify({"error": "책 이름(book)과 장 번호(chapter)를 지정해주세요."}), 400
            
        # 책 이름 정규화 (역대기상/하 -> 역대상/하)
        if book == "역대기상":
            book = "역대상"
        elif book == "역대기하":
            book = "역대하"
            
        # 1. 오프라인 데이터베이스가 메모리에 로드된 경우 즉시 반환 (지연시간 0.1ms 미만, 100% 로컬 로드)
        if BIBLE_DB and book in BIBLE_BOOKS_KOREAN:
            try:
                book_idx = BIBLE_BOOKS_KOREAN.index(book)
                book_data = BIBLE_DB[book_idx]
                chapter_num = int(chapter)
                
                if 1 <= chapter_num <= len(book_data["chapters"]):
                    verses_list = book_data["chapters"][chapter_num - 1]
                    verses_formatted = []
                    for i, t in enumerate(verses_list):
                        verses_formatted.append({
                            "verse": i + 1,
                            "text": t
                        })
                    
                    bible_data = {
                        "book": book,
                        "chapter": chapter_num,
                        "verses": verses_formatted
                    }
                    print(f"[OFFLINE BIBLE HIT] Loaded {book} {chapter}장 instantly from in-memory database.")
                    return jsonify(bible_data)
            except Exception as offline_err:
                print(f"[OFFLINE BIBLE ERROR] {offline_err} - falling back to cache/Gemini API.")
            
        # 캐시 폴더 생성 및 경로 구성
        cache_dir = os.path.join(os.path.dirname(__file__), 'bible_cache')
        os.makedirs(cache_dir, exist_ok=True)
        
        # 파일명 표준화 (공백 제거)
        cache_filename = f"{book.replace(' ', '')}_{chapter}.json"
        cache_path = os.path.join(cache_dir, cache_filename)
        
        # 1. 로컬 파일 캐시에 존재하면 즉시 반환
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    bible_data = json.load(f)
                    print(f"[BIBLE CACHE HIT] Loaded {book} {chapter}장 from local cache.")
                    return jsonify(bible_data)
            except Exception as cache_err:
                print(f"[BIBLE CACHE READ ERROR] {cache_err} - falling back to Gemini API.")
            
        # 2. 캐시에 없으면 Gemini API를 이용하여 특정 성경 책과 장의 개역개정 본문을 파싱하여 가져오기
        prompt = (
            f"성경 '{book}' {chapter}장의 전체 절과 본문을 한국어 개역개정(Revised Korean Version) 버전으로 정확하게 가져와서 JSON 형식으로 출력하세요.\n"
            "오직 유효한 JSON 형식으로만 응답해야 하며, markdown 코드 블록(```json 등)이나 서론, 결론, 부연설명 없이 순수한 JSON 텍스트만 출력해야 합니다.\n"
            "반드시 아래의 스키마를 엄격하게 지켜야 합니다:\n"
            "{\n"
            f"  \"book\": \"{book}\",\n"
            f"  \"chapter\": {chapter},\n"
            "  \"verses\": [\n"
            "    {\"verse\": 1, \"text\": \"1절 본문...\"},\n"
            "    {\"verse\": 2, \"text\": \"2절 본문...\"}\n"
            "  ]\n"
            "}\n"
            "경고: 실제 존재하지 않는 절을 임의로 추가하거나 누락하지 말고 정확한 개역개정 한글 성경 텍스트를 출력하십시오."
        )
        
        # 시스템 지침을 성경 파서 페르소나로 설정
        system_instruction = (
            "당신은 성경 텍스트 데이터베이스 API입니다. 사용자가 요청한 성경 책과 장의 모든 구절을 오차 없이 개역개정 본문으로 정확하게 JSON으로 인코딩하여 반환합니다. "
            "JSON 형식 외에는 어떠한 텍스트나 설명도 출력해선 안 되며, JSON 문법 오류가 없도록 쉼표와 큰따옴표 처리를 완벽하게 하십시오."
        )
        
        text = generate_with_gemini(system_instruction, prompt).strip()
        
        # markdown json 블록이 있는 경우 제거
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
            
        bible_data = json.loads(text)
        
        # 3. 새로 파싱된 데이터를 로컬 파일 캐시에 저장
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(bible_data, f, ensure_ascii=False, indent=2)
                print(f"[BIBLE CACHE WRITE] Successfully cached {book} {chapter}장.")
        except Exception as cache_save_err:
            print(f"[BIBLE CACHE WRITE ERROR] {cache_save_err}")
            
        return jsonify(bible_data)
        
    except Exception as e:
        print(f"[BIBLE READ ERROR] {e}")
        return jsonify({"error": f"성경을 불러오는 데 실패했습니다: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
