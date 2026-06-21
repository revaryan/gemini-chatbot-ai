const form        = document.getElementById('chat-form');
const input       = document.getElementById('user-input');
const chatBox     = document.getElementById('chat-box');
const sessionList = document.getElementById('session-list');
const newChatBtn  = document.getElementById('new-chat-btn');

const STORAGE_KEY = 'gemini_sessions';
const THEME_KEY   = 'gemini_theme';

let sessions     = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentId    = null;
let conversation = [];

/* ═══════════════════════════════
   THEME
═══════════════════════════════ */

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    document.querySelectorAll('.theme-dot').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

applyTheme(localStorage.getItem(THEME_KEY) || 'bali');

/* ═══════════════════════════════
   LANGUAGE DETECTION
═══════════════════════════════ */

function detectLang(text) {
    if (/[぀-ゟ゠-ヿ]/.test(text))  return 'ja-JP';
    if (/[가-힯]/.test(text))        return 'ko-KR';
    if (/[一-鿿]/.test(text))        return 'zh-CN';
    if (/[؀-ۿ]/.test(text))        return 'ar-SA';
    if (/[฀-๿]/.test(text))        return 'th-TH';
    if (/[Ѐ-ӿ]/.test(text))        return 'ru-RU';
    if (/[ऀ-ॿ]/.test(text))        return 'hi-IN';
    if (/\b(le|la|les|de|du|un|une|est|je|vous|nous)\b/i.test(text)) return 'fr-FR';
    if (/\b(el|la|los|las|es|en|un|una|que|por)\b/i.test(text))      return 'es-ES';
    return 'id-ID';
}

/* ═══════════════════════════════
   TEXT-TO-SPEECH
═══════════════════════════════ */

let activeBtn = null;

function speakText(getText, btn) {
    if (!window.speechSynthesis) return;

    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        if (activeBtn) { activeBtn.textContent = '🔊 Listen'; activeBtn.classList.remove('speaking'); }
        if (activeBtn === btn) { activeBtn = null; return; }
    }

    const text = getText();
    if (!text || text === 'Thinking...') return;

    const utterance  = new SpeechSynthesisUtterance(text);
    utterance.lang   = detectLang(text);
    utterance.rate   = 0.95;
    utterance.pitch  = 1;

    const onEnd = () => {
        btn.textContent = '🔊 Listen';
        btn.classList.remove('speaking');
        activeBtn = null;
    };

    utterance.onstart = () => {
        activeBtn = btn;
        btn.textContent = '■ Stop';
        btn.classList.add('speaking');
    };
    utterance.onend   = onEnd;
    utterance.onerror = onEnd;

    speechSynthesis.speak(utterance);
}

/* ═══════════════════════════════
   MESSAGES
═══════════════════════════════ */

const LABELS = { user: 'You', bot: 'Travel AI 🌍' };

function appendMessage(role, text, scroll = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const label = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = LABELS[role];

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'tts-btn';
    ttsBtn.textContent = '🔊 Listen';
    ttsBtn.addEventListener('click', () => speakText(() => bubble.textContent, ttsBtn));

    wrapper.append(label, bubble, ttsBtn);
    chatBox.appendChild(wrapper);
    if (scroll) chatBox.scrollTop = chatBox.scrollHeight;
    return { wrapper, bubble };
}

/* ═══════════════════════════════
   SESSION MANAGEMENT
═══════════════════════════════ */

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function currentSession() {
    return sessions.find(s => s.id === currentId);
}

function renderSessions() {
    sessionList.innerHTML = '';
    sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item' + (s.id === currentId ? ' active' : '');

        const icon = document.createElement('span');
        icon.className = 'session-icon';
        icon.textContent = '✈️';

        const title = document.createElement('span');
        title.className = 'session-title';
        title.textContent = s.title;

        const del = document.createElement('button');
        del.className = 'session-delete';
        del.textContent = '✕';
        del.addEventListener('click', e => { e.stopPropagation(); deleteSession(s.id); });

        item.append(icon, title, del);
        item.addEventListener('click', () => switchSession(s.id));
        sessionList.appendChild(item);
    });
}

function persistCurrent() {
    const s = currentSession();
    if (!s) return;
    s.conversation = [...conversation];
    if (s.title === 'New Trip') {
        const first = conversation.find(m => m.role === 'user');
        if (first) {
            s.title = first.text.length > 26 ? first.text.slice(0, 26) + '…' : first.text;
        }
    }
    save();
    renderSessions();
}

function renderChat(conv) {
    chatBox.innerHTML = '';
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    activeBtn = null;
    conv.forEach(({ role, text }) => appendMessage(role === 'user' ? 'user' : 'bot', text, false));
    chatBox.scrollTop = chatBox.scrollHeight;
}

function switchSession(id) {
    currentId = id;
    conversation = [...currentSession().conversation];
    renderChat(conversation);
    renderSessions();
    input.focus();
}

function newSession() {
    const s = { id: genId(), title: 'New Trip', conversation: [] };
    sessions.unshift(s);
    save();
    switchSession(s.id);

    // Show welcome message for new session
    chatBox.innerHTML = '';
    const welcome = document.createElement('div');
    welcome.className = 'welcome-msg';
    welcome.innerHTML = `
        <span class="welcome-icon">🌏</span>
        <p>Hello! I'm your AI travel companion.</p>
        <p>Ask me anything — destinations, visas, itineraries, local tips, or translate any sign or text from any language!</p>
    `;
    chatBox.appendChild(welcome);
}

function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    save();
    if (currentId === id) {
        chatBox.innerHTML = '';
        conversation = [];
        currentId = null;
        if (sessions.length > 0) switchSession(sessions[0].id);
        else newSession();
    } else {
        renderSessions();
    }
}

/* ═══════════════════════════════
   SUBMIT
═══════════════════════════════ */

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const userMessage = input.value.trim();
    if (!userMessage) return;

    // Remove welcome message if present
    const welcome = chatBox.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    appendMessage('user', userMessage);
    input.value = '';
    input.disabled = true;

    conversation.push({ role: 'user', text: userMessage });
    persistCurrent();

    const { bubble } = appendMessage('bot', 'Thinking...');

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get response from server.');
        }

        const data  = await res.json();
        const reply = data.result || 'Sorry, no response received.';
        bubble.textContent = reply;
        conversation.push({ role: 'model', text: reply });
        persistCurrent();
    } catch (err) {
        bubble.textContent = err.message || 'Failed to get response from server.';
        conversation.pop();
    } finally {
        input.disabled = false;
        input.focus();
    }
});

newChatBtn.addEventListener('click', newSession);

/* ═══════════════════════════════
   INIT
═══════════════════════════════ */

if (sessions.length === 0) {
    newSession();
} else {
    switchSession(sessions[0].id);
}
