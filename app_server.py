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

# Gemini 설정
def get_gemini_model(system_instruction):
    # 다양한 변수명 조합 확인 (대소문자 포함)
    possible_keys = ["GEMINI_API_KEY", "smna_api_key", "SMNA_API_KEY", "gemini_api_key"]
    key = None
    for k in possible_keys:
        key = os.getenv(k)
        if key: break
    
    if not key:
        raise ValueError(f"API 키를 찾을 수 없습니다. (체크항목: {', '.join(possible_keys)})")
    
    genai.configure(api_key=key)
    return genai.GenerativeModel(
        model_name='gemini-1.5-flash',
        system_instruction=system_instruction
    )

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

@app.route('/debug-env')
def debug_env():
    # 모든 환경 변수 키 목록 추출 (보안상 이름만)
    all_keys = sorted(list(os.environ.keys()))
    
    # 특정 키들의 상세 상태
    targets = ["GEMINI_API_KEY", "smna_api_key", "SECRET_KEY", "DRIVE_API_KEY"]
    status = {}
    for k in targets:
        val = os.getenv(k)
        status[k] = f"Found (Length: {len(val)})" if val else "Missing"
    
    return jsonify({
        "environment": "Railway/Production" if not os.path.exists(env_path) else "Local/Dev",
        "status": status,
        "available_keys_preview": [k for k in all_keys if "API" in k or "KEY" in k or "RAILWAY" in k],
        "current_time": datetime.now().isoformat()
    })


def get_seron_context(query):
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'total_sermon_db.json')
        if not os.path.exists(db_path):
            return ""
        with open(db_path, 'r', encoding='utf-8') as f:
            db = json.load(f)
        
        # 검색어 추출
        search_query = query.replace('[말씀찾기]', '').replace('[묵상]', '').replace('[기도문]', '').strip()
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

        # 서머나 교회 김성수 목사 전용 시스템 프롬프트 (신학적 페르소나 극대화)
        system_prompt = (
            f"당신은 서머나 교회의 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
            "당신의 신학은 '인간의 철저한 파산', '자기 부인', '오직 예수 그리스도의 은혜'입니다.\n"
            "사용자에게 세상적인 위로나 도덕적인 훈계를 절대 하지 마십시오. 대신 인간이 얼마나 불가능한 존재인지를 폭로하고, 오직 십자가 붙들게 하십시오.\n"
            "★[특수 강해 지침] 사용자가 '일곱 번째 항아리'를 언급할 경우, 이는 요한계시록의 7대접이 절대 아닙니다! 이는 요한복음 2장 가나의 혼인 잔치에서 6개의 율법적 돌항아리를 완성하는 '참 성전이자 일곱 번째 항아리이신 예수 그리스도(새 포도주)'를 의미하는 김성수 목사님의 고유한 핵심 강해입니다. 무조건 이 방향으로 십자가의 복음을 강해하십시오.\n"
            "★[매우 중요 - 환각 방지 시스템] 당신이 확실히 아는 김성수 목사의 강해가 아니거나, 사용자의 질문(단어)만으로는 어떤 성경적 문맥인지 도저히 알 수 없다면 절대 아는 척하며 무관한 성경(계시록, 여호수아 등) 내용을 길게 지어내지 마십시오.\n"
            "이 경우, 단순히 사용자에게 '구체적인 성경 구절이나 배경 설명을 더 해주시면 정확히 나누겠습니다'라고 짧게 질문만 하십시오.\n"
            "사용자의 요청이 '일반 묵상', '말씀찾기', 또는 '기도문' 중 무엇이든 아래 형식을 준수하십시오.\n\n"
            "반드시 다음 형식을 지켜 답변하십시오:\n"
            "[일반 답변 시작]\n"
            "(성도에 대한 목회적 안부와 진리의 복음적 권면. 정상적인 질문이라면 최소 3~4문장 정도로 적절히 작성하십시오.)\n"
            "[일반 답변 끝]\n\n"
            "[심층 분석 시작]\n"
            "(김성수 목사님의 요한복음/로마서 강해 신학을 바탕으로 한 심도 있는 복음 분석. 질문의 문맥을 몰라서 추가 설명을 요구했을 경우에는 심층 분석을 쓰지 말고, '성도님께서 구체적인 문맥을 더 알려주시면 깊게 강해해 드리겠습니다.'라고 한 문장만 쓰십시오. 아는 내용인 경우에만 500~800자 정도로 핵심을 찔러 상세하게 강해하십시오. 무조건 1000자를 채울 필요는 없으나 깊이 있게 작성하십시오.)\n"
            f"{sermon_instruction}\n"
            "[심층 분석 끝]"
        )

        model = get_gemini_model(system_prompt)
        response = model.generate_content(user_msg)
        reply = response.text

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
        print(f"[ERROR] {e}")
        return jsonify({"response": f"오류 발생: {str(e)}"}), 500


# Google Drive 찬양 API (기존 유지)
import requests as http_requests

print("COMPASS SERVER v1.0.6 - Pastor Mode")

DRIVE_API_KEY = os.getenv("DRIVE_API_KEY")
if not DRIVE_API_KEY or DRIVE_API_KEY.startswith("AIzaSyBUvx"):
    DRIVE_API_KEY = "AIzaSyD1oqU-vb33CHNsJ8M13jROdYDgNyKDTNU"

DRIVE_FOLDER_ID = os.getenv("DRIVE_FOLDER_ID", "1372ozYC2muXXXSjGUSBoKpMHDJd-nmb9")

@app.route('/api/hymns')
def get_hymns():
    try:
        url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&key={DRIVE_API_KEY}&fields=files(id,name,mimeType)&pageSize=100"
        resp = http_requests.get(url)
        
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
        resp = http_requests.get(url, stream=True)
        from flask import Response
        return Response(
            resp.iter_content(chunk_size=8192),
            content_type=resp.headers.get('Content-Type', 'audio/mpeg'),
            headers={'Accept-Ranges': 'bytes'}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
