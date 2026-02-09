import os
import glob
import shutil

source_dir = r"C:\Users\user\.gemini\antigravity\brain\tempmediaStorage"
dest_path = r"d:\코다리프로젝트\compass_app\static\compass_logo.png"

try:
    files = glob.glob(os.path.join(source_dir, "*"))
    if not files:
        print("No files found in source directory.")
    else:
        latest_file = max(files, key=os.path.getctime)
        print(f"Found image: {latest_file}")
        shutil.copy2(latest_file, dest_path)
        print(f"Copy success -> {dest_path}")
except Exception as e:
    print(f"Error copying image: {e}")
