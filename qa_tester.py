import asyncio
from playwright.async_api import async_playwright
import sys

async def run_qa_test(target_url):
    print(f"🚀 [나침반 QA 에이전트] 테스트를 시작합니다: {target_url}")
    
    async with async_playwright() as p:
        # 브라우저 실행 (눈으로 확인하고 싶으시면 headless=False)
        browser = await p.chromium.launch(headless=False) 
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # 1. 페이지 접속
            print("1. 페이지 접속 중...")
            await page.goto(target_url)
            await page.wait_for_timeout(2000)

            # 2. 프로필 자동 설정 (안되어 있을 경우)
            if await page.is_visible("#profileModal"):
                print("2. 프로필 자동 설정 중...")
                await page.fill("#inName", "테스트봇")
                await page.fill("#inRegion", "가상세계")
                await page.click("#saveProfile")
                await page.wait_for_timeout(1000)

            # 3. 각 모드별 테스트 루프
            modes = ["scripture", "prayer", "meditation", "chat"]
            for mode in modes:
                print(f"3. [{mode}] 모드 테스트 시작...")
                
                # 홈으로 이동 (필요시)
                await page.click("#goHome")
                await page.wait_for_timeout(500)
                
                # 해당 모드 클릭
                await page.click(f".nav-card[data-mode='{mode}']")
                await page.wait_for_timeout(1000)
                
                # 메시지 전송
                test_msg = f"{mode} 모드 테스트 질문입니다."
                await page.fill("#mainInput", test_msg)
                await page.press("#mainInput", "Enter")
                
                print(f"   - 답변 대기 중...")
                # 답변이 올 때까지 대기 (divine-spinner가 사라질 때까지)
                await page.wait_for_selector(".general-content", timeout=60000)
                
                # 답변 내용 확인
                content = await page.inner_text(".general-content")
                if content:
                    print(f"   ✅ [{mode}] 답변 수신 성공 (내용 요약: {content[:30]}...)")
                
                # 4. 공유 버튼 테스트
                print(f"   - 공유 버튼 클릭 테스트...")
                await page.click("#shareBtn")
                await page.wait_for_timeout(1000)
                # 모바일이 아닌 경우 alert이 뜰 수 있음 (핸들링 필요시 추가)
                
                # 심층 분석 버튼 테스트 (존재할 경우)
                if await page.is_visible(".deep-btn"):
                    print(f"   - 심층 분석 토글 테스트...")
                    await page.click(".deep-btn")
                    await page.wait_for_timeout(500)
                    if await page.is_visible(".deep-content"):
                        print("   ✅ 심층 분석 내용 노출 확인")

            print("\n🎊 모든 기능 테스트가 성공적으로 완료되었습니다!")

        except Exception as e:
            print(f"\n❌ 테스트 중 오류 발생: {e}")
            # 스크린샷 저장
            await page.screenshot(path="qa_error_screenshot.png")
            print("📸 오류 시점의 스크린샷이 저장되었습니다 (qa_error_screenshot.png)")
        
        finally:
            await browser.close()

if __name__ == "__main__":
    url = "https://web-production-3164c.up.railway.app" # 기본값: 배포 서버
    if len(sys.argv) > 1:
        url = sys.argv[1]
    
    asyncio.run(run_qa_test(url))
