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

            // 링크 처리 (강력한 새 창 열기 적용)
            let formatted = data.response.replace(/\n/g, '<br>');
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            formatted = formatted.replace(urlRegex, (url) => {
                let cleanUrl = url.replace(/[.,)]+$/, "");
                // target="_blank"와 rel="noopener noreferrer"로 새 창 열기 강제
                return `<br><br><a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; background:rgba(255,234,0,0.1); border:1px solid #FFEA00; color:#FFEA00; padding:12px 20px; border-radius:12px; font-weight:800; text-decoration:none; margin-top:5px; box-shadow: 0 4px 15px rgba(255, 234, 0, 0.2);">[ 설교 영상 새 창에서 보기 ▶ ]</a><br>`;
            });

            el.chatText.innerHTML = formatted;
            el.input.value = '';
        } catch (e) {
            el.chatText.innerHTML = "통신 연결 오류가 발생했습니다.";
        }
    };

    el.send.addEventListener('click', sendMessage);
    el.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    el.mic.addEventListener('click', () => {
        alert("⚠️ 마이크 기능 안내\n음성 인식은 보안 연결(HTTPS) 환경에서만 작동합니다. 현재는 텍스트 입력으로 이용해 주세요!");
    });
});
