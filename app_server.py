from flask import Flask, render_template, request, jsonify, session
import os
import openai
from datetime import datetime
import hashlib

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "compass-secret-key-2026")

# OpenAI 설정
def get_openai_client():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY가 없습니다.")
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

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        user_msg = data.get('message', '')
        profile = data.get('profile', {})
        user_name = profile.get('name', '성도')

        # ★ 구독 시스템 일시 정지 - 무료 횟수 체크 없음
        # age_group = profile.get('ageGroup', '')
        # gender = profile.get('gender', '')
        # user_hash = get_user_hash(user_name, age_group, gender)
        # if user_hash not in user_usage:
        #     user_usage[user_hash] = {
        #         "count": 0,
        #         "first_use": datetime.now().isoformat(),
        #         "is_paid": False
        #     }
        # usage = user_usage[user_hash]
        # if not usage["is_paid"] and usage["count"] >= FREE_LIMIT:
        #     return jsonify({
        #         "response": None,
        #         "limit_reached": True,
        #         "used_count": usage["count"],
        #         "remaining": 0,
        #         "message": "무료 상담 3회가 모두 사용되었습니다."
        #     })

        client = get_openai_client()

        # 시스템 프롬프트 (심층 분석 보장)
        system_prompt = (
            f"당신은 서머나 교회의 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
            "사용자의 고민에 대해 반드시 다음 형식을 지켜 답변하십시오.\n\n"
            "1. [일반 답변 시작] 섹션: 따뜻한 위로와 성경적 권면 (짧게)\n"
            "2. [심층 분석 시작] 섹션: 인간의 불가능함, 자기 부인, 오직 은혜의 신학을 바탕으로 한 깊이 있는 분석 (500자 이상)\n\n"
            "반드시 위 태그([일반 답변 시작], [심층 분석 시작])를 정확히 포함해야 합니다.\n\n"
            "위기 상황(자해, 자살 언급 등)이 감지되면 반드시 다음을 안내하세요:\n"
            "자살예방상담전화 1393 | 정신건강위기상담전화 1577-0199"
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

DRIVE_API_KEY = "AIzaSyBUvxZTwsN60wyC9YZJjidR6VfhWjFazB8"
DRIVE_FOLDER_ID = "1372ozYC2muXXXSjGUSBoKpMHDJd-nmb9"

@app.route('/api/hymns')
def get_hymns():
    try:
        url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&key={DRIVE_API_KEY}&fields=files(id,name,mimeType)&pageSize=100"
        resp = http_requests.get(url)
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
