// ===== 상태 관리 =====
let isRegistered = localStorage.getItem('compass_registered') === 'true';
let userName = localStorage.getItem('compass_userName') || '';

// ===== 페이지 로드 =====
window.onload = function () {
    if (isRegistered && userName) {
        const greetingName = document.getElementById('greetingName');
        const usageBadge = document.getElementById('usageBadge');
        if (greetingName) greetingName.textContent = userName + ' 님';
        if (usageBadge) usageBadge.classList.add('show');
    }
};

// ===== 미등록 시 클릭 핸들러 =====
function handleClick(targetPage) {
    if (!isRegistered) {
        document.getElementById('registerOverlay').classList.add('active');
    } else {
        // 등록된 사용자 → 해당 기능 페이지로 이동
        if (targetPage) {
            window.location.href = targetPage;
        }
    }
}

// ===== 등록 팝업 → 등록 화면 =====
function showRegisterScreen() {
    document.getElementById('registerOverlay').classList.remove('active');
    document.getElementById('registerScreen').classList.add('active');
}

// ===== 등록 팝업 닫기 =====
function closeRegisterOverlay() {
    document.getElementById('registerOverlay').classList.remove('active');
}

// ===== 약관 전체 동의 =====
function toggleAll(el) {
    const items = document.querySelectorAll('.agree-item');
    items.forEach(function (item) {
        item.checked = el.checked;
    });
    updateButton();
}

// ===== 개별 체크 → 전체 동의 확인 =====
function checkAll() {
    const items = document.querySelectorAll('.agree-item');
    const allChecked = Array.from(items).every(function (item) {
        return item.checked;
    });
    const agreeAll = document.getElementById('agreeAll');
    if (agreeAll) agreeAll.checked = allChecked;
    updateButton();
}

// ===== 시작 버튼 활성화 =====
function updateButton() {
    const items = document.querySelectorAll('.agree-item');
    const allChecked = Array.from(items).every(function (item) {
        return item.checked;
    });
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.disabled = !allChecked;
}

// ===== 등록 완료 =====
function completeRegistration() {
    var name = document.getElementById('userName').value.trim();
    var age = document.getElementById('userAge').value;
    var gender = document.getElementById('userGender').value;

    if (!name) {
        alert('성함(닉네임)을 입력해 주세요.');
        return;
    }
    if (!age) {
        alert('연령대를 선택해 주세요.');
        return;
    }
    if (!gender) {
        alert('성별을 선택해 주세요.');
        return;
    }

    // localStorage 저장
    isRegistered = true;
    userName = name;
    localStorage.setItem('compass_registered', 'true');
    localStorage.setItem('compass_userName', name);
    localStorage.setItem('compass_userAge', age);
    localStorage.setItem('compass_userGender', gender);
    localStorage.setItem('compass_userRegion', document.getElementById('userRegion').value);
    localStorage.setItem('compass_userJob', document.getElementById('userJob').value);

    // 홈 화면 업데이트
    const greetingName = document.getElementById('greetingName');
    const usageBadge = document.getElementById('usageBadge');
    if (greetingName) greetingName.textContent = name + ' 님';
    if (usageBadge) usageBadge.classList.add('show');

    // 등록 화면 닫기
    document.getElementById('registerScreen').classList.remove('active');
}

// ===== 모달 열기/닫기 =====
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
// ===== 나침반 제어 (V3.5 정밀 로직) =====
let currentRotation = 0;
let targetRotation = 0;
let sensorActive = false;
let animRunning = false;

function createTicks() {
    const g = document.getElementById('ticks');
    if (!g) return;
    let h = '';
    for (let i = 0; i < 360; i += 5) {
        const rad = (i * Math.PI) / 180;
        const major = i % 30 === 0;
        const r1 = major ? 125 : 129, r2 = 134;
        h += `<line x1="${150 + r1 * Math.sin(rad)}" y1="${150 - r1 * Math.cos(rad)}" 
            x2="${150 + r2 * Math.sin(rad)}" y2="${150 - r2 * Math.cos(rad)}" 
            stroke="#c9a84c" stroke-width="${major ? 1.2 : 0.4}" opacity="0.35"/>`;
    }
    g.innerHTML = h;
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
    currentRotation += d * 0.12; // Easing 상수
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

function onOrientation(e) {
    let h = null;
    if (e.webkitCompassHeading !== undefined) h = e.webkitCompassHeading;
    else if (e.alpha !== null) h = 360 - e.alpha;
    if (h !== null) updateCompassData(h);
}

window.requestPermission = function () {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(r => {
            if (r === 'granted') {
                window.addEventListener('deviceorientation', onOrientation, true);
                const permissionBtn = document.getElementById('permissionBtn');
                if (permissionBtn) permissionBtn.style.display = 'none';
                const statusMsg = document.getElementById('statusMsg');
                if (statusMsg) statusMsg.textContent = '센서 연결 중...';
            }
        }).catch(console.error);
    }
};

function initCompass() {
    createTicks();
    // 기본값 설정
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    if (degreeDisplay) degreeDisplay.innerHTML = '0<span>°</span>';
    if (directionText) directionText.textContent = '북쪽을 향하고 있습니다';

    // AbsoluteOrientationSensor 시도
    if ('AbsoluteOrientationSensor' in window) {
        try {
            const s = new AbsoluteOrientationSensor({ frequency: 30 });
            s.addEventListener('reading', () => {
                const q = s.quaternion;
                const t3 = 2 * (q[0] * q[2] + q[3] * q[1]);
                const t4 = 1 - 2 * (q[1] * q[1] + q[2] * q[2]);
                let h = Math.atan2(t3, t4) * (180 / Math.PI);
                if (h < 0) h += 360;
                updateCompassData(h);
            });
            s.addEventListener('error', () => tryFallbackOrientation());
            s.start();
            setTimeout(() => { if (!sensorActive) tryFallbackOrientation(); }, 1500);
            return;
        } catch (e) { }
    }
    tryFallbackOrientation();
}

function tryFallbackOrientation() {
    if ('DeviceOrientationEvent' in window) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permissionBtn = document.getElementById('permissionBtn');
            if (permissionBtn) permissionBtn.style.display = 'inline-block';
        } else {
            window.addEventListener('deviceorientation', onOrientation, true);
        }
    }
}

// 초기화 호출
document.addEventListener('DOMContentLoaded', initCompass);

// 기존 handleClick과 통합
const originalHandleClick = handleClick;
handleClick = function (targetPage) {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        window.requestPermission();
    }
    originalHandleClick(targetPage);
};
