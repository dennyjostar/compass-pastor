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
// ===== 나침반 제어 (V4.0 - 안드로이드 절대 방위 지원) =====
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
