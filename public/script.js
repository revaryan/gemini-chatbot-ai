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
   MESSAGES
═══════════════════════════════ */

const LABELS = { user: 'You', bot: 'Travel AI 🌍' };

const LOADING_TEXTS = [
    'Planning your journey...',
    'Exploring destinations...',
    'Finding the best routes...',
    'Checking local tips...',
    'Consulting travel guides...',
];

marked.setOptions({ breaks: true });

function renderBubble(bubble, role, text) {
    if (role === 'bot') {
        bubble.innerHTML = marked.parse(text);
    } else {
        bubble.textContent = text;
    }
}

function appendLoading() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message bot';

    const label = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = LABELS['bot'];

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const randomText = LOADING_TEXTS[Math.floor(Math.random() * LOADING_TEXTS.length)];
    bubble.innerHTML = `
        <div class="travel-loading">
            <div class="loading-plane">✈</div>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
            <div class="loading-text">${randomText}</div>
        </div>
    `;

    wrapper.append(label, bubble);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
}

function appendMessage(role, text, scroll = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const label = document.createElement('span');
    label.className = 'msg-label';
    label.textContent = LABELS[role];

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    renderBubble(bubble, role, text);

    wrapper.append(label, bubble);
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

    const bubble = appendLoading();

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
        renderBubble(bubble, 'bot', reply);
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
