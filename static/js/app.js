// ===== 상태 관리 (V4.1 통합) =====
let isRegistered = localStorage.getItem('compass_registered') === 'true';
let userName = localStorage.getItem('compass_userName') || '';

// ===== 초기화 =====
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

// ===== 통합 클릭 핸들러 (빈 화면 방지) =====
function handleClick(target) {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
        return;
    }

    // 페이지 이동 대신 모달 열기
    if (target === '/chat' || !target) {
        openModal('chatOverlay');
    } else {
        alert("이 기능은 곧 업데이트될 예정입니다: " + target);
    }
}

// ===== 등록 완료 =====
function completeRegistration() {
    const name = document.getElementById('userName').value.trim();
    const age = document.getElementById('userAge').value;
    const gender = document.getElementById('userGender').value;

    if (!name || !age || !gender) {
        alert('필수 정보를 모두 입력해 주세요.');
        return;
    }

    // 상태 업데이트 및 저장
    isRegistered = true;
    userName = name;
    localStorage.setItem('compass_registered', 'true');
    localStorage.setItem('compass_userName', name);
    localStorage.setItem('compass_userAge', age);
    localStorage.setItem('compass_userGender', gender);
    localStorage.setItem('compass_userRegion', document.getElementById('userRegion').value);
    localStorage.setItem('compass_userJob', document.getElementById('userJob').value);

    // UI 즉시 반영
    updateUIForRegisteredUser(name);
    document.getElementById('registerScreen').classList.remove('active');

    // 센서 권한 요청 (선택 사항)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        window.requestPermission();
    }
}

