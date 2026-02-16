/* ===== app.js v41.0 - 나침반(Compass) ===== */

/* ===== 메시지 전송 ===== */
async function sendMessage(source) {
    const inputEl = source === 'modal'
        ? document.getElementById('modalChatInput')
        : document.getElementById('chatInput');
    const msg = inputEl.value.trim();
    if (!msg) return;

    // ★ 구독 체크 제거됨 - 바로 진행
    inputEl.value = '';

    // 채팅 모달 열기
    const overlay = document.getElementById('chatOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 사용자 메시지 표시
    appendMessageToUI('user', msg);

    // 로딩 표시
    const loadEl = document.getElementById('meditating');
    if (loadEl) loadEl.style.display = 'flex';

    try {
        const profile = {
            name: localStorage.getItem('userName') || '성도',
            ageGroup: localStorage.getItem('ageGroup') || '',
            gender: localStorage.getItem('gender') || ''
        };

        const resp = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, profile })
        });

        const data = await resp.json();

        if (loadEl) loadEl.style.display = 'none';

        // 정상 응답
        if (data.response) {
            appendMessageToUI('ai', data.response);
        }

    } catch (err) {
        if (loadEl) loadEl.style.display = 'none';
        appendMessageToUI('ai', '죄송합니다. 일시적 오류가 발생했습니다. 다시 시도해주세요.');
        console.error('sendMessage error:', err);
    }
}

/* ===== 메시지 UI 표시 (심층 분석 파싱) ===== */
function appendMessageToUI(type, content, isNew) {
    const list = document.getElementById('chatMessages');
    if (!list) return;

    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    if (type === 'ai') {
        const parts = content.split(/\[심층\s*분석\s*시작\]/i);
        if (parts.length > 1) {
            let generalPart = parts[0].replace(/\[일반\s*답변\s*시작\]/i, '').trim();
            let deepPart = parts[1].trim();
            let html = generalPart.replace(/\n/g, '<br>');
            const deepId = 'deep_' + Math.random().toString(36).substr(2, 9);
            html += `
                <button class="deep-btn" onclick="toggleDeep('${deepId}')" 
                        style="display:block;width:100%;margin-top:16px;padding:14px;
                        border:1.5px solid rgba(201,168,76,0.3);border-radius:12px;
                        background:rgba(201,168,76,0.06);color:#e8d48b;
                        font-size:14px;font-weight:600;cursor:pointer;
                        transition:all 0.2s;">
                    🔍 김성수 목사님의 심층 신학 분석 보기
                </button>
                <div id="${deepId}" class="deep-content" 
                     style="display:none;margin-top:12px;padding:166px;
                     background:rgba(201,168,76,0.04);border-radius:12px;
                     border:1px solid rgba(201,168,76,0.12);
                     color:rgba(255,255,255,0.8);font-size:14px;line-height:1.8;">
                    ${deepPart.replace(/\n/g, '<br>')}
                </div>
            `;
            msg.innerHTML = html;
        } else {
            msg.innerHTML = content
                .replace(/\[일반\s*답변\s*시작\]/i, '')
                .replace(/\n/g, '<br>')
                .trim();
        }
    } else {
        msg.textContent = content;
    }

    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

window.toggleDeep = function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
};

/* ===== 모달 제어 ===== */
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

