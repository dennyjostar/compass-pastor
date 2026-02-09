import os
import shutil
import glob

# 원본 이미지 찾기 (가장 최근에 업로드된 파일)
source_dir = r"C:\Users\user\.gemini\antigravity\brain\tempmediaStorage"
files = glob.glob(os.path.join(source_dir, "*"))
latest_file = max(files, key=os.path.getctime) if files else None

# 목적지
dest_path = r"d:\코다리프로젝트\compass_app\static\compass_logo.png"

if latest_file:
    print(f"✅ 원본 이미지 발견: {latest_file}")
    try:
        shutil.copy2(latest_file, dest_path)
        print(f"🚀 이미지 복사 완료: {dest_path}")
    except Exception as e:
        print(f"❌ 복사 실패: {e}")
else:
    print("❌ 업로드된 이미지를 찾을 수 없습니다.")