// ===== 채팅 기능 =====
function sendMessage(source) {
    const inputId = source === 'modal' ? 'modalChatInput' : 'chatInput';
    const inputEl = document.getElementById(inputId);
    const text = inputEl.value.trim();

    if (!text) return;

    // 대화창 열기
    openModal('chatOverlay');

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
    msg.innerHTML = content.replace(/\[(.*?)\]/g, '<span class="section-title">[$1]</span>').replace(/\n/g, '<br>');
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

// ===== 마이크 기능 (보안 엔진 강화) =====
function startVoice() {
    if (!isRegistered) {
        handleClick();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("현재 브라우저는 음성 인식을 지원하지 않습니다. 크롬(Chrome) 또는 삼성 인터넷을 사용해 주세요.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.start();

    const statusMsg = document.getElementById('statusMsg');
    const oldText = statusMsg.textContent;
    statusMsg.textContent = "🎙️ 말씀을 듣고 있습니다...";

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        statusMsg.textContent = "인식됨: " + text;
        const mainInput = document.getElementById('chatInput');
        if (mainInput) mainInput.value = text;
        setTimeout(() => { sendMessage(); }, 800);
    };

    recognition.onerror = () => { statusMsg.textContent = "음성 인식을 다시 시도해 주세요."; };
    recognition.onend = () => { setTimeout(() => { statusMsg.textContent = oldText; }, 2000); };
}

// ===== 모달 제어 =====
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// 초기화 호출
document.addEventListener('DOMContentLoaded', initApp);
let currentRotation = 0;
let targetRotation = 0;
let sensorActive = false;
let animRunning = false;

function createTicks() {
    const g = document.getElementById('ticks');
    if (!g) return;
    let h = '';
    for (let i = 0; i < 360; i += 2) {
        const rad = (i * Math.PI) / 180;
        const isMajor = i % 30 === 0;
        const isMid = i % 10 === 0;
        const r1 = isMajor ? 164 : (isMid ? 168 : 172);
        const r2 = 178;
        const w = isMajor ? 1.8 : (isMid ? 0.8 : 0.3);
        const o = isMajor ? 0.5 : (isMid ? 0.3 : 0.15);
        const x1 = 200 + r1 * Math.sin(rad);
        const y1 = 200 - r1 * Math.cos(rad);
        const x2 = 200 + r2 * Math.sin(rad);
        const y2 = 200 - r2 * Math.cos(rad);
        h += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c9a84c" stroke-width="${w}" opacity="${o}"/>`;
    }
    g.innerHTML = h;

    // 도수 라벨 (30도 간격)
    const dg = document.getElementById('degreeLabels');
    if (dg) {
        let dl = '';
        for (let i = 0; i < 360; i += 30) {
            if (i === 0 || i === 90 || i === 180 || i === 270) continue;
            const rad = (i * Math.PI) / 180;
            const r = 155;
            const x = 200 + r * Math.sin(rad);
            const y = 200 - r * Math.cos(rad);
            dl += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="#c9a84c" font-size="8" font-weight="300" opacity="0.3">${i}</text>`;
        }
        dg.innerHTML = dl;
    }
}

function getDirName(deg) {
    const n = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
        '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
    return n[Math.round(deg / 22.5) % 16] + '쪽을 향하고 있습니다';
}

function animateCompass() {
    let d = targetRotation - currentRotation;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    currentRotation += d * 0.1; // Smoothness factor
    const compassBody = document.getElementById('compassBody');
    if (compassBody) compassBody.style.transform = `rotate(${currentRotation}deg)`;
    requestAnimationFrame(animateCompass);
}

function updateCompassData(heading) {
    if (!sensorActive) {
        sensorActive = true;
        const statusMsg = document.getElementById('statusMsg');
        if (statusMsg) {
            statusMsg.className = 'status-msg active';
            statusMsg.textContent = '나침반 활성';
        }
    }
    if (!animRunning) {
        animRunning = true;
        animateCompass();
    }
    const deg = Math.round(heading);
    targetRotation = -heading;
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    if (degreeDisplay) degreeDisplay.innerHTML = `${deg}<span>°</span>`;
    if (directionText) directionText.textContent = getDirName(heading);
}

// Android용 절대 방위 처리
function onOrientationAbsolute(e) {
    if (e.absolute && e.alpha !== null) {
        updateCompassData(360 - e.alpha);
    }
}

// iOS용 처리
function onOrientationIOS(e) {
    if (e.webkitCompassHeading !== undefined) {
        updateCompassData(e.webkitCompassHeading);
    }
}

// 일반 폴백
function onOrientationGeneric(e) {
    if (e.alpha !== null && e.absolute) {
        updateCompassData(360 - e.alpha);
    }
}

window.requestPermission = function () {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(r => {
            if (r === 'granted') {
                window.addEventListener('deviceorientation', onOrientationIOS, true);
                const permissionBtn = document.getElementById('permissionBtn');
                if (permissionBtn) permissionBtn.style.display = 'none';
                const statusMsg = document.getElementById('statusMsg');
                if (statusMsg) statusMsg.textContent = '센서 연결됨';
            }
        }).catch(console.error);
    }
};

function initCompass() {
    createTicks();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permissionBtn = document.getElementById('permissionBtn');
            if (permissionBtn) permissionBtn.style.display = 'inline-block';
            const statusMsg = document.getElementById('statusMsg');
            if (statusMsg) statusMsg.textContent = '버튼을 눌러 권한을 허용해 주세요';
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
// ===== 채팅 및 부가 기능 (V4.0) =====

function sendMessage(source) {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
        return;
    }

    const inputId = source === 'modal' ? 'modalChatInput' : 'chatInput';
    const inputEl = document.getElementById(inputId);
    const text = inputEl.value.trim();

    if (!text) return;

    // 모달이 닫혀있으면 열기
    const chatOverlay = document.getElementById('chatOverlay');
    if (!chatOverlay.classList.contains('active')) {
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
            if (data.response) {
                addMessage('ai', data.response);
            } else if (data.error) {
                addMessage('ai', "죄송합니다. 오류가 발생했습니다: " + data.error);
            }
        })
        .catch(err => {
            console.error(err);
            addMessage('ai', "서버와 연결할 수 없습니다.");
        });
}

function addMessage(type, content) {
    const list = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    // 마크다운 형식의 [제목] 처리 (목사님 답변 구조)
    let formatted = content.replace(/\[(.*?)\]/g, '<span class="section-title">[$1]</span>');
    formatted = formatted.replace(/\n/g, '<br>');

    msg.innerHTML = formatted;
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

function startVoice() {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.start();

    const statusMsg = document.getElementById('statusMsg');
    const oldText = statusMsg.textContent;
    statusMsg.textContent = "듣고 있습니다...";

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('chatInput').value = text;
        statusMsg.textContent = "인식됨: " + text;
        setTimeout(() => { sendMessage(); }, 500);
    };

    recognition.onerror = () => {
        statusMsg.textContent = "음성 인식 실패";
        setTimeout(() => { statusMsg.textContent = oldText; }, 2000);
    };

    recognition.onend = () => {
        if (statusMsg.textContent === "듣고 있습니다...") {
            statusMsg.textContent = oldText;
        }
    };
}

// 초기화 호출
document.addEventListener('DOMContentLoaded', function () {
    initCompass();
});

// 기존 handleClick과 통합 (Redefinition fix)
function handleFeatureClick(target) {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
        return;
    }

    if (target === '/chat') {
        document.getElementById('chatOverlay').classList.add('active');
    } else {
        alert("이 기능은 준비 중입니다: " + target);
    }
}

// 전역 handleClick 덮어쓰기
window.handleClick = function (target) {
    handleFeatureClick(target);
};
