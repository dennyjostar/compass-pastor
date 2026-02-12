// ===== [COMPASS V4.2] 통합 제어 엔진 =====

// 1. 상태 및 권한 관리
let isRegistered = localStorage.getItem('compass_registered') === 'true';
let userName = localStorage.getItem('compass_userName') || '';

// 2. 초기화 로직
function initApp() {
    initCompass();
    if (isRegistered && userName) {
        updateUIForRegisteredUser(userName);
    }
}

function updateUIForRegisteredUser(name) {
    const greetingName = document.getElementById('greetingName');
    if (greetingName) greetingName.textContent = name + ' 님';
}

// 3. 기능 라우터 (말씀, 기도, 묵상, 상담 통합)
function handleFeatureClick(target) {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
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

// 5. 음성 인식 (Web Speech API)
function startVoice() {
    if (!isRegistered) {
        handleFeatureClick();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("현재 브라우저는 음성 인식을 지원하지 않습니다. 크롬 또는 삼성 인터넷을 권장합니다.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.start();

    const statusMsg = document.getElementById('statusMsg');
    const oldText = statusMsg.textContent;
    statusMsg.textContent = "🎙️ 듣고 있습니다...";

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        statusMsg.textContent = "인식됨: " + text;
        const mainInput = document.getElementById('chatInput');
        if (mainInput) {
            mainInput.value = text;
            setTimeout(() => { sendMessage(); }, 600);
        }
    };

    recognition.onerror = () => { statusMsg.textContent = "다시 말씀해 주세요."; };
    recognition.onend = () => { setTimeout(() => { statusMsg.textContent = oldText; }, 2000); };
}

// 6. 사용자 등록 로직
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
    localStorage.setItem('compass_userRegion', document.getElementById('userRegion').value);
    localStorage.setItem('compass_userJob', document.getElementById('userJob').value);

    updateUIForRegisteredUser(name);
    document.getElementById('registerScreen').classList.remove('active');

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        window.requestPermission();
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

// 8. 나침반 엔진 (Android Absolute 지원)
let currentRotation = 0;
let targetRotation = 0;
let sensorActive = false;
let animRunning = false;

function initCompass() {
    createTicks();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const btn = document.getElementById('permissionBtn');
            if (btn) btn.style.display = 'inline-block';
        } else {
            window.addEventListener('deviceorientation', onOrientationIOS, true);
        }
    } else {
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', onOrientationAbsolute, true);
        }
        window.addEventListener('deviceorientation', onOrientationGeneric, true);
    }
}

function createTicks() {
    const g = document.getElementById('ticks');
    if (!g) return;
    let h = '';
    for (let i = 0; i < 360; i += 2) {
        const rad = (i * Math.PI) / 180;
        const isMajor = i % 30 === 0;
        const r1 = isMajor ? 164 : (i % 10 === 0 ? 168 : 172), r2 = 178;
        const x1 = 200 + r1 * Math.sin(rad), y1 = 200 - r1 * Math.cos(rad);
        const x2 = 200 + r2 * Math.sin(rad), y2 = 200 - r2 * Math.cos(rad);
        h += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c9a84c" stroke-width="${isMajor ? 1.8 : 0.4}" opacity="${isMajor ? 0.5 : 0.15}"/>`;
    }
    g.innerHTML = h;

    const dg = document.getElementById('degreeLabels');
    if (dg) {
        let dl = '';
        for (let i = 30; i < 360; i += 30) {
            if (i % 90 === 0) continue;
            const rad = (i * Math.PI) / 180;
            const x = 200 + 155 * Math.sin(rad), y = 200 - 155 * Math.cos(rad);
            dl += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="#c9a84c" font-size="8" opacity="0.3">${i}</text>`;
        }
        dg.innerHTML = dl;
    }
}

function onOrientationAbsolute(e) { if (e.absolute && e.alpha !== null) updateCompassData(360 - e.alpha); }
function onOrientationIOS(e) { if (e.webkitCompassHeading !== undefined) updateCompassData(e.webkitCompassHeading); }
function onOrientationGeneric(e) { if (e.alpha !== null && e.absolute) updateCompassData(360 - e.alpha); }

function updateCompassData(heading) {
    if (!sensorActive) {
        sensorActive = true;
        const s = document.getElementById('statusMsg');
        if (s) { s.className = 'status-msg active'; s.textContent = '나침반 활성'; }
    }
    if (!animRunning) { animRunning = true; animateCompass(); }
    targetRotation = -heading;
    const d = document.getElementById('degreeDisplay');
    const t = document.getElementById('directionText');
    if (d) d.innerHTML = `${Math.round(heading)}<span>°</span>`;
    if (t) {
        const n = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        t.textContent = n[Math.round(heading / 22.5) % 16] + '쪽을 향하고 있습니다';
    }
}

function animateCompass() {
    let d = targetRotation - currentRotation;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    currentRotation += d * 0.1;
    const b = document.getElementById('compassBody');
    if (b) b.style.transform = `rotate(${currentRotation}deg)`;
    requestAnimationFrame(animateCompass);
}

window.requestPermission = function () {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(r => {
            if (r === 'granted') {
                window.addEventListener('deviceorientation', onOrientationIOS, true);
                const btn = document.getElementById('permissionBtn');
                if (btn) btn.style.display = 'none';
            }
        });
    }
};

// 9. 최종 실행
document.addEventListener('DOMContentLoaded', initApp);
