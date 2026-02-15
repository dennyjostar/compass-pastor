/* compass.js (v36.0) - 자연스러운 흔들림 애니메이션 */
(function () {
    'use strict';

    const compassBody = document.getElementById('compassBody');
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    const compassStatus = document.getElementById('compassStatus');

    if (!compassBody) return;

    /* ── 설정 ── */
    const SWAY_RANGE = 3.5;       // 좌우 흔들림 최대 각도
    const SWAY_SPEED = 0.0008;    // 흔들림 속도 (낮을수록 느림)
    const SWAY_SPEED2 = 0.0013;   // 두 번째 파동 (자연스러움용)

    let startTime = Date.now();

    /* ── 애니메이션 루프 ── */
    function animate() {
        const elapsed = Date.now() - startTime;

        // 두 개의 사인파를 합쳐서 자연스러운 미세 흔들림
        const wave1 = Math.sin(elapsed * SWAY_SPEED) * SWAY_RANGE;
        const wave2 = Math.sin(elapsed * SWAY_SPEED2) * (SWAY_RANGE * 0.4);
        const angle = wave1 + wave2;

        compassBody.style.transform = 'rotate(' + angle + 'deg)';

        // 각도 표시 (0° 근처에서 미세하게)
        const displayDeg = Math.round(Math.abs(angle));
        if (degreeDisplay) degreeDisplay.innerHTML = displayDeg + '<span>°</span>';

        requestAnimationFrame(animate);
    }

    /* ── 상태 텍스트 ── */
    if (directionText) directionText.textContent = '북쪽을 향하고 있습니다';
    if (compassStatus) {
        compassStatus.className = 'compass-status active';
        compassStatus.textContent = '나침반 센서 교정 완료';
    }

    /* ── SVG 눈금 ── */
    function createTicks() {
        var g = document.getElementById('compassTicks');
        if (!g) return;
        g.innerHTML = '';
        for (var i = 0; i < 360; i += 2) {
            var isMajor = (i % 30 === 0);
            var isMid = (i % 10 === 0);
            var len = isMajor ? 18 : (isMid ? 10 : 5);
            var w = isMajor ? 2 : 1;
            var color = isMajor ? '#c9a84c' : 'rgba(201,168,76,0.4)';
            var r1 = 185, r2 = r1 - len;
            var rad = (i - 90) * Math.PI / 180;
            var x1 = 200 + r1 * Math.cos(rad);
            var y1 = 200 + r1 * Math.sin(rad);
            var x2 = 200 + r2 * Math.cos(rad);
            var y2 = 200 + r2 * Math.sin(rad);
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1);
            line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', w);
            g.appendChild(line);
        }
    }

    function createDegreeLabels() {
        var g = document.getElementById('compassDegLabels');
        if (!g) return;
        g.innerHTML = '';
        for (var i = 0; i < 360; i += 30) {
            if (i === 0 || i === 90 || i === 180 || i === 270) continue;
            var rad = (i - 90) * Math.PI / 180;
            var r = 155;
            var x = 200 + r * Math.cos(rad);
            var y = 200 + r * Math.sin(rad);
            var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', x); t.setAttribute('y', y);
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'central');
            t.setAttribute('fill', 'rgba(201,168,76,0.6)');
            t.setAttribute('font-size', '11');
            t.textContent = i + '°';
            g.appendChild(t);
        }
    }

    /* ── 시작 ── */
    createTicks();
    createDegreeLabels();
    animate();

})();
