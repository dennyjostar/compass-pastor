import os
import shutil

# ê²½ë¡œ ?¤ì •
base_dir = r"d:\ì½”ë‹¤ë¦¬í”„ë¡œì ??compass_app"
templates_dir = os.path.join(base_dir, "templates")
static_dir = os.path.join(base_dir, "static")

# ?´ë” ?ì„±
os.makedirs(templates_dir, exist_ok=True)
os.makedirs(static_dir, exist_ok=True)

# ?Œì¼ ?´ë™
try:
    if os.path.exists(os.path.join(base_dir, "index.html")):
        shutil.move(os.path.join(base_dir, "index.html"), os.path.join(templates_dir, "index.html"))
    if os.path.exists(os.path.join(base_dir, "app.js")):
        shutil.move(os.path.join(base_dir, "app.js"), os.path.join(static_dir, "app.js"))
    print("???Œì¼ ?•ë¦¬ ?„ë£Œ!")
except Exception as e:
    print(f"???´ë™ ?¤íŒ¨: {e}")

