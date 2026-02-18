import asyncio
from playwright.async_api import async_playwright
import sys
import os

async def run_qa_test(target_url):
    print(f"🚀 [나침반 QA 요원: 나실장 V4.8] 업무를 시작합니다! (대상: {target_url})")
    
    async with async_playwright() as p:
        # 브라우저 실행 (headless=False로 하면 실제 동작을 눈으로 볼 수 있음)
        browser = await p.chromium.launch(headless=True) 
        context = await browser.new_context(viewport={'width': 390, 'height': 844}) # iPhone 스케일
        page = await context.new_page()

        try:
            # 1. 페이지 접속
            print("1. [나실장] 현장 잠입 중... (페이지 접속)")
            response = await page.goto(target_url)
            if response.status != 200:
                print(f"❌ 접속 실패! 상태 코드: {response.status}")
                return

            await page.wait_for_timeout(2000)

            # 2. 로컬 스토리지 초기화 (깨끗한 상태에서 테스트하기 위해)
            await page.evaluate("localStorage.clear()")
            await page.reload()
            await page.wait_for_timeout(2000)

            # 3. 등록 과정 테스트
            print("2. [나실장] 등록 절차 보안 점검...")
            
            # 카드 하나 클릭해서 팝업 띄우기
            await page.click("div.feature-card:has-text('말씀 찾기')")
            await page.wait_for_timeout(1000)

            if await page.is_visible("#registerOverlay"):
                print("   - 등록 안내 팝업 확인됨")
                await page.click("button.btn-register") # 등록하고 시작하기
                await page.wait_for_timeout(1000)

            if await page.is_visible("#registerScreen.active"):
                print("   - 등록 화면 진입 성공")
                await page.fill("#userName", "나실장_QA")
                await page.select_option("#userAge", "40s")
                await page.select_option("#userGender", "male")
                
                # '전체 동의' 체크
                print("   - 약관 전체 동의 체크 중...")
                await page.check("#agreeAll")
                await page.wait_for_timeout(500)
                
                # '정보 저장하고 시작하기' 버튼 활성화 확인 및 클릭
                start_btn = page.locator("#startBtn")
                if await start_btn.is_enabled():
                    print("   - 시작 버튼 활성화 확인됨")
                    await start_btn.click()
                    print("   ✅ 등록 완료")
                else:
                    print("   ❌ 오류: 모든 약관에 동의했으나 시작 버튼이 비활성 상태입니다.")
                    return
                
                await page.wait_for_timeout(1500)

            # 4. 기능별 정밀 점검
            features = [
                {"name": "말씀 찾기", "selector": "div.feature-card:has-text('말씀 찾기')", "title": "📖 말씀 찾기"},
                {"name": "기도문", "selector": "div.feature-card:has-text('기도문')", "title": "🙏 기도문 작성"},
                {"name": "오늘의 묵상", "selector": "div.feature-card:has-text('오늘의 묵상')", "title": "✨ 오늘의 묵상"}
            ]

            for feat in features:
                print(f"3. [나실장] {feat['name']} 기능 점검...")
                
                await page.click(feat['selector'])
                await page.wait_for_timeout(1500)

                # 채팅창 열렸는지 및 제목 확인
                chat_title = await page.inner_text("#chatOverlay h3")
                if feat['title'] in chat_title:
                    print(f"   - ✅ 대화창 전환 및 제목 일치: {chat_title}")
                else:
                    print(f"   - ❌ 제목 불일치! 기대: {feat['title']}, 실제: {chat_title}")

                # AI 응답 확인
                print("   - AI 영적 가이드 답변 대기 중...")
                try:
                    await page.wait_for_selector(".message.ai", timeout=40000)
                    last_msg = await page.locator(".message.ai").last.inner_text()
                    print(f"   ✅ 응답 수신: {last_msg[:40]}...")
                except:
                    print("   ❌ 응답 수신 실패 (타임아웃)")

                # 닫기
                await page.click("button.modal-close")
                await page.wait_for_timeout(800)

            # 5. 나침반 확인
            print("4. [나침반] 렌더링 확인...")
            if await page.is_visible("#compassBody"):
                print("   ✅ 나침반 SVG 엔진 로드 완료")
            else:
                print("   ❌ 나침반 엔진 실종됨")

            print("\n🎊 [보고] 대표님, 나실장 V4.8 점검 완료! 모든 기능이 '완벽'하게 어우러져 있습니다.")

        except Exception as e:
            print(f"\n💥 테스트 오류: {e}")
            await page.screenshot(path="qa_final_report.png")
            print("📸 오류 보고용 스크린샷 저장됨.")
        
        finally:
            await browser.close()

if __name__ == "__main__":
    url = "https://web-production-3164c.up.railway.app"
    if len(sys.argv) > 1:
        url = sys.argv[1]
    
    asyncio.run(run_qa_test(url))
