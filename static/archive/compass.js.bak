/* compass.js (v36.0) - 나침반 흔들림 애니메이션 */
(function () {
    'use strict';

    const compassBody = document.getElementById('compassBody');
    if (!compassBody) return;

    const SWAY_RANGE = 3.5;
    const SWAY_SPEED = 0.0008;
    const SWAY_SPEED2 = 0.0013;

    let startTime = Date.now();

    /* ── 눈금 생성 ── */
    function createTicks() {
        var g = document.getElementById('compassTicks');
        if (!g) return;
        g.innerHTML = '';

        for (var i = 0; i < 360; i += 6) {
            var isMajor = (i % 90 === 0);
            var isMid = (i % 30 === 0);
            var len = isMajor ? 12 : (isMid ? 8 : 4);
            var w = isMajor ? 2 : (isMid ? 1.2 : 0.6);
            var color = isMajor ? '#c9a84c' : (isMid ? 'rgba(201,168,76,0.6)' : 'rgba(201,168,76,0.25)');

            var r1 = 138;
            var r2 = r1 - len;
            var rad = (i - 90) * Math.PI / 180;
            var x1 = 150 + r1 * Math.cos(rad);
            var y1 = 150 + r1 * Math.sin(rad);
            var x2 = 150 + r2 * Math.cos(rad);
            var y2 = 150 + r2 * Math.sin(rad);

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', w);
            g.appendChild(line);
        }
    }

    /* ── 흔들림 애니메이션 ── */
    function animate() {
        var elapsed = Date.now() - startTime;
        var wave1 = Math.sin(elapsed * SWAY_SPEED) * SWAY_RANGE;
        var wave2 = Math.sin(elapsed * SWAY_SPEED2) * (SWAY_RANGE * 0.4);
        var angle = wave1 + wave2;

        compassBody.style.transform = 'rotate(' + angle + 'deg)';
        requestAnimationFrame(animate);
    }

    /* ── 시작 ── */
    createTicks();
    animate();

})();
