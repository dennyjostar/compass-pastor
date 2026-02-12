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
    console.log("[Compass] Initializing sensor...");

    // iOS 13+ 대응
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                console.log("[Compass] iOS Permission response:", response);
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation, true);
                    compassActive = true;
                } else {
                    alert("나침반 기능을 사용하려면 방향 센서 권한이 필요합니다.");
                }
            })
            .catch(err => {
                console.error("[Compass] Permission error:", err);
            });
    } else {
        // 안드로이드 및 기타 기기
        console.log("[Compass] Using standard orientation events");
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        } else {
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
        compassActive = true;
    }
}

function handleOrientation(event) {
    let heading = 0;

    // iOS
    if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
    }
    // Android Absolute
    else if (event.absolute && event.alpha !== null) {
        heading = 360 - event.alpha;
    }
    // Android Standard (정확도 낮음)
    else if (event.alpha !== null) {
        heading = 360 - event.alpha;
    }

    if (heading !== 0) {
        const needles = document.querySelectorAll('.compass-needle');
        needles.forEach(needle => {
            // 부드러운 회전을 위해 transform 적용
            needle.style.transform = `rotate(${-heading}deg)`;
            needle.style.animation = 'none'; // 센서 작동 시 흔들림 애니메이션 중지
        });
    }
}

// 클릭 핸들러 확장
const originalHandleClick = handleClick;
handleClick = function (targetPage) {
    initCompass();
    originalHandleClick(targetPage);
};
