// ===== [COMPASS V30.0] 통합 제어 엔진 =====

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
    if (isRegistered && userName) {
        updateUIForRegisteredUser(userName);
    }

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            if (!isRegistered) {
                chatInput.blur();
                handleFeatureClick();
            }
        });
    }
}

function updateUIForRegisteredUser(name) {
    const greetingName = document.getElementById('greetingName');
    if (greetingName) greetingName.textContent = name + ' 님';
}

// 3. 기능 라우터
function handleFeatureClick(target) {
    if (!isRegistered) {
        const overlay = document.getElementById('registerOverlay');
        if (overlay) overlay.classList.add('active');
        return;
    }

    const featureTarget = target || '/chat';
    currentFeature = featureTarget;

    const chatOverlay = document.getElementById('chatOverlay');
    if (chatOverlay) chatOverlay.classList.add('active');

    let initialMsg = "";
    let featureTitle = "AI 목사님 상담";
    let featureIcon = "💬";

    if (featureTarget === '/search') {
        featureTitle = "말씀 찾기";
        featureIcon = "📖";
    } else if (featureTarget === '/prayer') {
        featureTitle = "기도문 작성";
        featureIcon = "🙏";
    } else if (featureTarget === '/devotion') {
        featureTitle = "오늘의 묵상";
        featureIcon = "✨";
    }

    const chatTitleEl = document.getElementById('chatTitle');
    const chatIconEl = document.getElementById('chatIcon');
    if (chatTitleEl) chatTitleEl.textContent = featureTitle;
    if (chatIconEl) chatIconEl.textContent = featureIcon;

    renderHistory();

    if (chatHistories[featureTarget].length === 0) {
        let welcomeMsg = "";
        if (featureTarget === '/search') welcomeMsg = "반갑습니다, " + userName + " 님. 오늘 궁금하신 말씀이나 성경 구절이 있으신가요?";
        else if (featureTarget === '/prayer') welcomeMsg = "샬롬, " + userName + " 님. 지금 기도가 필요한 상황이신가요?";
        else if (featureTarget === '/devotion') welcomeMsg = userName + " 님, 오늘 하루를 위한 묵상 메시지를 나누어볼까요?";
        else if (featureTarget === '/chat') welcomeMsg = "어서오세요, " + userName + " 님. 목사님 도움이 필요하신가요?";

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
    list.innerHTML = '';

    const history = chatHistories[currentFeature] || [];
    history.forEach(item => {
        appendMessageToUI(item.type, item.content, false);
    });

    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 100);
}

window.handleClick = handleFeatureClick;

// 4. 채팅 시스템 (V30.0 고유 구분자 방식)
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

    if (source !== 'modal') {
        currentFeature = '/chat';
        handleFeatureClick('/chat');
    }

    addMessage('user', text);
    inputEl.value = '';

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
            addMessage('ai', "서버와 연결할 수 없습니다.");
        });
}

function addMessage(type, content) {
    if (!chatHistories[currentFeature]) chatHistories[currentFeature] = [];
    chatHistories[currentFeature].push({ type, content });
    localStorage.setItem('compass_histories', JSON.stringify(chatHistories));
    appendMessageToUI(type, content, true);
}

