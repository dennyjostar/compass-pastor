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
// ===== 실제 나침반 기능 (시각적 피드백 강화) =====
let compassActive = false;

function initCompass() {
    if (compassActive) return;

    // iOS 13+ 권한 요청
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    activateCompass();
                } else {
                    alert("나침반 기능을 위해 센서 권한이 필요합니다.");
                }
            })
            .catch(err => console.error("Permission Error:", err));
    } else {
        // 안드로이드 및 기타
        activateCompass();
    }
}

function activateCompass() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    compassActive = true;

    // 디버그 레이블 생성 (나침반 아래에 각도 표시)
    if (!document.getElementById('compassDegree')) {
        const greetingArea = document.querySelector('.greeting-area');
        if (greetingArea) {
            const degText = document.createElement('div');
            degText.id = 'compassDegree';
            degText.style.cssText = "font-size: 11px; color: #c9a84c; margin-top: 8px; opacity: 0.8; font-weight: 500;";
            degText.textContent = "나침반 동기화 중...";
            greetingArea.appendChild(degText);
        }
    }
}

function handleOrientation(event) {
    let heading = null;

    // 1. iOS 전용 (가장 정확함)
    if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
    }
    // 2. 안드로이드 절대값
    else if (event.absolute && event.alpha !== null) {
        heading = 360 - event.alpha;
    }
    // 3. 일반 alpha
    else if (event.alpha !== null) {
        heading = 360 - event.alpha;
    }

    if (heading !== null) {
        const needles = document.querySelectorAll('.compass-needle');
        const degLabel = document.getElementById('compassDegree');

        // 각도 업데이트
        const roundedHeading = Math.round(heading);
        if (degLabel) degLabel.textContent = `현재 방향: ${roundedHeading}° (북쪽 추적 중)`;

        needles.forEach(needle => {
            // 인라인 스타일로 회전 적용 (CSS 애니메이션 무시)
            needle.style.transform = `rotate(${-heading}deg)`;
            needle.style.animation = 'none';
            needle.style.setProperty('animation', 'none', 'important');
        });
    }
}

// 클릭 이벤트에 나침반 초기화 연결
const originalHandleClick = handleClick;
handleClick = function (targetPage) {
    initCompass();
    if (originalHandleClick) originalHandleClick(targetPage);
};
