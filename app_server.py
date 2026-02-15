from flask import Flask, render_template, request, jsonify
import os
import openai
import json
from datetime import datetime
import difflib
import requests

app = Flask(__name__, static_folder='static', template_folder='templates')

# ══ Google Drive 찬양 설정 ══
GOOGLE_API_KEY = 'AIzaSyBUvxZTwsN60wyC9YZJjidR6VfhWjFazB8'
DRIVE_FOLDER_ID = '1372ozYC2muXXXSjGUSBoKpMHDJd-nmb9'

# API Key 설정 (환경변수 필수)
def get_openai_client():
    key = os.getenv("OPENAI_API_KEY")
    project_name = os.getenv("RAILWAY_PROJECT_NAME", "알 수 없는 프로젝트")
    
    if not key:
        raise ValueError(f"OPENAI_API_KEY 환경 변수가 없습니다. (현재 프로젝트명: {project_name}) Railway 설정(Variables)에서 키를 넣었는지 다시 확인해주세요.")
    
    key = key.strip()
    
    if len(key) < 20:
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

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/ai-notice')
def ai_notice():
    return render_template('ai-notice.html')

@app.route('/compass-test')
def compass_test():
    return render_template('compass-test.html')

# ══ 목사님 찬양 API ══
@app.route('/api/hymns')
def get_hymns():
    """Google Drive 폴더에서 찬양 목록 자동 조회"""
    url = 'https://www.googleapis.com/drive/v3/files'
    params = {
        'q': f"'{DRIVE_FOLDER_ID}' in parents and mimeType='audio/mpeg'",
        'key': GOOGLE_API_KEY,
        'fields': 'files(id,name,size)',
        'orderBy': 'name',
        'pageSize': 100
    }
    
    try:
        res = requests.get(url, params=params)
        data = res.json()
        
        hymns = []
        for f in data.get('files', []):
            title = f['name'].replace('.mp3', '')
            hymns.append({
                'title': title,
                'fileId': f['id'],
                'size': f.get('size', '0')
            })
        
        return jsonify({'hymns': hymns})
    
    except Exception as e:
        print(f"[ERROR] Hymn API failed: {e}")
        return jsonify({'hymns': [], 'error': str(e)}), 500

# ══ 찬양 오디오 프록시 (Google Drive API 직접 다운로드) ══
@app.route('/api/hymn-play/<file_id>')
def hymn_play(file_id):
    """Google Drive API로 파일을 직접 다운로드하여 스트리밍"""
    from flask import Response
    
    try:
        # Google Drive API v3 미디어 다운로드 엔드포인트
        drive_url = f'https://www.googleapis.com/drive/v3/files/{file_id}'
        params = {
            'alt': 'media',
            'key': GOOGLE_API_KEY
        }
        
        resp = requests.get(drive_url, params=params, stream=True, timeout=30)
        
        if resp.status_code != 200:
            print(f"[ERROR] Drive API returned {resp.status_code}: {resp.text[:200]}")
            return 'File not found', 404
        
        def generate():
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk
        
        return Response(
            generate(),
            content_type='audio/mpeg',
            headers={
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400',
                'Content-Type': 'audio/mpeg'
            }
        )
    except Exception as e:
        print(f"[ERROR] Hymn play failed: {e}")
        return 'Error', 500

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.json
        user_msg = data.get('message', '')
        profile = data.get('profile', {})
        user_name = profile.get('name', '익명')
        user_id = user_name

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
                        
                        "### [대화 규칙: 반드시 지킬 것]\n"
                        "1. 모든 답변은 반드시 아래 2가지 섹션으로 나누어 작성하십시오.\n"
                        "   - [일반 답변 시작]\n"
                        "   - [심층 분석 시작]\n"
                        "2. 섹션 구분 태그([일반 답변 시작], [심층 분석 시작])는 한 글자도 틀리지 말고 정확히 포함하십시오.\n"
                        "3. 사용자가 기술적인 문제(예: '앱이 안 돼요', '버튼이 안 눌려요')를 호소할 때만 예외적으로 2단계 구조를 생략하고 정중히 사과하십시오.\n"
                        "4. '성도님'이라는 호칭 대신 무조건 '{user_name} 님'이라고 부르십시오.\n\n"

                        "### [답변 구조 예시]\n"
                        "[일반 답변 시작]\n"
                        "반갑습니다, {user_name} 님. 오늘 마음이 많이 무거우시군요. 주님 안에서 참된 평안이 있기를 소망합니다. (따뜻한 위로와 공감)\n"
                        "[심층 분석 시작]\n"
                        "우리가 겪는 고난은 사실 우리를 증명하려 함이 아니라, 우리의 '자기 부인'을 이끌어내시는 하나님의 열심입니다. (김성수 목사의 신학적 분석: 자기 부인, 은혜, 십자가 등)"
                    )
                },
                {"role": "user", "content": user_msg}
            ]
        )
        
        reply = completion.choices[0].message.content
        
        user_data['history'].append({"t": datetime.now().isoformat(), "q": user_msg, "a": reply})
        save_user_data(user_id, user_data)

        return jsonify({"response": reply})

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"response": f"오류가 발생했습니다: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