/* ===== 기능 카드 클릭 ===== */
function handleClick(route) {
    // 무료 횟수 체크
    if (!canUseService()) {
        showPaywall();
        return;
    }

    let promptMsg = '';
    let title = 'AI 목사님 상담';

    switch (route) {
        case '/search':
            promptMsg = '성경에서 위로가 되는 말씀을 찾아주세요.';
            title = '📖 말씀 찾기';
            break;
        case '/prayer':
            promptMsg = '오늘 하루를 위한 기도문을 작성해주세요.';
            title = '🙏 기도문';
            break;
        case '/devotion':
            promptMsg = '오늘의 묵상 말씀과 가이드를 주세요.';
            title = '✨ 오늘의 묵상';
            break;
    }

    const titleEl = document.getElementById('chatTitle');
    if (titleEl) titleEl.textContent = title;

    // 채팅 모달 열기
    const overlay = document.getElementById('chatOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 자동으로 메시지 전송
    if (promptMsg) {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.value = promptMsg;
        sendMessage();
    }
}

/* ===== 음성 입력 ===== */
function startVoice(btn) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('이 브라우저는 음성 입력을 지원하지 않습니다.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;  // 반복 버그 수정
    recognition.interimResults = false;

    btn.style.background = 'rgba(231,76,60,0.3)';
    btn.textContent = '🔴';

    recognition.onresult = function (event) {
        const text = event.results[0][0].transcript;
        const input = document.getElementById('chatInput');
        if (input) input.value = text;
        btn.style.background = '';
        btn.textContent = '🎙️';
    };

    recognition.onerror = function () {
        btn.style.background = '';
        btn.textContent = '🎙️';
    };

    recognition.onend = function () {
        btn.style.background = '';
        btn.textContent = '🎙️';
    };

    recognition.start();
}

/* ===== 찬양 모달 ===== */
let hymnData = [];
let currentAudio = null;
let currentHymnId = null;

async function openHymnModal() {
    document.getElementById('hymnModal').style.display = 'flex';
    if (hymnData.length === 0) {
        document.getElementById('hymnList').innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner" style="margin:0 auto;"></div><p style="margin-top:12px;color:rgba(255,255,255,0.5);font-size:14px;">찬양 목록 불러오는 중...</p></div>';
        try {
            const resp = await fetch('/api/hymns');
            const data = await resp.json();
            hymnData = data.hymns || [];
            renderHymnList(hymnData);
        } catch (e) {
            document.getElementById('hymnList').innerHTML = '<p style="text-align:center;color:#e74c3c;padding:20px;">목록을 불러올 수 없습니다.</p>';
        }
    }
}

function closeHymnModal() {
    document.getElementById('hymnModal').style.display = 'none';
}

function renderHymnList(list) {
    const container = document.getElementById('hymnList');
    if (list.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">검색 결과가 없습니다.</p>';
        return;
    }
    container.innerHTML = list.map((h, i) => {
        const name = h.name.replace(/\.(mp3|m4a|wav|ogg)$/i, '');
        const isPlaying = currentHymnId === h.id;
        return `
            <div class="hymn-item ${isPlaying ? 'playing' : ''}" onclick="playHymn('${h.id}', '${name.replace(/'/g, "\\'")}')">
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(201,168,76,0.12);display:flex;align-items:center;justify-content:center;font-size:14px;">
                    ${isPlaying ? '⏸' : '▶'}
                </div>
                <div style="flex:1;overflow:hidden;">
                    <div style="color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                </div>
            </div>
        `;
    }).join('');
}

function playHymn(fileId, title) {
    if (currentHymnId === fileId && currentAudio) {
        if (currentAudio.paused) {
            currentAudio.play();
        } else {
            currentAudio.pause();
        }
        return;
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    currentHymnId = fileId;
    currentAudio = new Audio(`/api/hymn-play/${fileId}`);
    currentAudio.play();

    // Now Playing 표시
    const npEl = document.getElementById('hymnNowPlaying');
    const npTitle = document.getElementById('hymnNowTitle');
    if (npEl && npTitle) {
        npEl.style.display = 'block';
        npTitle.textContent = '🎵 ' + title;
    }

    currentAudio.onended = function () {
        currentHymnId = null;
        currentAudio = null;
        if (npEl) npEl.style.display = 'none';
        renderHymnList(hymnData);
    };

    renderHymnList(hymnData);
}

function toggleCurrentHymn() {
    if (currentAudio) {
        if (currentAudio.paused) currentAudio.play();
        else currentAudio.pause();
    }
}

function filterHymns() {
    const query = document.getElementById('hymnSearch').value.toLowerCase();
    const filtered = hymnData.filter(h => h.name.toLowerCase().includes(query));
    renderHymnList(filtered);
}
