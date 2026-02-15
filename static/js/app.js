// ===== [COMPASS V4.2] 통합 제어 엔진 =====

// 1. 상태 및 권한 관리
let isRegistered = localStorage.getItem('compass_registered') === 'true';
let userName = localStorage.getItem('compass_userName') || '';
let currentFeature = '/chat';

// 기능별 대화 기록 (localStorage에서 로드)
let chatHistories = JSON.parse(localStorage.getItem('compass_histories')) || {
    '/search': [],
    '/prayer': [],
    '/devotion': [],
    '/chat': []
};

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

// 3. 기능 라우터 (대화 기록 분리 V5.1)
function handleFeatureClick(target) {
    if (!isRegistered) {
        const overlay = document.getElementById('registerOverlay');
        if (overlay) overlay.classList.add('active');
        return;
    }

    const featureTarget = target || '/chat';
    currentFeature = featureTarget;

    // 채팅 모달 열기
    const chatOverlay = document.getElementById('chatOverlay');
    if (chatOverlay) chatOverlay.classList.add('active');

    let initialMsg = "";
    let featureTitle = "AI 목사님 상담";
    let featureIcon = "💬";

    // 기능별 자동 프롬프트 설정 (V5.0 상세화)
    if (featureTarget === '/search') {
        featureTitle = "말씀 찾기";
        featureIcon = "📖";
        initialMsg = "목사님, 오늘 제게 힘이 되는 성경 구절이나 설교 말씀을 찾아주세요.";
    } else if (featureTarget === '/prayer') {
        featureTitle = "기도문 작성";
        featureIcon = "🙏";
        initialMsg = "목사님, 지금 제 상황에 맞는 간절한 기도문을 작성해주실 수 있을까요?";
    } else if (featureTarget === '/devotion') {
        featureTitle = "오늘의 묵상";
        featureIcon = "✨";
        initialMsg = "목사님, 오늘 하루 제가 깊이 묵상하며 붙들 수 있는 메시지를 들려주세요.";
    }

    // UI 업데이트 (제목/아이콘) 및 기록 렌더링
    const chatTitleEl = document.getElementById('chatTitle');
    const chatIconEl = document.getElementById('chatIcon');
    if (chatTitleEl) chatTitleEl.textContent = featureTitle;
    if (chatIconEl) chatIconEl.textContent = featureIcon;

    renderHistory();

    // ★ 대화 기록이 전혀 없을 때만 목사님의 환영 인사 추가 (V5.2 사용자 피드백 반영) ★
    if (chatHistories[featureTarget].length === 0) {
        let welcomeMsg = "";
        if (featureTarget === '/search') welcomeMsg = "반갑습니다, " + userName + " 님. 오늘 궁금하신 말씀이나 성경 구절이 있으신가요? 찾고 싶으신 내용을 말씀해 주시면 제가 도와드리겠습니다.";
        else if (featureTarget === '/prayer') welcomeMsg = "샬롬, " + userName + " 님. 지금 기도가 필요한 상황이신가요? 어떤 마음으로 기도하고 싶으신지 들려주시면 함께 기도문을 작성해 보겠습니다.";
        else if (featureTarget === '/devotion') welcomeMsg = userName + " 님, 오늘 하루도 주님의 은혜 안에서 평안하시길 바랍니다. 묵상을 위해 오늘 하루를 어떻게 보내고 싶으신지, 혹은 고민이 있으신지 말씀해 주세요.";
        else if (featureTarget === '/chat') welcomeMsg = "어서오세요, " + userName + " 님. 목사님 도움이 필요하신가요? 무엇이든 말씀해 주십시오.";

        if (welcomeMsg) {
            setTimeout(() => {
                addMessage('ai', welcomeMsg);
            }, 300);
        }
    }
}

function renderHistory() {
    const list = document.getElementById('chatMessages');
    if (!list) return;
    list.innerHTML = ''; // 기존 화면 초기화

    const history = chatHistories[currentFeature] || [];
    history.forEach(item => {
        appendMessageToUI(item.type, item.content, false); // 저장 없이 화면에만 표시
    });

    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
}

// 전역 핸들러 등록
window.handleClick = handleFeatureClick;

