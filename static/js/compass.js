// ===== [COMPASS V33.0] 나침반 안정화 버전 (클로드 가이드라인 적용) =====

(function () {
    'use strict';

    // ── 요소 참조 ──
    const compassBody = document.getElementById('compassBody');
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    const compassStatus = document.getElementById('compassStatus');
    const compassPermBtn = document.getElementById('compassPermBtn');

    if (!compassBody) return;

    // ── 상태 변수 ──
    let currentHeading = 0;       // 현재 표시 중인 각도 (스무딩 적용)
    let targetHeading = 0;        // 센서에서 받은 목표 각도
    let sensorAvailable = false;
    let animationId = null;

    // ── 설정 ──
    const SMOOTHING_FACTOR = 0.15;  // 0.05 ~ 0.3 (0.15 권장)
    const UPDATE_THRESHOLD = 0.5;   // 이 각도 이하 변화는 무시 (떨림 방지)

    // ── 방위 텍스트 ──
    function getDirectionKo(deg) {
        const names = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
            '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        return names[Math.round(deg / 22.5) % 16] + '쪽을 향하고 있습니다';
    }

    // ★★★ 핵심: 각도 차이를 -180 ~ +180 범위로 정규화 ★★★
    function angleDifference(target, current) {
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff;
    }

    // ★★★ 핵심: 부드러운 각도 보간 (Spherical Lerp) ★★★
    function smoothAngle(current, target, factor) {
        const diff = angleDifference(target, current);
        if (Math.abs(diff) < UPDATE_THRESHOLD) return current;

        let result = current + diff * factor;
        while (result < 0) result += 360;
        while (result >= 360) result -= 360;
        return result;
    }

    // ── UI 업데이트 ──
    function updateCompassUI(heading) {
        const rotation = -heading; // 북쪽을 가리키려면 반대로 회전
        compassBody.style.transform = `rotate(${rotation}deg)`;

        const roundedDeg = Math.round(heading);
        if (degreeDisplay) {
            degreeDisplay.innerHTML = roundedDeg + '<span>°</span>';
        }
        if (directionText) {
            directionText.textContent = getDirectionKo(roundedDeg);
        }
    }

    // ── 애니메이션 루프 (requestAnimationFrame) ──
    function animationLoop() {
        currentHeading = smoothAngle(currentHeading, targetHeading, SMOOTHING_FACTOR);
        updateCompassUI(currentHeading);
        animationId = requestAnimationFrame(animationLoop);
    }

    // ── 센서 데이터 처리 ──
    function updateSensorHeading(heading) {
        if (!sensorAvailable) {
            sensorAvailable = true;
            if (compassStatus) {
                compassStatus.className = 'compass-status active';
                compassStatus.textContent = '나침반 센서 작동 중';
            }
        }
        targetHeading = heading;
    }

    // Android: deviceorientationabsolute (절대 방위)
    function onAbsoluteOrientation(e) {
        if (e.alpha !== null) {
            // Android Chrome: 북쪽=0도
            // 부장님 기기 반전 대응 (+180) - 이전 경험적 보정값 유지
            let heading = (360 - e.alpha + 180) % 360;
            updateSensorHeading(heading);
        }
    }

    // iOS: webkitCompassHeading
    function onIOSOrientation(e) {
        if (e.webkitCompassHeading !== undefined) {
            updateSensorHeading(e.webkitCompassHeading);
        }
    }

    // 폴백: 일반 이벤트
    function onGenericOrientation(e) {
        if (e.alpha !== null) {
            let heading = (360 - e.alpha + 180) % 360;
            updateSensorHeading(heading);
        }
    }

    // ── iOS 권한 요청 ──
    window.requestCompassPermission = function () {
        if (typeof DeviceOrientationEvent !== 'undefined'
            && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function (r) {
                if (r === 'granted') {
                    window.addEventListener('deviceorientation', onIOSOrientation, true);
                    if (compassPermBtn) compassPermBtn.style.display = 'none';
                }
            }).catch(function () { });
        }
    };

    // ── 초기화 ──
    function init() {
        // 애니메이션 루프 시작
        animationLoop();

        // SVG 눈금 및 라벨 생성 (UI 유지)
        createTicks();
        createDegreeLabels();

        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                if (compassPermBtn) compassPermBtn.style.display = 'block';
            } else {
                window.addEventListener('deviceorientation', onIOSOrientation, true);
            }
        } else {
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', onAbsoluteOrientation, true);
            }
            window.addEventListener('deviceorientation', onGenericOrientation, true);
        }

        // 3초 후 센서 없으면 알림
        setTimeout(function () {
            if (!sensorAvailable && compassStatus) {
                compassStatus.textContent = '나침반 센서를 기다리는 중... (기기를 8자로 흔들어주세요)';
            }
        }, 3000);
    }

    // ── SVG 도구 (기존 UI 유지용) ──
    function createTicks() {
        const g = document.getElementById('compassTicks');
        if (!g) return;
        let html = '';
        for (let i = 0; i < 360; i += 2) {
            const rad = (i * Math.PI) / 180;
            const isMajor = i % 30 === 0;
            const isMid = i % 10 === 0;
            const r1 = isMajor ? 155 : (isMid ? 158 : 162);
            const r2 = 168;
            const w = isMajor ? 1.5 : (isMid ? 0.7 : 0.25);
            const o = isMajor ? 0.45 : (isMid ? 0.25 : 0.12);
            const x1 = 200 + r1 * Math.sin(rad);
            const y1 = 200 - r1 * Math.cos(rad);
            const x2 = 200 + r2 * Math.sin(rad);
            const y2 = 200 - r2 * Math.cos(rad);
            html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#c9a84c" stroke-width="' + w + '" opacity="' + o + '"/>';
        }
        g.innerHTML = html;
    }

    function createDegreeLabels() {
        const g = document.getElementById('compassDegLabels');
        if (!g) return;
        let html = '';
        for (let i = 0; i < 360; i += 30) {
            if (i === 0 || i === 90 || i === 180 || i === 270) continue;
            const rad = (i * Math.PI) / 180;
            const r = 145;
            const x = 200 + r * Math.sin(rad);
            const y = 200 - r * Math.cos(rad) + 3;
            html += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" fill="#c9a84c" font-size="8" font-weight="300" opacity="0.25">' + i + '</text>';
        }
        g.innerHTML = html;
    }

    init();
})();
