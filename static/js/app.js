// ===== [COMPASS V4.2] 통합 제어 엔진 =====

// 1. 상태 및 권한 관리
let isRegistered = localStorage.getItem('compass_registered') === 'true';
let userName = localStorage.getItem('compass_userName') || '';

// 2. 초기화 로직
function initApp() {
    // initCompass()는 compass.js 내부에서 자체 실행되므로 여기서 명시적으로 부르지 않습니다.
    if (isRegistered && userName) {
        updateUIForRegisteredUser(userName);
    }

    // 비등록 사용자가 입력창 클릭 시 등록 유도
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            if (!isRegistered) {
                chatInput.blur(); // 포커스 해제
                handleFeatureClick();
            }
        });
    }
}

function updateUIForRegisteredUser(name) {
    const greetingName = document.getElementById('greetingName');
    if (greetingName) greetingName.textContent = name + ' 님';
}

// 3. 기능 라우터 (말씀, 기도, 묵상, 상담 통합)
function handleFeatureClick(target) {
    if (!isRegistered) {
        const overlay = document.getElementById('registerOverlay');
        if (overlay) overlay.classList.add('active');
        return;
    }

    // 채팅 모달 열기
    const chatOverlay = document.getElementById('chatOverlay');
    if (chatOverlay) chatOverlay.classList.add('active');

    let initialMsg = "";
    let featureTitle = "AI 목사님 상담";

    // 기능별 자동 프롬프트 설정
    if (target === '/search') {
        featureTitle = "📖 말씀 찾기";
        initialMsg = "목사님, 오늘 제게 힘이 되는 성경 구절이나 설교 말씀을 찾아주세요.";
    } else if (target === '/prayer') {
        featureTitle = "🙏 기도문 작성";
        initialMsg = "목사님, 지금 제 상황에 맞는 간절한 기도문을 작성해주실 수 있을까요?";
    } else if (target === '/devotion') {
        featureTitle = "✨ 오늘의 묵상";
        initialMsg = "목사님, 오늘 하루 제가 깊이 묵상하며 붙들 수 있는 메시지를 들려주세요.";
    }

    // 모달 제목 업데이트
    const chatTitle = document.querySelector('#chatOverlay h3');
    if (chatTitle) chatTitle.textContent = featureTitle;

    // 자동 메시지 전송 (약간의 지연으로 자연스럽게)
    if (initialMsg) {
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = initialMsg;
                sendMessage();
            }
        }, 300);
    }
}

// 전역 핸들러 등록
window.handleClick = handleFeatureClick;

// 4. 채팅 시스템
function sendMessage(source) {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

    const inputId = source === 'modal' ? 'modalChatInput' : 'chatInput';
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    const text = inputEl.value.trim();

    if (!text) return;

    // 모달이 닫혀있으면 열기
    const chatOverlay = document.getElementById('chatOverlay');
    if (chatOverlay && !chatOverlay.classList.contains('active')) {
        chatOverlay.classList.add('active');
    }

    addMessage('user', text);
    inputEl.value = '';

    const profile = {
        name: userName,
        age: localStorage.getItem('compass_userAge'),
        gender: localStorage.getItem('compass_userGender'),
        job: localStorage.getItem('compass_userJob')
    };

    fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, profile: profile })
    })
        .then(r => r.json())
        .then(data => {
            addMessage('ai', data.response || "죄송합니다. 오류가 발생했습니다.");
        })
        .catch(() => addMessage('ai', "서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."));
}

function addMessage(type, content) {
    const list = document.getElementById('chatMessages');
    if (!list) return;
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    // 김성수 목사님 특유의 [섹션] 스타일링
    let formatted = content.replace(/\[(.*?)\]/g, '<span class="section-title">[$1]</span>');
    formatted = formatted.replace(/\n/g, '<br>');

    msg.innerHTML = formatted;
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

// 5. 음성 인식 (V4.6 마이크 보정)
function startVoice() {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("🎤 현재 브라우저는 음성 인식을 지원하지 않습니다.\n크롬(Chrome)이나 삼성 인터넷 브라우저를 사용해 주세요.");
        return;
    }

    const micBtn = document.querySelector('.mic-btn');
    if (micBtn) micBtn.style.color = '#e86050'; // 활성화 시 붉은색 강조

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // UI 피드백 (기존 ID와 신규 ID 모두 대응)
    const statusDisplay = document.getElementById('compassStatus') || document.getElementById('statusMsg');
    const oldText = statusDisplay ? statusDisplay.textContent : "나침반 활성";

    if (statusDisplay) {
        statusDisplay.textContent = "🎙️ 말씀을 듣고 있습니다...";
        statusDisplay.style.color = "#c9a84c";
    }

    recognition.start();

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        if (statusDisplay) statusDisplay.textContent = "인식됨: " + text;

        const mainInput = document.getElementById('chatInput');
        if (mainInput) {
            mainInput.value = text;
            setTimeout(() => {
                sendMessage();
                if (micBtn) micBtn.style.color = '';
            }, 600);
        }
    };

    recognition.onerror = (e) => {
        console.error("Speech Recognition Error:", e.error);
        if (statusDisplay) statusDisplay.textContent = "다시 말씀해 주세요.";
        if (micBtn) micBtn.style.color = '';
    };

    recognition.onend = () => {
        setTimeout(() => {
            if (statusDisplay && statusDisplay.textContent.includes("듣고 있습니다")) {
                statusDisplay.textContent = oldText;
            }
            if (micBtn) micBtn.style.color = '';
        }, 2000);
    };
}

// 6. 사용자 등록 로직 (V4.8 필수 함수 복원)
function showRegisterScreen() {
    const overlay = document.getElementById('registerOverlay');
    const screen = document.getElementById('registerScreen');
    if (overlay) overlay.classList.remove('active');
    if (screen) screen.classList.add('active');
}

function closeRegisterOverlay() {
    const overlay = document.getElementById('registerOverlay');
    if (overlay) overlay.classList.remove('active');
}

function toggleAll(el) {
    const items = document.querySelectorAll('.agree-item');
    items.forEach(item => { item.checked = el.checked; });
    checkAll();
}

function checkAll() {
    const items = document.querySelectorAll('.agree-item');
    const startBtn = document.getElementById('startBtn');
    const allChecked = Array.from(items).every(item => item.checked);
    if (startBtn) startBtn.disabled = !allChecked;

    const agreeAll = document.getElementById('agreeAll');
    if (agreeAll) agreeAll.checked = allChecked;
}

function completeRegistration() {
    const name = document.getElementById('userName').value.trim();
    const age = document.getElementById('userAge').value;
    const gender = document.getElementById('userGender').value;

    if (!name || !age || !gender) {
        alert('필수 정보를 모두 입력해 주세요.');
        return;
    }

    isRegistered = true;
    userName = name;
    localStorage.setItem('compass_registered', 'true');
    localStorage.setItem('compass_userName', name);
    localStorage.setItem('compass_userAge', age);
    localStorage.setItem('compass_userGender', gender);
    localStorage.setItem('compass_userRegion', document.getElementById('userRegion').value || '');
    localStorage.setItem('compass_userJob', document.getElementById('userJob').value || '');

    updateUIForRegisteredUser(name);
    const screen = document.getElementById('registerScreen');
    if (screen) screen.classList.remove('active');

    // 나침반 및 마이크 권한 유도
    if (typeof window.requestCompassPermission === 'function') {
        window.requestCompassPermission();
    }
}

// 7. 모달 제어
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// 8. 최종 실행
document.addEventListener('DOMContentLoaded', initApp);
