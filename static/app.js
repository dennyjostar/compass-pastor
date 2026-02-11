/* 나침반 V5.3 - Super Safe Link Logic + Divine Spinner */

document.addEventListener('DOMContentLoaded', () => {
    const el = {
        home: document.getElementById('viewHome'),
        task: document.getElementById('viewTask'),
        chat: document.getElementById('viewChat'),
        input: document.getElementById('mainInput'),
        send: document.getElementById('sendBtn'),
        mic: document.getElementById('micBtn'),
        userName: document.getElementById('userNameLarge'),
        taskTitle: document.getElementById('taskTitle'),
        taskIcon: document.getElementById('taskIcon'),
        taskGuide: document.getElementById('taskGuide'),
        chatText: document.getElementById('chatText'),
        chatLabel: document.getElementById('currentChatLabel'),
        homeBtn: document.getElementById('goHome'),
        profileBtn: document.getElementById('openProfile'),
        modal: document.getElementById('profileModal'),
        saveBtn: document.getElementById('saveProfile')
    };

    let userProfile = { name: '', age: '', gender: '', region: '', job: '' };
    let currentTask = 'chat';

    const showView = (viewName) => {
        el.home.style.display = 'none';
        el.task.style.display = 'none';
        el.chat.style.display = 'none';
        if (viewName === 'home') el.home.style.display = 'flex';
        else if (viewName === 'task') el.task.style.display = 'flex';
        else if (viewName === 'chat') el.chat.style.display = 'block';
    };

    const loadProfile = () => {
        const saved = localStorage.getItem('compass_v5_profile');
        if (saved) {
            userProfile = JSON.parse(saved);
            el.userName.innerText = userProfile.name + " 님";
            return true;
        }
        return false;
    };

    const toggleProfileModal = (show) => {
        if (show) {
            document.getElementById('inName').value = userProfile.name || "";
            document.getElementById('inAge').value = userProfile.age || "40대";
            document.getElementById('inGender').value = userProfile.gender || "남성";
            document.getElementById('inRegion').value = userProfile.region || "";
            document.getElementById('inJob').value = userProfile.job || "";
            el.modal.style.display = 'flex';
            el.modal.scrollTop = 0; // 모달을 열 때 항상 맨 위로 스크롤 강제 (할렐루야! 보이게)
        } else {
            el.modal.style.display = 'none';
        }
    };

    el.saveBtn.addEventListener('click', () => {
        const name = document.getElementById('inName').value.trim();
        if (!name) return;
        userProfile = {
            name: name, age: document.getElementById('inAge').value,
            gender: document.getElementById('inGender').value,
            region: document.getElementById('inRegion').value.trim(),
            job: document.getElementById('inJob').value.trim()
        };
        localStorage.setItem('compass_v5_profile', JSON.stringify(userProfile));
        el.userName.innerText = userProfile.name + " 님";
        toggleProfileModal(false);
    });

    if (!loadProfile()) toggleProfileModal(true);

    const setTask = (mode) => {
        currentTask = mode;
        const config = {
            scripture: { title: "말씀 찾기", icon: "fas fa-compass", guide: "성경 말씀이 필요한 상황을 말씀해주세요.<br>당신의 삶에 꼭 맞는 구절을 찾아드립니다.", place: "어떤 상황의 말씀을 찾으시나요?" },
            prayer: { title: "기도문 작성", icon: "fas fa-hands-praying", guide: "진솔한 기도문이 필요하시군요.<br>누구를 위해 무엇을 기도하고 싶으신가요?", place: "기도하고 싶은 내용을 말씀해주세요." },
            meditation: { title: "오늘의 묵상", icon: "fas fa-book-open", guide: "오늘 하루 깊이 새기고 싶은 주제가 있나요?<br>영혼을 깨우는 묵상글을 준비해드립니다.", place: "묵상하고 싶은 주제를 말씀해주세요." },
            chat: { title: "목사님 대화", icon: "fas fa-comment-dots", guide: "김성수 목사님과 대화를 시작합니다.<br>고민이나 생각을 편하게 들려주세요.", place: "하고 싶은 말씀을 입력해주세요." }
        };
        const c = config[mode];
        el.taskTitle.innerText = c.title; el.taskIcon.className = c.icon;
        el.taskGuide.innerHTML = c.guide; el.input.placeholder = c.place;
        el.chatLabel.innerText = "🔔 " + c.title + " 결과";
        showView('task'); el.input.focus();
    };

    document.querySelectorAll('.nav-card').forEach(card => card.addEventListener('click', () => setTask(card.dataset.mode)));
    el.homeBtn.addEventListener('click', () => { showView('home'); el.input.value = ""; });
    el.profileBtn.addEventListener('click', () => toggleProfileModal(true));

    const sendMessage = async () => {
        const msg = el.input.value.trim();
        if (!msg) return;

        showView('chat');
        el.chatText.innerHTML = `<div style="text-align:center; color:#FFEA00; padding:40px 0;"><div class="divine-spinner"></div>목사님께서 묵상 중이십니다...</div>`;

        let promptBody = msg;
        if (currentTask === 'scripture') promptBody = `[말씀 추천 요청]: ${msg}`;
        else if (currentTask === 'prayer') promptBody = `[기도문 추천 요청]: ${msg}`;
        else if (currentTask === 'meditation') promptBody = `[묵상 작성 요청]: ${msg}`;

        try {
            const res = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: promptBody, profile: userProfile })
            });
            const data = await res.json();

            // [2단계 응답 처리] 일반 답변과 심층 분석 분리 (정규식 강화)
            let fullText = data.response;
            const deepMatch = fullText.match(/\[?\s*심층\s*분석\s*\]?/);
            const generalMatch = fullText.match(/\[?\s*일반\s*답변\s*\]?/);

            if (deepMatch) {
                const parts = fullText.split(deepMatch[0]);
                let generalContent = parts[0];
                if (generalMatch) generalContent = generalContent.replace(generalMatch[0], "");

                let deepContent = parts[1].trim();

                el.chatText.innerHTML = `
                    <div class="general-content">${generalContent.trim().replace(/\n/g, '<br>')}</div>
                    <div class="deep-container">
                        <button class="deep-btn" onclick="toggleDeepAnalysis(this)">
                            <i class="fas fa-chevron-down"></i> 목사님의 심층 분석 보기
                        </button>
                        <div class="deep-content">
                            <b style="color:var(--gold-bright); display:block; margin-bottom:10px;">[ 김성수 목사의 심층 분석 ]</b>
                            ${deepContent.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `;
            } else {
                let cleanText = fullText;
                if (generalMatch) cleanText = cleanText.replace(generalMatch[0], "");
                el.chatText.innerHTML = cleanText.trim().replace(/\n/g, '<br>');
            }

            el.input.value = '';
        } catch (e) {
            el.chatText.innerHTML = "통신 연결 오류가 발생했습니다.";
        }
    };

    // 글로벌 함수로 등록 (onclick 사용을 위해)
    window.toggleDeepAnalysis = (btn) => {
        const content = btn.nextElementSibling;
        const isOpen = content.style.display === 'block';

        if (isOpen) {
            content.style.display = 'none';
            btn.classList.remove('open');
        } else {
            content.style.display = 'block';
            btn.classList.add('open');
            // 부드러운 스크롤 이동
            setTimeout(() => {
                content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    };

    // --- 음성 인식 (STT) 기능 구현 ---
    const recognition = window.webkitSpeechRecognition ? new webkitSpeechRecognition() : (window.SpeechRecognition ? new SpeechRecognition() : null);

    if (recognition) {
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => {
            el.mic.classList.add('recording');
            el.input.placeholder = "말씀하세요... (듣고 있습니다)";
        };

        recognition.onend = () => {
            el.mic.classList.remove('recording');
            el.input.placeholder = "고민이나 상황을 말씀해주세요...";
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            el.input.value = transcript;
            // 인식이 성공하면 자동으로 전송을 시도할 수도 있지만, 확인을 위해 입력만 함
            console.log("🎤 음성 인식 결과:", transcript);
        };

        recognition.onerror = (event) => {
            console.error("🎤 음성 인식 오류:", event.error);
            el.mic.classList.remove('recording');
        };

        el.mic.addEventListener('click', () => {
            if (el.mic.classList.contains('recording')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        el.mic.addEventListener('click', () => {
            alert("⚠️ 마이크 기능 안내\n죄송합니다. 현재 브라우저가 음성 인식을 지원하지 않습니다. 텍스트 입력을 이용해 주세요!");
        });
    }

    // [복구] 전송 버튼 및 엔터 키 리스너
    el.send.addEventListener('click', sendMessage);
    el.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    // --- 카톡 공유 기능 구현 ---
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const rawText = el.chatText.innerText;
            if (!rawText || rawText.includes("묵상 중이십니다")) return;

            // 공유 텍스트 포맷팅
            const shareTitle = "🧭 서머나 영적 나침반 상담 결과";
            const shareText = `[${shareTitle}]\n\n${rawText.trim()}\n\n📖 영혼의 길잡이, Compass`;

            try {
                if (navigator.share) {
                    // 모바일 등 Web Share API 지원 브라우저
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: window.location.href
                    });
                } else {
                    // PC 등 미지원 브라우저 (클립보드 복사)
                    await navigator.clipboard.writeText(shareText);
                    alert("✅ 답변 내용이 복사되었습니다!\n카카오톡 대화창에 '붙여넣기'하여 공유해 주세요. 😇");
                }
            } catch (e) {
                console.log("공유 API 오류 (취소 등):", e);
            }
        });
    }
});
