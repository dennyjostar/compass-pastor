FROM python:3.11-slim

WORKDIR /app

# 필수 라이브러리 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# 포트 설정
ENV PORT=5000
EXPOSE 5000

# 서버 실행 (gunicorn)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app_server:app"]