// 4. 채팅 시스템 (기능별 저장 대응 V5.1)
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

    // 메인 홈 화면 입력창 사용 시 상담 모드로 전환
    if (source !== 'modal') {
        currentFeature = '/chat';
        handleFeatureClick('/chat');
    }

    addMessage('user', text);
    inputEl.value = '';

    // 로딩 표시
    const loading = document.getElementById('meditating');
    if (loading) loading.style.display = 'flex';

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
            if (loading) loading.style.display = 'none';
            addMessage('ai', data.response || "죄송합니다. 오류가 발생했습니다.");
        })
        .catch(() => {
            if (loading) loading.style.display = 'none';
            addMessage('ai', "서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        });
}

function addMessage(type, content) {
    // 1. 메모리 및 로컬 스토리지에 저장
    if (!chatHistories[currentFeature]) chatHistories[currentFeature] = [];
    chatHistories[currentFeature].push({ type, content });
    localStorage.setItem('compass_histories', JSON.stringify(chatHistories));

    // 2. 화면에 표시
    appendMessageToUI(type, content, true);
}

function appendMessageToUI(type, content, isNew) {
    const list = document.getElementById('chatMessages');
    if (!list) return;

    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    if (type === 'ai') {
        // [심층 분석] 섹션 분리 (극강의 유연성: 번호, 기호, 공백 무시하고 핵심 단어로 분리)
        const deepMarker = /[\n\s]*[\*\d\.\w\)\:\[\]\s]*(?:심층\s*분석)[\s\:\-\]]*/i;
        const generalMarker = /[\*\d\.\w\)\:\[\]\s]*(?:일반\s*답변)[\s\:\-\]]*/i;

        const parts = content.split(deepMarker);

        if (parts.length > 1) {
            let generalPart = parts[0].replace(generalMarker, '').trim();
            let deepPart = parts[1].trim();

            let html = generalPart.replace(/\n/g, '<br>');

            const deepId = 'deep_' + Math.random().toString(36).substr(2, 9);
            html += `
                <button class="deep-btn" onclick="toggleDeep('${deepId}')">
                    🔍 김성수 목사님의 심층 신학 분석 보기
                </button>
                <div id="${deepId}" class="deep-content">
                    ${deepPart.replace(/\n/g, '<br>')}
                </div>
            `;
            msg.innerHTML = html;
        } else {
            // 버튼 형식이 아닐 경우 일반 텍스트 출력
            msg.innerHTML = content.replace(/\n/g, '<br>');
        }
    } else {
        msg.textContent = content;
    }

    list.appendChild(msg);
    if (isNew) {
        setTimeout(() => {
            list.scrollTop = list.scrollHeight;
        }, 50);
    }
}

// 심층 분석 토글 함수
window.toggleDeep = function (id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle('active');
        const list = document.getElementById('chatMessages');
        if (el.classList.contains('active')) {
            setTimeout(() => { list.scrollTop = list.scrollHeight; }, 300);
        }
    }
};

// 5. 음성 인식 (V9.0 전역 엔진 - 중복 및 버튼 먹통 완전 해결)
let activeRecognition = null;
let voiceSource = 'main';

// 마이크 및 음성 인식 상태 강제 종료 및 전송 함수 (전역)
function stopAndFinalize(shouldSend) {
    if (!activeRecognition) return;

    const source = voiceSource;
    const inputId = source === 'modal' ? 'modalChatInput' : 'chatInput';
    const targetInput = document.getElementById(inputId);
    const micBtn = source === 'modal' ? document.querySelector('.modal-mic') : document.querySelector('.mic-btn:not(.modal-mic)');
    const statusDisp = document.getElementById('compassStatus') || document.getElementById('statusMsg');

    // 이벤트 리스너 제거 후 중지 (무한 루프 방지)
    activeRecognition.onresult = null;
    activeRecognition.onend = null;
    activeRecognition.onerror = null;
    try { activeRecognition.stop(); } catch (e) { }
    activeRecognition = null;

    if (micBtn) micBtn.classList.remove('active-mic');
    if (statusDisp) {
        statusDisp.textContent = "반갑습니다"; // 기본 상태 복원
        statusDisp.style.color = "";
    }

    if (shouldSend && targetInput && targetInput.value.trim().length > 0) {
        sendMessage(source);
    }
}

function startVoice(el, source) {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

    // 이미 실행 중이면 끄기
    if (activeRecognition) {
        stopAndFinalize(true);
        return;
    }

    const { SpeechRecognition, webkitSpeechRecognition } = window;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;
    if (!Recognition) {
        alert("🎤 지원하지 않는 브라우저입니다.");
        return;
    }

    voiceSource = source || 'main';
    const inputId = voiceSource === 'modal' ? 'modalChatInput' : 'chatInput';
    const targetInput = document.getElementById(inputId);
    const micBtn = el;
    const statusDisp = document.getElementById('compassStatus') || document.getElementById('statusMsg');

    if (targetInput) targetInput.value = "";
    if (micBtn) micBtn.classList.add('active-mic');
    if (statusDisp) {
        statusDisp.textContent = "🎙️ 듣고 있습니다... (다시 누르면 전송)";
        statusDisp.style.color = "#f0d078";
    }

    const recognition = new Recognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (e) => {
        let finalText = "";
        let interimText = "";

        // ★ V9.0 핵심: 누적하지 않고 매번 전체 배열에서 문장을 새로 만듭니다 (중복 방지) ★
        for (let i = 0; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript.trim();
            if (e.results[i].isFinal) {
                // 이미 들어간 문장과 겹치는지 체크 (안드로이드 버그 방어)
                if (!finalText.includes(transcript)) {
                    finalText += (finalText ? " " : "") + transcript;
                }
            } else {
                interimText = transcript;
            }
        }

        if (targetInput) {
            targetInput.value = (finalText + " " + interimText).trim();
        }
    };

    recognition.onend = () => {
        // 끊긴 경우 세션을 유지하되 UI는 그대로 둠
        if (activeRecognition) {
            try { recognition.start(); } catch (e) { }
        }
    };

    recognition.onerror = () => stopAndFinalize(false);

    activeRecognition = recognition;
    recognition.start();
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

// 9. 시스템 초기화 (로그아웃 및 테스트 리셋)
window.resetSystem = function () {
    if (confirm("시스템을 초기화하고 다시 등록하시겠습니까?\n(모든 대화 기록과 사용자 정보가 삭제됩니다)")) {
        localStorage.clear();
        location.reload();
    }
};

// 10. 최종 실행
document.addEventListener('DOMContentLoaded', initApp);