function appendMessageToUI(type, content, isNew) {
    const list = document.getElementById('chatMessages');
    if (!list) return;

    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    if (type === 'ai') {
        // [심층 분석] 섹션 분리 (고유 구분자 플래그 V30.0)
        // AI가 [일반 답변 시작] 어쩌구 [심층 분석 시작] 저쩌구 형태로 답함
        const parts = content.split(/\[심층\s*분석\s*시작\]/i);

        if (parts.length > 1) {
            let generalPart = parts[0].replace(/\[일반\s*답변\s*시작\]/i, '').trim();
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
            msg.innerHTML = content.replace(/\[일반\s*답변\s*시작\]/i, '').replace(/\n/g, '<br>').trim();
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

// 5. 음성 인식 (V32.0 - 반복 방지 로직 적용)
let activeRecognition = null;
let voiceSource = 'main';
let finalTranscriptSnapshot = ''; // 확정된 텍스트 누적용

function stopAndFinalize(shouldSend) {
    if (!activeRecognition) return;
    const source = voiceSource;
    const inputId = source === 'modal' ? 'modalChatInput' : 'chatInput';
    const targetInput = document.getElementById(inputId);
    const micBtn = source === 'modal' ? document.querySelector('.modal-mic') : document.querySelector('.mic-btn:not(.modal-mic)');

    activeRecognition.onresult = null;
    activeRecognition.onend = null;
    activeRecognition.onerror = null;
    try { activeRecognition.stop(); } catch (e) { }
    activeRecognition = null;

    if (micBtn) micBtn.classList.remove('active-mic');

    if (shouldSend && targetInput && targetInput.value.trim().length > 0) {
        sendMessage(source);
    }
}

function startVoice(el, source) {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

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

    // 초기화
    if (targetInput) targetInput.value = "";
    finalTranscriptSnapshot = '';
    if (el) el.classList.add('active-mic');

    const recognition = new Recognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = false; // ★ 핵심: 반복 방지를 위해 false 설정

    recognition.onresult = (event) => {
        let interimTranscript = '';

        // ★ 결과 처리 - 반복 방지 핵심 (resultIndex 활용)
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscriptSnapshot += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (targetInput) {
            targetInput.value = (finalTranscriptSnapshot + interimTranscript).trim();
        }
    };

    recognition.onend = () => {
        if (activeRecognition) {
            // 소리가 끝나서 자동으로 멈춘 경우 UI 정리
            const micBtn = voiceSource === 'modal' ? document.querySelector('.modal-mic') : document.querySelector('.mic-btn:not(.modal-mic)');
            if (micBtn) micBtn.classList.remove('active-mic');
            activeRecognition = null;
        }
    };

    recognition.onerror = (event) => {
        console.error('음성 인식 오류:', event.error);
        stopAndFinalize(false);
        if (event.error === 'not-allowed') {
            alert('마이크 권한을 허용해 주세요.');
        }
    };

    activeRecognition = recognition;
    recognition.start();
}

// 6. 사용자 등록
function showRegisterScreen() {
    const overlay = document.getElementById('registerOverlay');
    const screen = document.getElementById('registerScreen');
    if (overlay) overlay.classList.remove('active');
    if (screen) screen.classList.add('active');
}
function closeRegisterOverlay() { document.getElementById('registerOverlay').classList.remove('active'); }
function toggleAll(el) { document.querySelectorAll('.agree-item').forEach(item => { item.checked = el.checked; }); checkAll(); }
function checkAll() {
    const items = document.querySelectorAll('.agree-item');
    const allChecked = Array.from(items).every(item => item.checked);
    document.getElementById('startBtn').disabled = !allChecked;
    document.getElementById('agreeAll').checked = allChecked;
}
function completeRegistration() {
    const name = document.getElementById('userName').value.trim();
    const age = document.getElementById('userAge').value;
    const gender = document.getElementById('userGender').value;
    if (!name || !age || !gender) { alert('필수 정보를 입력해 주세요.'); return; }
    isRegistered = true;
    userName = name;
    localStorage.setItem('compass_registered', 'true');
    localStorage.setItem('compass_userName', name);
    localStorage.setItem('compass_userAge', age);
    localStorage.setItem('compass_userGender', gender);
    updateUIForRegisteredUser(name);
    document.getElementById('registerScreen').classList.remove('active');
    if (typeof window.requestCompassPermission === 'function') window.requestCompassPermission();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
window.resetSystem = function () { if (confirm("시스템을 초기화하시겠습니까?")) { localStorage.clear(); location.reload(); } };
document.addEventListener('DOMContentLoaded', initApp);
