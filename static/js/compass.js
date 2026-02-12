/* ══════════════════════════════════════
   나침반 센서 및 애니메이션
   ══════════════════════════════════════ */

(function () {
    'use strict';

    const compassBody = document.getElementById('compassBody');
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    const compassStatus = document.getElementById('compassStatus');
    const compassPermBtn = document.getElementById('compassPermBtn');

    // 요소가 없으면 종료 (다른 페이지에서 오류 방지)
    if (!compassBody) return;

    let currentRotation = 0;
    let targetRotation = 0;
    let sensorActive = false;
    let animRunning = false;

    // ── SVG 눈금 동적 생성 ──
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

    // ── 도수 라벨 생성 ──
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

    // ── 16방위 ──
    function getDirectionKo(deg) {
        var names = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
            '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        return names[Math.round(deg / 22.5) % 16] + '쪽을 향하고 있습니다';
    }

    // ── 부드러운 회전 ──
    function animate() {
        var d = targetRotation - currentRotation;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        currentRotation += d * 0.1;
        compassBody.style.transform = 'rotate(' + currentRotation + 'deg)';
        requestAnimationFrame(animate);
    }

    // ── 방향 업데이트 ──
    function updateHeading(heading) {
        if (!sensorActive) {
            sensorActive = true;
            if (compassStatus) {
                compassStatus.className = 'compass-status active';
                compassStatus.textContent = '나침반 활성';
            }
        }
        if (!animRunning) {
            animRunning = true;
            animate();
        }
        var deg = Math.round(heading);
        targetRotation = -heading;
        if (degreeDisplay) degreeDisplay.innerHTML = deg + '<span>°</span>';
        if (directionText) directionText.textContent = getDirectionKo(heading);
    }

    // ══════════════════════════════════════
    //  센서 핸들러 (Android + iOS 모두 지원)
    // ══════════════════════════════════════

    // ★ Android 핵심: deviceorientationabsolute ★
    function onAbsoluteOrientation(e) {
        if (e.alpha !== null) {
            updateHeading((360 - e.alpha) % 360);
        }
    }

    // iOS: webkitCompassHeading
    function onIOSOrientation(e) {
        if (e.webkitCompassHeading !== undefined) {
            updateHeading(e.webkitCompassHeading);
        }
    }

    // 폴백: absolute 플래그가 true인 일반 이벤트
    function onGenericOrientation(e) {
        if (e.absolute && e.alpha !== null) {
            updateHeading((360 - e.alpha) % 360);
        }
    }

    // ── iOS 권한 요청 ──
    window.requestCompassPermission = function () {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(function (r) {
                if (r === 'granted') {
                    window.addEventListener('deviceorientation', onIOSOrientation, true);
                    if (compassPermBtn) compassPermBtn.style.display = 'none';
                }
            }).catch(function () { });
        }
    };

    // ── 초기화 ──
    function initCompass() {
        createTicks();
        createDegreeLabels();

        // 기본값 표시
        if (degreeDisplay) degreeDisplay.innerHTML = '0<span>°</span>';
        if (directionText) directionText.textContent = '북쪽을 향하고 있습니다';
        if (compassStatus) {
            compassStatus.className = 'compass-status active';
            compassStatus.textContent = '나침반 활성';
        }

        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        if (isIOS) {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                if (compassPermBtn) compassPermBtn.style.display = 'block';
            } else {
                window.addEventListener('deviceorientation', onIOSOrientation, true);
            }
        } else {
            // ★ Android: absolute 이벤트 우선 ★
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', onAbsoluteOrientation, true);
            }
            // 폴백
            window.addEventListener('deviceorientation', onGenericOrientation, true);
        }
    }

    initCompass();
})();
