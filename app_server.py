from flask import Flask, render_template, request, jsonify
import os
import openai
import json
from datetime import datetime
import difflib

app = Flask(__name__, static_folder='static', template_folder='templates')

# API Key 설정 (환경변수 필수)
def get_openai_client():
    key = os.getenv("OPENAI_API_KEY")
    project_name = os.getenv("RAILWAY_PROJECT_NAME", "알 수 없는 프로젝트")
    
    if not key:
        raise ValueError(f"OPENAI_API_KEY 환경 변수가 없습니다. (현재 프로젝트명: {project_name}) Railway 설정(Variables)에서 키를 넣었는지 다시 확인해주세요.")
    
    # 앞뒤 공백 제거 (부장님의 편의를 위해!)
    key = key.strip()
    
    if len(key) < 20: # 너무 짧으면 잘못된 키일 가능성
        raise ValueError(f"입력된 API 키가 지나치게 짧습니다. (현재 프로젝트명: {project_name}) 키 전체를 정확히 복사했는지 확인해주세요.")
        
    print(f"[DEBUG] API Key valid. Starts with: {key[:7]}...")
    return openai.OpenAI(api_key=key)

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
                        f"당신은 서머나 교회의 '김성수 목사'입니다. 사용자는 '{user_name} 님'입니다.\n"
                        f"사용자 정보 - 연령대: {profile.get('age')}, 성별: {profile.get('gender')}, 직업: {profile.get('job', '알 수 없음')}\n\n"
                        "당신의 답변은 반드시 아래의 2단계 구조로 구성되어야 하며, 각 섹션 제목을 명시하십시오.\n\n"
                        "1. [일반 답변]\n"
                        "- 초심자나 일반 성도들도 쉽게 이해할 수 있는 수준으로 답변하십시오.\n"
                        "- 부드럽고 친절한 어조로 사용자의 상황을 공감하며 복음의 소망을 전하십시오.\n\n"
                        "2. [심층 분석]\n"
                        "- 김성수 목사의 핵심 신학(자기 부인, 은혜의 단독성, 묵시, 비움 등)을 바탕으로 한 장문의 깊이 있는 해석입니다.\n"
                        "- '케리그마', '옵타노마이', '파레시아', '일함바쿠' 등 깊이 있는 신학 용어를 문맥에 맞게 사용하십시오.\n"
                        "- 인간의 열심이 부정되고 하나님의 전적인 은혜가 드러나는 과정을 논리적이고 뜨겁게 설명하십시오.\n\n"
                        "주의사항:\n"
                        "- 결코 '성도님'이라는 호칭을 쓰지 말고 항상 '님'을 붙여 부르십시오.\n"
                        "- 설교 제목을 추천하거나 지어내지 마십시오. 오직 이 2단계 답변에만 집중하십시오."
                    )
                },
                {"role": "user", "content": user_msg}
            ]
        )
        
        reply = completion.choices[0].message.content
        
        # 설교 추천 및 링크 치환 로직 제거 (대표님 요청)
        
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
