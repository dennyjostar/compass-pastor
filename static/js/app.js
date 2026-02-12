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
// ===== 실제 나침반 기능 (지자기 센서 연동) =====
let compassActive = false;

function initCompass() {
    if (compassActive) return;

    // iOS 13+ 기기 대응 (권한 요청 필요)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    compassActive = true;
                }
            })
            .catch(console.error);
    } else {
        // 일반 안드로이드 및 기타 기기
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        // absolute 지원 안 할 경우 대비
        window.addEventListener('deviceorientation', handleOrientation, true);
        compassActive = true;
    }
}

function handleOrientation(event) {
    let heading = 0;

    // iOS 전용 헤딩 값
    if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
    }
    // 표준 헤딩 값 (안드로이드 등)
    else if (event.alpha) {
        heading = 360 - event.alpha;
    }

    // 나침반 바늘 요소들 회전 적용
    const needles = document.querySelectorAll('.compass-needle');
    needles.forEach(needle => {
        // 기존 CSS 애니메이션과 겹치지 않도록 transform 직접 제어
        // -heading은 북쪽을 고정하기 위함
        needle.style.transform = `rotate(${-heading}deg)`;
        // 실제 작동 시에는 미세 흔들림 애니메이션 중단 (선택 사항)
        needle.style.animation = 'none';
    });
}

// 기존 handleClick 함수 수정 (센서 활성화 트리거 추가)
const originalHandleClick = handleClick;
handleClick = function (targetPage) {
    initCompass(); // 클릭 시 센서 권한 요청 및 활성화
    originalHandleClick(targetPage);
};
