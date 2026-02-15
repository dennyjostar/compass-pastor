/* ══════════════════════════════════════
   나침반 센서 및 애니메이션 (V15.0 고정밀 복구 버전)
   ══════════════════════════════════════ */

(function () {
    'use strict';

    const compassBody = document.getElementById('compassBody');
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    const compassStatus = document.getElementById('compassStatus');
    const compassPermBtn = document.getElementById('compassPermBtn');

    if (!compassBody) return;

    let currentRotation = 0;
    let targetRotation = 0;
    let sensorActive = false;
    let animRunning = false;

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

    function getDirectionKo(deg) {
        var names = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
            '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
        return names[Math.round(deg / 22.5) % 16] + '쪽을 향하고 있습니다';
    }

    function animate() {
        var d = targetRotation - currentRotation;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        currentRotation += d * 0.1;
        compassBody.style.transform = 'rotate(' + currentRotation + 'deg)';
        requestAnimationFrame(animate);
    }

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
        var deg = (Math.round(heading) % 360 + 360) % 360;
        targetRotation = -heading;
        if (degreeDisplay) degreeDisplay.innerHTML = deg + '<span>°</span>';
        if (directionText) directionText.textContent = getDirectionKo(deg);
    }

    // ★ 고정밀 회전 행렬 계산 ★
    function getAbsoluteHeading(alpha, beta, gamma) {
        const _x = beta ? beta * (Math.PI / 180) : 0;
        const _y = gamma ? gamma * (Math.PI / 180) : 0;
        const _z = alpha ? alpha * (Math.PI / 180) : 0;
        const cX = Math.cos(_x); const cY = Math.cos(_y); const cZ = Math.cos(_z);
        const sX = Math.sin(_x); const sY = Math.sin(_y); const sZ = Math.sin(_z);
        const Vx = -cZ * sY - sZ * sX * cY;
        const Vy = -sZ * sY + cZ * sX * cY;
        let heading = Math.atan2(Vx, Vy) * (180 / Math.PI);
        if (heading < 0) heading += 360;
        return heading;
    }

    function onAbsoluteOrientation(e) {
        if (e.alpha !== null) {
            let heading = getAbsoluteHeading(e.alpha, e.beta, e.gamma);
            // 부장님 기기 특성 대응: 정반대 현상 해결 (+180)
            heading = (heading + 180) % 360;
            const orientation = window.orientation || (screen.orientation && screen.orientation.angle) || 0;
            updateHeading((heading + orientation + 360) % 360);
        }
    }

    function onIOSOrientation(e) {
        if (e.webkitCompassHeading !== undefined) {
            updateHeading(e.webkitCompassHeading);
        }
    }

    function onGenericOrientation(e) {
        if (e.alpha !== null) {
            let heading = getAbsoluteHeading(e.alpha, e.beta, e.gamma);
            // 부장님 기기 특성 대응: 정반대 현상 해결 (+180)
            heading = (heading + 180) % 360;
            const orientation = window.orientation || (screen.orientation && screen.orientation.angle) || 0;
            updateHeading((heading + orientation + 360) % 360);
        }
    }

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

    function initCompass() {
        createTicks();
        createDegreeLabels();
        if (degreeDisplay) degreeDisplay.innerHTML = '0<span>°</span>';
        if (directionText) directionText.textContent = '북쪽을 향하고 있습니다';
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
            } else {
                window.addEventListener('deviceorientation', onGenericOrientation, true);
            }
        }
    }

    initCompass();
})();
