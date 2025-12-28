// ========================================
// Real-Time Translator - Main Application
// ========================================

(function() {
    'use strict';

    // ========================================
    // State Management
    // ========================================
    const state = {
        ws: null,
        roomCode: null,
        userId: null,
        myLanguage: 'en',
        myName: 'Guest',
        currentAction: 'create',
        videoUrl: null,
        connected: false
    };

    // ========================================
    // DOM Elements
    // ========================================
    const elements = {
        welcomeScreen: document.getElementById('welcomeScreen'),
        chatInterface: document.getElementById('chatInterface'),
        createOption: document.getElementById('createOption'),
        joinOption: document.getElementById('joinOption'),
        roomCodeGroup: document.getElementById('roomCodeGroup'),
        roomCodeInput: document.getElementById('roomCodeInput'),
        nameInput: document.getElementById('nameInput'),
        languageSelect: document.getElementById('languageSelect'),
        startBtn: document.getElementById('startBtn'),
        statusBadge: document.getElementById('statusBadge'),
        languageBadge: document.getElementById('languageBadge'),
        yourLanguageDisplay: document.getElementById('yourLanguageDisplay'),
        participantCount: document.getElementById('participantCount'),
        participantNumber: document.getElementById('participantNumber'),
        roomCodeDisplay: document.getElementById('roomCodeDisplay'),
        messagesContainer: document.getElementById('messagesContainer'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        voiceBtn: document.getElementById('voiceBtn'),
        videoContainer: document.getElementById('videoContainer'),
        videoStatus: document.getElementById('videoStatus'),
        disconnectBtn: document.getElementById('disconnectBtn')
    };

    // ========================================
    // Initialization
    // ========================================
    function init() {
        createParticles();
        bindEvents();
        checkApiHealth();
        console.log(`🌍 Real-Time Translator v${CONFIG.VERSION} initialized`);
    }

    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.width = Math.random() * 60 + 20 + 'px';
            particle.style.height = particle.style.width;
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = Math.random() * 20 + 20 + 's';
            container.appendChild(particle);
        }
    }

    async function checkApiHealth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/health`);
            const data = await response.json();
            console.log('✅ API Health:', data);
        } catch (error) {
            console.error('❌ API Health Check Failed:', error);
        }
    }

    // ========================================
    // Event Binding
    // ========================================
    function bindEvents() {
        // Action selector
        elements.createOption.addEventListener('click', () => selectAction('create'));
        elements.joinOption.addEventListener('click', () => selectAction('join'));

        // Start button
        elements.startBtn.addEventListener('click', handleStart);

        // Message input
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Send button
        elements.sendBtn.addEventListener('click', sendMessage);

        // Voice button (coming soon)
        elements.voiceBtn.addEventListener('click', () => {
            alert('🎤 Voice recording coming soon!\n\nFor now, use text chat to experience real-time translation.');
        });

        // Disconnect button
        elements.disconnectBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to disconnect from this room?')) {
                disconnectFromRoom();
            }
        });
    }

    function selectAction(action) {
        state.currentAction = action;
        
        if (action === 'create') {
            elements.createOption.classList.add('active');
            elements.joinOption.classList.remove('active');
            elements.roomCodeGroup.style.display = 'none';
        } else {
            elements.joinOption.classList.add('active');
            elements.createOption.classList.remove('active');
            elements.roomCodeGroup.style.display = 'block';
        }
    }

    // ========================================
    // Room Management
    // ========================================
    async function handleStart() {
        state.myName = elements.nameInput.value.trim() || 'Guest';
        state.myLanguage = elements.languageSelect.value;

        if (state.currentAction === 'create') {
            await createRoom();
        } else {
            const code = elements.roomCodeInput.value.trim().toUpperCase();
            if (code.length !== 6) {
                alert('Please enter a valid 6-character room code');
                return;
            }
            await joinRoom(code);
        }
    }

    async function createRoom() {
        try {
            setButtonLoading(true, 'Creating room...');

            const response = await fetch(`${CONFIG.API_BASE}/api/room/create`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to create room');

            const data = await response.json();
            state.roomCode = data.room_code;
            state.userId = generateUserId();

            connectWebSocket();
        } catch (error) {
            alert('Error creating room: ' + error.message);
            setButtonLoading(false);
        }
    }

    async function joinRoom(code) {
        try {
            setButtonLoading(true, 'Joining room...');

            const response = await fetch(
                `${CONFIG.API_BASE}/api/room/join/${code}?user_name=${encodeURIComponent(state.myName)}&language=${state.myLanguage}`,
                { method: 'POST' }
            );

            if (!response.ok) throw new Error('Room not found');

            const data = await response.json();
            state.roomCode = data.room_code;
            state.userId = data.user_id;

            connectWebSocket();
        } catch (error) {
            alert('Error joining room: ' + error.message);
            setButtonLoading(false);
        }
    }

    // ========================================
    // WebSocket Management
    // ========================================
    function connectWebSocket() {
        state.ws = new WebSocket(`${CONFIG.WS_BASE}/ws/${state.roomCode}/${state.userId}`);

        state.ws.onopen = () => {
            console.log('✅ Connected to room:', state.roomCode);

            state.ws.send(JSON.stringify({
                type: 'join',
                user_name: state.myName,
                language: state.myLanguage
            }));

            state.connected = true;
            updateConnectionStatus(true);
            showChatInterface();
        };

        state.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };

        state.ws.onclose = () => {
            console.log('❌ Disconnected from room');
            state.connected = false;
            updateConnectionStatus(false);
        };

        state.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    function handleWebSocketMessage(data) {
        switch (data.type) {
            case 'system':
                addSystemMessage(data.message);
                if (data.your_language) {
                    state.myLanguage = data.your_language;
                }
                if (data.video_url && !state.videoUrl) {
                    state.videoUrl = data.video_url;
                    loadVideo();
                }
                break;

            case 'translation':
                addReceivedMessage(
                    data.sender,
                    data.sender_language,
                    data.original_text,
                    data.translated_text,
                    data.your_language
                );
                if (data.translated_audio) {
                    playAudio(data.translated_audio);
                }
                break;

            case 'sent':
                addSentMessage(data.original_text, data.recipients);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }

    function sendMessage() {
        const text = elements.messageInput.value.trim();
        if (!text || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;

        state.ws.send(JSON.stringify({
            type: 'text',
            text: text
        }));

        elements.messageInput.value = '';
    }

    function disconnectFromRoom() {
        if (state.ws) {
            state.ws.close();
            state.ws = null;
        }

        state.roomCode = null;
        state.userId = null;
        state.videoUrl = null;
        state.connected = false;

        elements.chatInterface.classList.remove('active');
        elements.welcomeScreen.style.display = 'block';
        updateConnectionStatus(false);
        elements.languageBadge.style.display = 'none';
        elements.participantCount.style.display = 'none';
        setButtonLoading(false);

        console.log('👋 Disconnected from room');
    }

    // ========================================
    // UI Updates
    // ========================================
    function setButtonLoading(loading, text = 'Start Conversation') {
        elements.startBtn.disabled = loading;
        elements.startBtn.innerHTML = loading 
            ? `<span class="spinner"></span> ${text}`
            : `<span>${text}</span>`;
    }

    function updateConnectionStatus(connected) {
        if (connected) {
            elements.statusBadge.className = 'status-badge status-connected';
            elements.statusBadge.innerHTML = '<span class="status-indicator"></span> Connected';
        } else {
            elements.statusBadge.className = 'status-badge status-disconnected';
            elements.statusBadge.innerHTML = '<span class="status-indicator"></span> Disconnected';
        }
    }

    function showChatInterface() {
        elements.welcomeScreen.style.display = 'none';
        elements.chatInterface.classList.add('active');
        elements.roomCodeDisplay.textContent = state.roomCode;

        const lang = LANGUAGES[state.myLanguage];
        elements.yourLanguageDisplay.textContent = `${lang.name} ${lang.flag}`;
        elements.languageBadge.style.display = 'block';
        elements.participantCount.style.display = 'block';
        elements.messageInput.placeholder = `Type in ${lang.name}...`;
        elements.messageInput.focus();
        elements.messagesContainer.innerHTML = '';

        loadVideo();
    }

    function loadVideo() {
        if (!state.videoUrl) {
            elements.videoStatus.textContent = 'Video not available';
            return;
        }

        elements.videoContainer.innerHTML = `
            <iframe 
                src="${state.videoUrl}?t=${Date.now()}"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                allowfullscreen
            ></iframe>
        `;

        console.log('✅ Loaded video:', state.videoUrl);
    }

    // ========================================
    // Message Display
    // ========================================
    function addSystemMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message system';
        msgDiv.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
        elements.messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function addSentMessage(text, recipientCount) {
        const lang = LANGUAGES[state.myLanguage];
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message sent';
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">You (${lang.name} ${lang.flag})</span>
                    <span class="message-lang-badge">Sent to ${recipientCount} ${recipientCount === 1 ? 'person' : 'people'}</span>
                </div>
                <div class="message-text">${escapeHtml(text)}</div>
            </div>
        `;
        elements.messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function addReceivedMessage(sender, senderLang, original, translated, yourLang) {
        const senderLangInfo = LANGUAGES[senderLang];
        const yourLangInfo = LANGUAGES[yourLang];
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message received';
        msgDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(sender)} (${senderLangInfo.name} ${senderLangInfo.flag})</span>
                    <span class="message-lang-badge">${senderLangInfo.flag} → ${yourLangInfo.flag}</span>
                </div>
                <div class="message-text">${escapeHtml(translated)}</div>
                <div class="message-translation">Original: "${escapeHtml(original)}"</div>
            </div>
        `;
        elements.messagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    // ========================================
    // Utilities
    // ========================================
    function generateUserId() {
        return Math.random().toString(36).substring(2, 10);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function playAudio(base64Audio) {
        try {
            const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
            audio.play();
        } catch (e) {
            console.error('Failed to play audio:', e);
        }
    }

    // ========================================
    // Initialize on DOM Ready
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
