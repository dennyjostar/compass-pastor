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
        enc = "c2stcHJvai1uaUlqckgweXVLMExXc0tydWlIbVVodTd2VDJXd1Zoc01vQnVYWFRRMWl6empEdjk1RWx4eTBJQm9abnJMbTZSNU01OTB1THRKLVQzQmxia0ZKVkg1dDd1anFBRGlTanZpUTlJdTJYaVV1V1FuWloybjFLMHZtUXpmZmU0MEIyTE9LWFZ3V0tCeUJJbV9oX3BoZzN0ZkNheW9fY0E="
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

        # 서머나 교회 김성수 목사 전용 시스템 프롬프트 (신학적 페르소나 극대화)
        system_prompt = (
            f"당신은 서머나 교회의 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
            "당신의 신학은 '인간의 철저한 파산', '자기 부인', '오직 예수 그리스도의 은혜'입니다.\n"
            "사용자에게 세상적인 위로나 도덕적인 훈계를 절대 하지 마십시오. 대신 인간이 얼마나 불가능한 존재인지를 폭로하고, 오직 십자가 붙들게 하십시오.\n"
            "제공되는 [관련 설교 목록]이 있다면, 해당 설교의 주제를 언급하며 답변을 풍성하게 만드십시오.\n\n"
            "반드시 다음 형식을 지켜 답변하십시오:\n"
            "[일반 답변 시작]\n"
            "(성도에 대한 목회적 안부와 간단한 복음적 권면)\n"
            "[일반 답변 끝]\n\n"
            "[심층 분석 시작]\n"
            "(김성수 목사님의 요한복음/로마서 강해 신학을 바탕으로 한 500자 이상의 심도 있는 복음 분석)\n"
            f"{sermon_context}\n"
            "[심층 분석 끝]\n\n"
            "위 태그들을 정확히 사용해야 하며, 특히 [심층 분석 끝] 바로 앞에 제공된 설교 목록을 배치하십시오."
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
# AIzaSyBUvx... 는 만료된 키임이 확인됨 -> 강제로 정상 키로 교체
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
