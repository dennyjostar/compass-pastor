/* d:\코다리프로젝트\compass_app\static\js\compass.js (v34.0) */
(function () {
    'use strict';

    const compassBody = document.getElementById('compassBody');
    const degreeDisplay = document.getElementById('degreeDisplay');
    const directionText = document.getElementById('directionText');
    const compassStatus = document.getElementById('compassStatus');
    const compassPermBtn = document.getElementById('compassPermBtn');

    if (!compassBody) return;

    /* ── 상태 변수 ── */
    let currentHeading = 0;
    let targetHeading = 0;
    let sensorAvailable = false;
    let absoluteAvailable = false;   // absolute 센서 수신 여부
    let animationId = null;

    /* ── 설정 ── */
    const SMOOTHING_FACTOR = 0.12;
    const UPDATE_THRESHOLD = 0.3;

    /* ── 16방위 한글 ── */
    function getDirectionKo(deg) {
        const names = [
            '북', '북북동', '북동', '동북동',
            '동', '동남동', '남동', '남남동',
            '남', '남남서', '남서', '서남서',
            '서', '서북서', '북서', '북북서'
        ];
        const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
        return names[idx] + '쪽을 향하고 있습니다';
    }

    /* ── 각도 차이 (-180 ~ +180) ── */
    function angleDifference(target, current) {
        let diff = target - current;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        return diff;
    }

    /* ── 부드러운 보간 ── */
    function smoothAngle(current, target, factor) {
        const diff = angleDifference(target, current);
        if (Math.abs(diff) < UPDATE_THRESHOLD) return current;
        let result = current + diff * factor;
        while (result < 0) result += 360;
        while (result >= 360) result -= 360;
        return result;
    }

    /* ── UI 갱신 ── */
    function updateCompassUI(heading) {
        /* compassBody 안에 N,E,S,W 텍스트와 바늘이 함께 있으므로
           기기가 heading 만큼 회전했으면, 판 전체를 -heading 회전 → N이 항상 북쪽 */
        compassBody.style.transform = 'rotate(' + (-heading) + 'deg)';

        const rd = Math.round(heading) % 360;
        if (degreeDisplay) degreeDisplay.innerHTML = rd + '<span>°</span>';
        if (directionText) directionText.textContent = getDirectionKo(rd);
    }

    /* ── 애니메이션 루프 ── */
    function animationLoop() {
        currentHeading = smoothAngle(currentHeading, targetHeading, SMOOTHING_FACTOR);
        updateCompassUI(currentHeading);
        animationId = requestAnimationFrame(animationLoop);
    }

    /* ── 센서 상태 표시 ── */
    function markSensorActive() {
        if (!sensorAvailable) {
            sensorAvailable = true;
            if (compassStatus) {
                compassStatus.className = 'compass-status active';
                compassStatus.textContent = '나침반 센서 작동 중';
            }
        }
    }

    /* ═══════════════════════════════════════
       ★ 핵심 수정: 센서 이벤트 핸들러
       ═══════════════════════════════════════ */

    /* ── Android: deviceorientationabsolute (최우선) ── */
    function onAbsoluteOrientation(e) {
        if (e.alpha === null) return;

        absoluteAvailable = true;

        /*
         * deviceorientationabsolute의 alpha 값:
         *   - 0 = 기기 상단이 북쪽을 향함
         *   - 90 = 기기 상단이 동쪽을 향함
         *   - alpha 자체가 "기기가 북에서 시계방향으로 얼마나 회전했는가"
         *
         * 따라서 heading = alpha 가 맞습니다.
         * 기존의 (360 - alpha + 180) % 360 은 잘못된 공식이었습니다.
         */
        targetHeading = e.alpha;
        markSensorActive();
    }

    /* ── iOS: webkitCompassHeading ── */
    function onIOSOrientation(e) {
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
            targetHeading = e.webkitCompassHeading;
            markSensorActive();
        }
    }

    /* ── Android fallback: 일반 deviceorientation ── */
    function onGenericOrientation(e) {
        // absolute 센서가 이미 작동 중이면 무시
        if (absoluteAvailable) return;

        // iOS Safari의 경우
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
            targetHeading = e.webkitCompassHeading;
            markSensorActive();
            return;
        }

        // absolute === true 인 경우 (일부 Android)
        if (e.absolute === true && e.alpha !== null) {
            targetHeading = e.alpha;
            markSensorActive();
            return;
        }

        // absolute가 아닌 경우: alpha는 페이지 로드 시점 기준이라 부정확
        // 그래도 없는 것보다는 나으니 fallback으로 사용
        if (e.alpha !== null && !sensorAvailable) {
            targetHeading = e.alpha;
            markSensorActive();
            if (compassStatus) {
                compassStatus.textContent = '나침반 센서 작동 중 (보정 필요)';
            }
        }
    }

    /* ── iOS 권한 요청 ── */
    function requestIOSPermission() {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function (state) {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', onIOSOrientation, true);
                        if (compassPermBtn) compassPermBtn.style.display = 'none';
                    } else {
                        if (compassStatus) {
                            compassStatus.textContent = '센서 권한이 거부되었습니다';
                        }
                    }
                })
                .catch(function (err) {
                    console.error('iOS 권한 요청 실패:', err);
                });
        }
    }

    /* ═══════════════════════════════════════
       눈금(tick) 및 도수 레이블 생성
       ═══════════════════════════════════════ */
    function createTicks() {
        const g = document.getElementById('compassTicks');
        if (!g) return;
        g.innerHTML = '';
        for (let i = 0; i < 360; i += 2) {
            const isMajor = (i % 30 === 0);
            const isMid = (i % 10 === 0);
            const len = isMajor ? 18 : (isMid ? 10 : 5);
            const w = isMajor ? 2 : 1;
            const color = isMajor ? '#c9a84c' : 'rgba(201,168,76,0.4)';
            const r1 = 185;
            const r2 = r1 - len;
            const rad = (i - 90) * Math.PI / 180;
            const x1 = 200 + r1 * Math.cos(rad);
            const y1 = 200 + r1 * Math.sin(rad);
            const x2 = 200 + r2 * Math.cos(rad);
            const y2 = 200 + r2 * Math.sin(rad);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', w);
            g.appendChild(line);
        }
    }

    function createDegreeLabels() {
        const g = document.getElementById('compassDegLabels');
        if (!g) return;
        g.innerHTML = '';
        for (let i = 0; i < 360; i += 30) {
            if (i === 0 || i === 90 || i === 180 || i === 270) continue;
            const rad = (i - 90) * Math.PI / 180;
            const r = 155;
            const x = 200 + r * Math.cos(rad);
            const y = 200 + r * Math.sin(rad);
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', x);
            t.setAttribute('y', y);
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'central');
            t.setAttribute('fill', 'rgba(201,168,76,0.6)');
            t.setAttribute('font-size', '11');
            t.textContent = i + '°';
            g.appendChild(t);
        }
    }

    /* ── fallback: 센서 없음 ── */
    function showFallback() {
        if (compassStatus) {
            compassStatus.className = 'compass-status';
            compassStatus.textContent = '나침반 센서를 사용할 수 없습니다';
        }
        targetHeading = 0;
        currentHeading = 0;
        updateCompassUI(0);
    }

    /* ═══════════════════════════════════════
       초기화
       ═══════════════════════════════════════ */
    function init() {
        /* 애니메이션 시작 */
        animationLoop();

        /* SVG 눈금 생성 */
        createTicks();
        createDegreeLabels();

        /* 플랫폼 감지 */
        var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            /* ── iOS ── */
            if (typeof DeviceOrientationEvent !== 'undefined'
                && typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ : 버튼 표시 후 사용자 클릭으로 권한 요청
                if (compassPermBtn) {
                    compassPermBtn.style.display = 'block';
                    compassPermBtn.addEventListener('click', requestIOSPermission);
                }
                if (compassStatus) {
                    compassStatus.textContent = '나침반을 터치하여 활성화하세요';
                }
            } else {
                // 구형 iOS
                window.addEventListener('deviceorientation', onIOSOrientation, true);
            }
        } else {
            /* ── Android / Desktop ── */
            // 1순위: absolute orientation
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', onAbsoluteOrientation, true);
            }
            // 2순위: generic (fallback)
            window.addEventListener('deviceorientation', onGenericOrientation, true);
        }

        /* 3초 후 센서 없으면 fallback */
        setTimeout(function () {
            if (!sensorAvailable) {
                showFallback();
            }
        }, 3000);
    }

    init();
})();
