// ===== [COMPASS V33.0] 통합 제어 엔진 =====

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
        const parts = content.split(/\[심층\s*분석\s*시작\]/i);

        // URL을 링크로 변환하는 함수
        function linkify(text) {
            const urlPattern = /(https?:\/\/[^\s<]+)/g;
            return text.replace(urlPattern, function (url) {
                return '<a href="' + url + '" target="_blank" style="color: #c9a84c; text-decoration: underline;">' + url + '</a>';
            });
        }

        if (parts.length > 1) {
            let generalPart = parts[0].replace(/\[일반\s*답변\s*시작\]/i, '').trim();
            let deepPart = parts[1].trim();

            let html = linkify(generalPart).replace(/\n/g, '<br>');
            const deepId = 'deep_' + Math.random().toString(36).substr(2, 9);
            html += `
                <button class="deep-btn" onclick="toggleDeep('${deepId}')">
                    🔍 김성수 목사님의 심층 신학 분석 보기
                </button>
                <div id="${deepId}" class="deep-content">
                    ${linkify(deepPart).replace(/\n/g, '<br>')}
                </div>
            `;
            msg.innerHTML = html;
        } else {
            msg.innerHTML = linkify(content).replace(/\[일반\s*답변\s*시작\]/i, '').replace(/\n/g, '<br>').trim();
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

// 5. 음성 인식 (STT) - V33.0 클로드 가이드라인 적용
let recognition = null;
let isListening = false;
let finalTranscript = ''; // 확정된 텍스트 누적
let voiceSource = 'main';

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('음성 인식을 지원하지 않는 브라우저입니다.');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;      // ★ 핵심: 말이 끝나면 자동 종료하여 반복 방지
    recognition.interimResults = true;   // 실시간 중간 결과 표시
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
        let interimTranscript = '';

        // ★ 결과 처리 - 반복 방지 핵심 로직 (resultIndex부터 루프)
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        const inputId = voiceSource === 'modal' ? 'modalChatInput' : 'chatInput';
        const targetInput = document.getElementById(inputId);
        if (targetInput) {
            targetInput.value = (finalTranscript + interimTranscript).trim();
        }
    };

    recognition.onend = function () {
        isListening = false;
        const micBtn = voiceSource === 'modal' ? document.querySelector('.modal-mic') : document.querySelector('.mic-btn:not(.modal-mic)');
        if (micBtn) micBtn.classList.remove('active-mic');
    };

    recognition.onerror = function (event) {
        console.error('음성 인식 오류:', event.error);
        isListening = false;
        const micBtn = voiceSource === 'modal' ? document.querySelector('.modal-mic') : document.querySelector('.mic-btn:not(.modal-mic)');
        if (micBtn) micBtn.classList.remove('active-mic');

        if (event.error === 'not-allowed') {
            alert('마이크 권한을 허용해 주세요.');
        }
    };
}

function startVoice(el, source) {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

    voiceSource = source || 'main';

    if (!recognition) {
        initSpeechRecognition();
    }

    if (isListening) {
        recognition.stop();
        isListening = false;
        if (el) el.classList.remove('active-mic');
        // 수동 중지 시 즉시 전송
        setTimeout(() => sendMessage(voiceSource), 100);
    } else {
        finalTranscript = ''; // ★ 시작할 때 이전 텍스트 초기화 (반복 방지)
        isListening = true;
        if (el) el.classList.add('active-mic');

        const inputId = voiceSource === 'modal' ? 'modalChatInput' : 'chatInput';
        const targetInput = document.getElementById(inputId);
        if (targetInput) targetInput.value = '';

        recognition.start();
    }
}

// 명칭 호환성 유지
window.startVoice = startVoice;

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
