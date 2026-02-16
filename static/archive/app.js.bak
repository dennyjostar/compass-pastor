/* ===== app.js v41.2 - 나침반(Compass) ===== */

/* ===== 메시지 전송 ===== */
async function sendMessage(source) {
    const inputEl = source === 'modal'
        ? document.getElementById('modalChatInput')
        : document.getElementById('chatInput');
    const msg = inputEl.value.trim();
    if (!msg) return;

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
function appendMessageToUI(type, content) {
    const list = document.getElementById('chatMessages');
    if (!list) return;

    const msg = document.createElement('div');
    msg.className = 'message ' + type;

    if (type === 'ai') {
        const parts = content.split(/\[심층\s*분석\s*시작\]/i);
        if (parts.length > 1) {
            var generalPart = parts[0].replace(/\[일반\s*답변\s*시작\]/i, '').trim();
            var deepPart = parts[1].trim();
            var html = generalPart.replace(/\n/g, '<br>');
            var deepId = 'deep_' + Math.random().toString(36).substr(2, 9);
            html += '<button class="deep-btn" onclick="toggleDeep(\'' + deepId + '\')">';
            html += '🔍 김성수 목사님의 심층 신학 분석 보기</button>';
            html += '<div id="' + deepId + '" class="deep-content">';
            html += deepPart.replace(/\n/g, '<br>');
            html += '</div>';
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
    var el = document.getElementById(id);
    if (el) el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
};

/* ===== 모달 제어 ===== */
function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

/* ===== 기능 카드 클릭 ===== */
function handleClick(route) {
    var promptMsg = '';
    var title = 'AI 목사님 상담';

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

    var titleEl = document.getElementById('chatTitle');
    if (titleEl) titleEl.textContent = title;

    // 채팅 모달 열기
    var overlay = document.getElementById('chatOverlay');
    if (overlay) overlay.style.display = 'flex';

    // 자동으로 메시지 전송
    if (promptMsg) {
        var chatInput = document.getElementById('chatInput');
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

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    btn.style.background = 'rgba(231,76,60,0.3)';
    btn.textContent = '🔴';

    recognition.onresult = function (event) {
        var text = event.results[0][0].transcript;
        var input = document.getElementById('chatInput');
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
var hymnData = [];
var currentAudio = null;
var currentHymnId = null;

function openHymnModal() {
    document.getElementById('hymnModal').style.display = 'flex';
    if (hymnData.length === 0) {
        document.getElementById('hymnList').innerHTML =
            '<div style="text-align:center;padding:40px;">' +
            '<div class="spinner" style="margin:0 auto;width:28px;height:28px;border:2px solid rgba(201,168,76,0.15);border-top-color:#c9a84c;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
            '<p style="margin-top:12px;color:rgba(255,255,255,0.5);font-size:14px;">찬양 목록 불러오는 중...</p></div>';
        fetch('/api/hymns')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                hymnData = data.hymns || [];
                renderHymnList(hymnData);
            })
            .catch(function () {
                document.getElementById('hymnList').innerHTML =
                    '<p style="text-align:center;color:#e74c3c;padding:20px;">목록을 불러올 수 없습니다.</p>';
            });
    }
}

function closeHymnModal() {
    document.getElementById('hymnModal').style.display = 'none';
}

function renderHymnList(list) {
    var container = document.getElementById('hymnList');
    if (list.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">검색 결과가 없습니다.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
        var h = list[i];
        var name = h.name.replace(/\.(mp3|m4a|wav|ogg)$/i, '');
        var isPlaying = currentHymnId === h.id;
        html += '<div class="hymn-item ' + (isPlaying ? 'playing' : '') + '" onclick="playHymn(\'' + h.id + '\', \'' + name.replace(/'/g, "\\'") + '\')">';
        html += '<div style="width:32px;height:32px;border-radius:8px;background:rgba(201,168,76,0.12);display:flex;align-items:center;justify-content:center;font-size:14px;">';
        html += isPlaying ? '⏸' : '▶';
        html += '</div>';
        html += '<div style="flex:1;overflow:hidden;">';
        html += '<div style="color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function playHymn(fileId, title) {
    if (currentHymnId === fileId && currentAudio) {
        if (currentAudio.paused) { currentAudio.play(); }
        else { currentAudio.pause(); }
        return;
    }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentHymnId = fileId;
    currentAudio = new Audio('/api/hymn-play/' + fileId);
    currentAudio.play();
    var npEl = document.getElementById('hymnNowPlaying');
    var npTitle = document.getElementById('hymnNowTitle');
    if (npEl && npTitle) {
        npEl.style.display = 'block';
        npTitle.textContent = '🎵 ' + title;
    }
    currentAudio.onended = function () {
        currentHymnId = null; currentAudio = null;
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
    var query = document.getElementById('hymnSearch').value.toLowerCase();
    var filtered = hymnData.filter(function (h) { return h.name.toLowerCase().indexOf(query) >= 0; });
    renderHymnList(filtered);
}
