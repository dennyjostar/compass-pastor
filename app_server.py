from flask import Flask, render_template, request, jsonify
import os
import openai
import json
from datetime import datetime
import difflib

app = Flask(__name__, static_folder='static', template_folder='templates')

# API Key 설정 (환경변수 필수)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def get_openai_client():
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. Railway 설정에서 변수를 추가해주세요.")
    return openai.OpenAI(api_key=OPENAI_API_KEY)

# 경로 설정 (배포 환경 호환)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
SERMON_DATA_PATH = os.path.join(BASE_DIR, 'total_sermon_db.json')

if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

# 설교 데이터 로드
sermon_db = []
if os.path.exists(SERMON_DATA_PATH):
    try:
        with open(SERMON_DATA_PATH, 'r', encoding='utf-8') as f:
            sermon_db = json.load(f)
            print(f"[OK] {len(sermon_db)} sermons loaded.")
    except Exception as e:
        print(f"[ERROR] DB load failed: {e}")

def get_user_data(user_id):
    file_path = os.path.join(LOGS_DIR, f"{user_id}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except: pass
    return {"profile": {}, "history": []}

def save_user_data(user_id, data):
    file_path = os.path.join(LOGS_DIR, f"{user_id}.json")
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def find_best_sermon(query):
    if not sermon_db: return None
    titles = [s['title'] for s in sermon_db]
    matches = difflib.get_close_matches(query, titles, n=1, cutoff=0.3)
    if matches:
        for s in sermon_db:
            if s['title'] == matches[0]: return s
    return None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        user_msg = data.get('message', '')
        profile = data.get('profile', {})
        user_name = profile.get('name', '익명')
        user_id = user_name # 실제론 고유 ID가 권장됨

        # 과거 데이터 로드
        user_data = get_user_data(user_id)
        user_data['profile'] = profile

        client = get_openai_client()
        
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"당신은 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
                        f"거주지역: {profile.get('region')}, 직업: {profile.get('job')}, 연령대: {profile.get('age')}\n"
                        "결코 '성도님'이라는 호칭을 쓰지 말고 항상 '님'을 붙여 친근하게 대하십시오.\n"
                        "사용자의 고민 내용과 가장 부합하는 설교 제목을 하나 골라 마지막에 '[추천 설교: 제목]' 형식으로만 적으십시오."
                    )
                },
                {"role": "user", "content": user_msg}
            ]
        )
        
        reply = completion.choices[0].message.content
        
        # 실제 URL 치환 로직
        import re
        match = re.search(r'\[추천 설교: (.*?)\]', reply)
        if match:
            s_title = match.group(1)
            best = find_best_sermon(s_title)
            if best:
                reply = reply.replace(f"[추천 설교: {s_title}]", f"\n\n이 고민에 도움이 될 설교입니다.\n{best['url']}")

        # 이력 저장
        user_data['history'].append({"t": datetime.now().isoformat(), "q": user_msg, "a": reply})
        save_user_data(user_id, user_data)

        return jsonify({"response": reply})

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"response": f"오류가 발생했습니다: {str(e)}"}), 500

if __name__ == '__main__':
    # Railway 등 클라우드 배포를 위한 포트 설정
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
