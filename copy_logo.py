import os
import shutil
import glob

# ?ë³¸ ?´ë?ì§€ ì°¾ê¸° (ê°€??ìµœê·¼???…ë¡œ?œëœ ?Œì¼)
source_dir = r"C:\Users\user\.gemini\antigravity\brain\tempmediaStorage"
files = glob.glob(os.path.join(source_dir, "*"))
latest_file = max(files, key=os.path.getctime) if files else None

# ëª©ì ì§€
dest_path = r"d:\ì½”ë‹¤ë¦¬í”„ë¡œì ??compass_app\static\compass_logo.png"

if latest_file:
    print(f"???ë³¸ ?´ë?ì§€ ë°œê²¬: {latest_file}")
    try:
        shutil.copy2(latest_file, dest_path)
        print(f"?? ?´ë?ì§€ ë³µì‚¬ ?„ë£Œ: {dest_path}")
    except Exception as e:
        print(f"??ë³µì‚¬ ?¤íŒ¨: {e}")
else:
    print("???…ë¡œ?œëœ ?´ë?ì§€ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.")

