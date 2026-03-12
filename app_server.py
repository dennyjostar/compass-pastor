from flask import Flask, render_template, request, jsonify, session
import os
import openai
from datetime import datetime
import hashlib
from dotenv import load_dotenv

# .env 파일 로드
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "compass-secret-key-2026")

# 김성수 목사 강해용 NotebookLM 설정
KIM_NOTEBOOK_ID = "c84ff2ee-ceb5-4a58-a863-680fa1ba21dc"

import base64

# OpenAI 설정
def get_openai_client():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        # 환경변수가 없을 경우 하드코딩된 암호화 키를 임의 복호화해서 사용합니다 (배포편의)
        enc = "c2stcHJvai1sS3cyNFVfWHVLQV80UFd0eVBCbWI4RElUeVhudTNwOEh5Ui02c3hpeWJKdkx3R3ZMUVk3Vl96cFBxdUVHMG1taF9iVVZwdGxBZVQzQmxia0ZKd0I0UnBXS1ptaVhLbHYxdEJLZC1CaDUwNlhWWVlfS3dKZDU1TjZCeTVueDRTa29hM1VQZ0ZsWUhOOWtPWEtJY0NTaFBkWVhSc0E="
        key = base64.b64decode(enc).decode('utf-8')
    return openai.OpenAI(api_key=key)

# 서버 사이드 사용량 추적 (메모리 기반 → 추후 DB 교체)
user_usage = {}
FREE_LIMIT = 3

def get_user_hash(name, age_group="", gender=""):
    raw = f"{name}_{age_group}_{gender}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

@app.route('/')
def home():
    return render_template('index.html')

import json

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

        client = get_openai_client()
        
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
            "이 경우, 1000자 이상의 심층 분석 작성 규칙을 무시하고, 단순히 사용자에게 '구체적인 성경 구절이나 배경 설명을 더 해주시면 정확히 나누겠습니다'라고 짧게 질문만 하십시오.\n"
            "사용자의 요청이 '일반 묵상', '말씀찾기', 또는 '기도문' 중 무엇이든 아래 형식을 준수하십시오.\n\n"
            "반드시 다음 형식을 지켜 답변하십시오:\n"
            "[일반 답변 시작]\n"
            "(성도에 대한 목회적 안부와 진리의 복음적 권면. 지어내기 모호할 경우 추가 구절이나 문맥을 알려달라고 정중히 질문하십시오. 정상적인 질문이라면 최소 4~5문장 이상으로 길게 작성하십시오. 기도문이라면 길고 깊이 있게 작성하십시오.)\n"
            "[일반 답변 끝]\n\n"
            "[심층 분석 시작]\n"
            "(김성수 목사님의 요한복음/로마서 강해 신학을 바탕으로 한 심도 있는 복음 분석. 단, 질문의 문맥을 몰라서 위 '일반 답변'에서 추가 설명을 요구했을 경우에는 심층 분석을 1000자 이상 쓰지 말고, '성도님께서 구체적인 문맥을 더 알려주시면, 그 내용에 담긴 참된 복음을 깊게 강해해 드리겠습니다.'라고 한 문장만 쓰고 바로 끝내십시오. 아는 내용인 경우에만 1000자 이상 아주 길고 상세하게 강해하십시오.)\n"
            f"{sermon_instruction}\n"
            "[심층 분석 끝]"
        )

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ]
        )

        reply = completion.choices[0].message.content

        # ★ 구독 시스템 일시 정지 - 사용량 추적 없음
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
