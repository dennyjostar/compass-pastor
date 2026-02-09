import os
import shutil

# 경로 설정
base_dir = r"d:\코다리프로젝트\compass_app"
templates_dir = os.path.join(base_dir, "templates")
static_dir = os.path.join(base_dir, "static")

# 폴더 생성
os.makedirs(templates_dir, exist_ok=True)
os.makedirs(static_dir, exist_ok=True)

# 파일 이동
try:
    if os.path.exists(os.path.join(base_dir, "index.html")):
        shutil.move(os.path.join(base_dir, "index.html"), os.path.join(templates_dir, "index.html"))
    if os.path.exists(os.path.join(base_dir, "app.js")):
        shutil.move(os.path.join(base_dir, "app.js"), os.path.join(static_dir, "app.js"))
    print("✅ 파일 정리 완료!")
except Exception as e:
    print(f"❌ 이동 실패: {e}")
