// ========================================
// Mamnoon.ai Translator - Main Application
// With Speech Recognition & Live Subtitles
// ========================================

(function() {
    'use strict';

    // ========================================
    // Auth Check (allow guests)
    // ========================================
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestMode = urlParams.get('guest') === 'true';
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user && !isGuestMode) {
        window.location.href = 'login.html';
        return;
    }

    // ========================================
    // State
    // ========================================
    const state = {
        user: user || { id: null, name: 'Guest', email: 'guest@mamnoon.ai', isGuest: true },
        profile: JSON.parse(localStorage.getItem('profile')) || {},
        ws: null,
        roomCode: null,
        sessionId: null,
        maxMinutes: 15,
        timerInterval: null,
        startTime: null,
        myLanguage: 'en',
        connected: false,
        
        // Speech Recognition
        recognition: null,
        isListening: false,
        speechSupported: false,
        interimTranscript: '',
        
        // Transcript
        transcript: [],
        
        // Notifications
        notificationsEnabled: false
    };

    // ========================================
    // DOM Elements
    // ========================================
    const elements = {
        userName: document.getElementById('userName'),
        userTier: document.getElementById('userTier'),
        currentPlan: document.getElementById('currentPlan'),
        planUsage: document.getElementById('planUsage'),
        upgradeBtn: document.getElementById('upgradeBtn'),
        createRoomBtn: document.getElementById('createRoomBtn'),
        joinRoomBtn: document.getElementById('joinRoomBtn'),
        welcomeCreateBtn: document.getElementById('welcomeCreateBtn'),
        welcomeJoinBtn: document.getElementById('welcomeJoinBtn'),
        languageSelect: document.getElementById('languageSelect'),
        welcomeState: document.getElementById('welcomeState'),
        roomState: document.getElementById('roomState'),
        joinModal: document.getElementById('joinModal'),
        closeJoinModal: document.getElementById('closeJoinModal'),
        joinRoomCode: document.getElementById('joinRoomCode'),
        confirmJoinBtn: document.getElementById('confirmJoinBtn'),
        activeRoomCode: document.getElementById('activeRoomCode'),
        timerValue: document.getElementById('timerValue'),
        leaveRoomBtn: document.getElementById('leaveRoomBtn'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        videoSection: document.getElementById('videoSection'),
        messagesContainer: document.getElementById('messagesContainer'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        paywallModal: document.getElementById('paywallModal'),
        paywallTitle: document.getElementById('paywallTitle'),
        paywallMessage: document.getElementById('paywallMessage'),
        paywallUpgradeBtn: document.getElementById('paywallUpgradeBtn'),
        paywallCloseBtn: document.getElementById('paywallCloseBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        accountBtn: document.getElementById('accountBtn'),
        roomHistory: document.getElementById('roomHistory'),
        
        // Invite modal elements
        inviteBtn: document.getElementById('inviteBtn'),
        inviteModal: document.getElementById('inviteModal'),
        closeInviteModal: document.getElementById('closeInviteModal'),
        inviteLink: document.getElementById('inviteLink'),
        copyInviteLink: document.getElementById('copyInviteLink'),
        inviteCode: document.getElementById('inviteCode'),
        copyInviteCode: document.getElementById('copyInviteCode'),
        downloadIcs: document.getElementById('downloadIcs'),
        addGoogleCal: document.getElementById('addGoogleCal'),
        inviteEmail: document.getElementById('inviteEmail'),
        sendEmailInvite: document.getElementById('sendEmailInvite'),
        emailStatus: document.getElementById('emailStatus'),
        downloadTranscript: document.getElementById('downloadTranscript'),
        
        // Speech elements (will be created dynamically)
        micBtn: null,
        subtitleOverlay: null
    };

    // ========================================
    // Initialize
    // ========================================
    async function init() {
        console.log('🌍 Mamnoon.ai App initialized');
        
        // Check for guest mode
        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = urlParams.get('guest') === 'true';
        
        if (isGuest) {
            // Guest mode - join room directly
            const roomCode = urlParams.get('room');
            const language = urlParams.get('lang') || 'en';
            const guestName = decodeURIComponent(urlParams.get('name') || 'Guest');
            
            // Set up guest user
            state.user = {
                id: 'guest_' + Math.random().toString(36).substring(7),
                name: guestName,
                email: 'guest@mamnoon.ai',
                isGuest: true
            };
            state.myLanguage = language;
            
            // Update UI for guest
            elements.userName.textContent = guestName + ' (Guest)';
            
            // Hide elements not needed for guest
            elements.upgradeBtn?.parentElement?.style && (elements.upgradeBtn.parentElement.style.display = 'none');
            
            // Join the room directly
            if (roomCode) {
                joinRoomAsGuest(roomCode, guestName, language);
            }
            
            // Bind events
            bindEvents();
            return;
        }
        
        // Display user info
        elements.userName.textContent = state.user.name || state.user.email.split('@')[0];
        
        // Load profile and usage
        await loadProfile();
        
        // Load room history
        await loadRoomHistory();
        
        // Initialize speech recognition
        initSpeechRecognition();
        
        // Request notification permission
        initNotifications();
        
        // Bind events
        bindEvents();
        
        // Check URL params for payment status
        checkPaymentStatus();
    }
    
    async function joinRoomAsGuest(roomCode, name, language) {
        showLoading('Joining room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/join/${roomCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: name,
                    language: language
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Room not found');
            }
            
            hideLoading();
            
            // Store room info
            state.roomCode = roomCode.toUpperCase();
            state.user.id = data.user_id;
            state.maxMinutes = 60; // Guests get full session of host
            
            // Connect WebSocket
            connectWebSocket(data.video_url);
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
            // Redirect to join page after error
            setTimeout(() => {
                window.location.href = `join.html?code=${roomCode}`;
            }, 2000);
        }
    }

    // ========================================
    // Speech Recognition Setup
    // ========================================
    function initSpeechRecognition() {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('⚠️ Speech recognition not supported in this browser');
            state.speechSupported = false;
            return;
        }
        
        state.speechSupported = true;
        state.recognition = new SpeechRecognition();
        
        // Configure
        state.recognition.continuous = true;
        state.recognition.interimResults = true;
        state.recognition.maxAlternatives = 1;
        
        // Event handlers
        state.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            state.isListening = true;
            updateMicButton();
        };
        
        state.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            // Auto-restart if still supposed to be listening
            if (state.isListening && state.connected) {
                setTimeout(() => {
                    try {
                        state.recognition.start();
                    } catch (e) {
                        console.log('Restart failed, will try again');
                    }
                }, 100);
            } else {
                state.isListening = false;
                updateMicButton();
            }
        };
        
        state.recognition.onerror = (event) => {
            console.error('🎤 Speech error:', event.error);
            
            if (event.error === 'not-allowed') {
                showNotification('Microphone access denied. Please allow microphone access.', 'error');
                state.isListening = false;
                updateMicButton();
            } else if (event.error === 'no-speech') {
                // This is normal, just restart
                console.log('No speech detected, continuing...');
            }
        };
        
        state.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Show interim results in UI (what's being spoken)
            if (interimTranscript) {
                showInterimSubtitle(interimTranscript);
            }
            
            // Send final results
            if (finalTranscript.trim()) {
                sendSpeechMessage(finalTranscript.trim());
                hideInterimSubtitle();
            }
        };
        
        console.log('✅ Speech recognition initialized');
    }

    // ========================================
    // Push Notifications
    // ========================================
    function initNotifications() {
        if (!('Notification' in window)) {
            console.log('⚠️ Notifications not supported');
            return;
        }
        
        if (Notification.permission === 'granted') {
            state.notificationsEnabled = true;
            console.log('✅ Notifications enabled');
        } else if (Notification.permission !== 'denied') {
            // Request permission when user creates/joins a room
            console.log('📢 Will request notification permission on room action');
        }
    }
    
    function requestNotificationPermission() {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    state.notificationsEnabled = true;
                    console.log('✅ Notifications granted');
                }
            });
        }
    }
    
    function sendNotification(title, body, icon = '🌍') {
        if (!state.notificationsEnabled) return;
        
        // Only send if page is not visible
        if (document.visibilityState === 'visible') return;
        
        try {
            const notification = new Notification(title, {
                body: body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'mamnoon-notification',
                requireInteraction: false
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        } catch (e) {
            console.log('Notification failed:', e);
        }
    }
    
    function updateRecognitionLanguage() {
        if (!state.recognition) return;
        
        // Map our language codes to BCP-47 language tags
        const langMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-PT',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'ru': 'ru-RU',
            'ar': 'ar-SA',
            'hi': 'hi-IN',
            'tr': 'tr-TR',
            'nl': 'nl-NL',
            'pl': 'pl-PL',
            'vi': 'vi-VN',
            'th': 'th-TH',
            'fa': 'fa-IR'
        };
        
        state.recognition.lang = langMap[state.myLanguage] || 'en-US';
        console.log(`🌐 Speech recognition language set to: ${state.recognition.lang}`);
    }
    
    function startListening() {
        if (!state.speechSupported) {
            showNotification('Speech recognition not supported in this browser. Try Chrome or Edge.', 'error');
            return;
        }
        
        if (!state.connected) {
            showNotification('Join a room first to use voice', 'warning');
            return;
        }
        
        updateRecognitionLanguage();
        
        try {
            state.recognition.start();
            state.isListening = true;
        } catch (e) {
            // Already started, ignore
            console.log('Recognition already started');
        }
    }
    
    function stopListening() {
        if (state.recognition) {
            state.isListening = false;
            try {
                state.recognition.stop();
            } catch (e) {
                // Already stopped
            }
        }
        hideInterimSubtitle();
        updateMicButton();
    }
    
    function toggleListening() {
        if (state.isListening) {
            stopListening();
        } else {
            startListening();
        }
    }
    
    function sendSpeechMessage(text) {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        
        console.log('🗣️ Sending speech:', text);
        
        state.ws.send(JSON.stringify({
            type: 'text',
            text: text
        }));
    }
    
    function updateMicButton() {
        if (!elements.micBtn) return;
        
        if (state.isListening) {
            elements.micBtn.classList.add('listening');
            elements.micBtn.innerHTML = '<span class="mic-icon">🎤</span><span class="mic-status">Listening...</span>';
        } else {
            elements.micBtn.classList.remove('listening');
            elements.micBtn.innerHTML = '<span class="mic-icon">🎤</span><span class="mic-status">Start Voice</span>';
        }
    }

    // ========================================
    // Subtitle System
    // ========================================
    function showInterimSubtitle(text) {
        if (!elements.subtitleOverlay) return;
        
        elements.subtitleOverlay.innerHTML = `
            <div class="subtitle-text interim">
                <span class="speaking-indicator">🎤</span> ${escapeHtml(text)}...
            </div>
        `;
        elements.subtitleOverlay.style.display = 'block';
    }
    
    function hideInterimSubtitle() {
        // Don't hide completely, just remove interim
        if (elements.subtitleOverlay) {
            const interim = elements.subtitleOverlay.querySelector('.interim');
            if (interim) interim.remove();
        }
    }
    
    function showSubtitle(sender, text, originalText, senderLang) {
        if (!elements.subtitleOverlay) return;
        
        const langInfo = LANGUAGES[senderLang] || { name: senderLang, flag: '🌐' };
        
        // Create subtitle element
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle-text received';
        subtitle.innerHTML = `
            <div class="subtitle-sender">${escapeHtml(sender)} ${langInfo.flag}</div>
            <div class="subtitle-main">${escapeHtml(text)}</div>
            <div class="subtitle-original">${escapeHtml(originalText)}</div>
        `;
        
        // Clear old subtitles and show new one
        elements.subtitleOverlay.innerHTML = '';
        elements.subtitleOverlay.appendChild(subtitle);
        elements.subtitleOverlay.style.display = 'block';
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (subtitle.parentNode === elements.subtitleOverlay) {
                subtitle.classList.add('fade-out');
                setTimeout(() => subtitle.remove(), 500);
            }
        }, 8000);
    }

    // ========================================
    // Profile & Usage
    // ========================================
    async function loadProfile() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/profile/${state.user.id}`);
            if (response.ok) {
                const data = await response.json();
                state.profile = data.profile || {};
                
                // Update UI
                updatePlanDisplay(data);
                
                // Store profile
                localStorage.setItem('profile', JSON.stringify(state.profile));
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }

    function updatePlanDisplay(data) {
        const tier = data.profile?.tier || 'trial';
        const tierLabels = {
            'trial': 'Free Trial',
            'personal': 'Personal',
            'professional': 'Professional',
            'enterprise': 'Enterprise'
        };
        
        elements.userTier.textContent = tierLabels[tier] || tier;
        elements.userTier.className = `user-tier tier-${tier}`;
        elements.currentPlan.textContent = tierLabels[tier] || tier;
        
        // Usage display
        if (data.usage && data.limits) {
            const roomsUsed = data.usage.rooms_created || 0;
            const roomsLimit = data.limits.rooms_per_month;
            
            if (roomsLimit === -1) {
                elements.planUsage.textContent = 'Unlimited rooms';
            } else {
                const remaining = roomsLimit - roomsUsed;
                elements.planUsage.textContent = `${remaining} room${remaining !== 1 ? 's' : ''} remaining`;
            }
        }
        
        // Hide upgrade button for paid tiers
        if (tier !== 'trial') {
            elements.upgradeBtn.textContent = 'Manage Plan';
            elements.upgradeBtn.onclick = () => openBillingPortal();
        }
    }

    async function loadRoomHistory() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/sessions/history/${state.user.id}?limit=10`);
            if (response.ok) {
                const data = await response.json();
                displayRoomHistory(data.sessions || []);
            } else {
                elements.roomHistory.innerHTML = '<div class="history-empty">No sessions yet</div>';
            }
        } catch (error) {
            console.error('Failed to load room history:', error);
            elements.roomHistory.innerHTML = '<div class="history-empty">Could not load history</div>';
        }
    }

    function displayRoomHistory(sessions) {
        if (!sessions || sessions.length === 0) {
            elements.roomHistory.innerHTML = '<div class="history-empty">No sessions yet</div>';
            return;
        }
        
        const html = sessions.slice(0, 5).map(session => {
            const date = new Date(session.started_at || session.created_at);
            const timeAgo = getTimeAgo(date);
            const duration = session.duration_minutes ? `${session.duration_minutes} min` : 'In progress';
            const isActive = session.status === 'active';
            const status = isActive ? '🟢' : '⚪';
            
            // Add end session button for active sessions
            const endBtn = isActive ? `
                <button class="end-session-btn" onclick="endStuckSession('${session.id}', '${session.room_code}')" title="End this session">
                    ✕
                </button>
            ` : '';
            
            return `
                <div class="history-item ${isActive ? 'active' : ''}">
                    <div class="history-room">
                        <span class="history-status">${status}</span>
                        <span class="history-code">${session.room_code}</span>
                    </div>
                    <div class="history-meta">
                        <span class="history-time">${timeAgo}</span>
                        <span class="history-duration">${duration}</span>
                        ${endBtn}
                    </div>
                </div>
            `;
        }).join('');
        
        elements.roomHistory.innerHTML = html;
    }

    // End stuck session (kill switch)
    window.endStuckSession = async function(sessionId, roomCode) {
        if (!confirm(`End session ${roomCode}? This will free up your room slot.`)) {
            return;
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/session/end/${sessionId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                showNotification(`Session ${roomCode} ended`, 'success');
                // Reload history
                await loadRoomHistory();
                // Reload profile to update usage
                await loadProfile();
            } else {
                const data = await response.json();
                throw new Error(data.detail || 'Failed to end session');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    async function openBillingPortal() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/billing/portal?user_id=${state.user.id}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Failed to open billing portal:', error);
            showNotification('Failed to open billing portal', 'error');
        }
    }

    // ========================================
    // Event Bindings
    // ========================================
    function bindEvents() {
        // Room creation
        elements.createRoomBtn?.addEventListener('click', createRoom);
        elements.welcomeCreateBtn?.addEventListener('click', createRoom);
        
        // Room joining
        elements.joinRoomBtn?.addEventListener('click', () => showJoinModal());
        elements.welcomeJoinBtn?.addEventListener('click', () => showJoinModal());
        elements.closeJoinModal?.addEventListener('click', hideJoinModal);
        elements.confirmJoinBtn?.addEventListener('click', joinRoom);
        
        // Room code input - auto uppercase and submit on enter
        elements.joinRoomCode?.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        elements.joinRoomCode?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinRoom();
        });
        
        // Language selection
        elements.languageSelect?.addEventListener('change', (e) => {
            state.myLanguage = e.target.value;
            updateRecognitionLanguage();
            console.log(`🌐 Language changed to: ${state.myLanguage}`);
        });
        
        // In-room actions
        elements.leaveRoomBtn?.addEventListener('click', leaveRoom);
        elements.copyCodeBtn?.addEventListener('click', copyRoomCode);
        
        // Messaging
        elements.sendBtn?.addEventListener('click', sendMessage);
        elements.messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Paywall
        elements.paywallUpgradeBtn?.addEventListener('click', () => goToCheckout());
        elements.paywallCloseBtn?.addEventListener('click', hidePaywall);
        
        // Account
        elements.logoutBtn?.addEventListener('click', logout);
        elements.accountBtn?.addEventListener('click', () => window.location.href = 'account.html');
        
        // Upgrade button
        elements.upgradeBtn?.addEventListener('click', () => goToCheckout());
        
        // Modal background click
        elements.joinModal?.addEventListener('click', (e) => {
            if (e.target === elements.joinModal) hideJoinModal();
        });
        elements.paywallModal?.addEventListener('click', (e) => {
            if (e.target === elements.paywallModal) hidePaywall();
        });
        
        // Invite modal
        elements.inviteBtn?.addEventListener('click', showInviteModal);
        elements.closeInviteModal?.addEventListener('click', hideInviteModal);
        elements.inviteModal?.addEventListener('click', (e) => {
            if (e.target === elements.inviteModal) hideInviteModal();
        });
        elements.copyInviteLink?.addEventListener('click', copyInviteLink);
        elements.copyInviteCode?.addEventListener('click', () => {
            navigator.clipboard.writeText(state.roomCode);
            showNotification('Room code copied!', 'success');
        });
        elements.downloadIcs?.addEventListener('click', downloadCalendarFile);
        elements.addGoogleCal?.addEventListener('click', openGoogleCalendar);
        elements.sendEmailInvite?.addEventListener('click', sendEmailInvite);
        elements.inviteEmail?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendEmailInvite();
        });
        elements.downloadTranscript?.addEventListener('click', downloadTranscript);
    }

    // ========================================
    // Room Creation
    // ========================================
    async function createRoom() {
        // Request notification permission
        requestNotificationPermission();
        
        showLoading('Creating room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.user.id })
            });
            
            const data = await response.json();
            
            // Handle paywall responses
            if (response.status === 402 || response.status === 429) {
                hideLoading();
                const detail = data.detail || data;
                showPaywall(detail.code, detail.message);
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.detail?.message || data.detail || 'Failed to create room');
            }
            
            hideLoading();
            
            // Store room info
            state.roomCode = data.room_code;
            state.sessionId = data.session_id;
            state.maxMinutes = data.max_minutes || 15;
            
            // Connect WebSocket
            connectWebSocket(data.video_url);
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    // ========================================
    // Room Joining
    // ========================================
    function showJoinModal() {
        elements.joinModal.style.display = 'flex';
        elements.joinRoomCode.value = '';
        elements.joinRoomCode.focus();
    }

    function hideJoinModal() {
        elements.joinModal.style.display = 'none';
    }

    async function joinRoom() {
        const code = elements.joinRoomCode.value.trim().toUpperCase();
        if (!code || code.length !== 6) {
            showNotification('Please enter a valid 6-character room code', 'error');
            return;
        }
        
        hideJoinModal();
        showLoading('Joining room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/join/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.user.id,
                    user_name: state.user.name || state.user.email.split('@')[0],
                    language: state.myLanguage
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Room not found');
            }
            
            hideLoading();
            
            state.roomCode = data.room_code;
            state.maxMinutes = 180; // Joiners get longer time
            
            connectWebSocket(data.video_url);
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    function leaveRoom() {
        if (confirm('Are you sure you want to leave this room?')) {
            disconnectRoom();
        }
    }

    function disconnectRoom() {
        // Stop speech recognition
        stopListening();
        
        if (state.ws) {
            state.ws.close();
            state.ws = null;
        }
        
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        
        // End session on backend
        if (state.sessionId) {
            fetch(`${CONFIG.API_BASE}/api/room/end/${state.roomCode}?session_id=${state.sessionId}`, {
                method: 'POST'
            }).catch(() => {});
        }
        
        state.roomCode = null;
        state.sessionId = null;
        state.connected = false;
        state.transcript = []; // Clear transcript
        
        // Reset UI
        elements.roomState.style.display = 'none';
        elements.welcomeState.style.display = 'flex';
        elements.messagesContainer.innerHTML = '<div class="empty-messages"><p>💬 Messages will appear here</p></div>';
        elements.videoSection.innerHTML = '<div class="video-placeholder"><div class="video-placeholder-icon">📹</div><p>Loading video...</p></div>';
        
        // Remove mic button and subtitle overlay
        elements.micBtn?.remove();
        elements.subtitleOverlay?.remove();
        elements.micBtn = null;
        elements.subtitleOverlay = null;
        
        // Reload profile to update usage
        loadProfile();
    }

    function copyRoomCode() {
        navigator.clipboard.writeText(state.roomCode).then(() => {
            showNotification('Room code copied!', 'success');
        });
    }

    // ========================================
    // Invite Modal
    // ========================================
    function showInviteModal() {
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${state.roomCode}`;
        
        elements.inviteLink.value = inviteUrl;
        elements.inviteCode.textContent = state.roomCode;
        elements.inviteModal.style.display = 'flex';
    }

    function hideInviteModal() {
        elements.inviteModal.style.display = 'none';
    }

    function copyInviteLink() {
        const link = elements.inviteLink.value;
        navigator.clipboard.writeText(link).then(() => {
            showNotification('Invite link copied!', 'success');
            elements.copyInviteLink.textContent = 'Copied!';
            setTimeout(() => {
                elements.copyInviteLink.textContent = 'Copy';
            }, 2000);
        });
    }

    function downloadCalendarFile() {
        const now = new Date();
        const end = new Date(now.getTime() + state.maxMinutes * 60000);
        
        const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${state.roomCode}`;
        
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mamnoon.ai//Translation Room//EN
BEGIN:VEVENT
UID:${state.roomCode}@mamnoon.ai
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(now)}
DTEND:${formatDate(end)}
SUMMARY:Mamnoon.ai Translation Room
DESCRIPTION:Join the real-time translation room:\\n\\nRoom Code: ${state.roomCode}\\n\\nClick to join: ${inviteUrl}\\n\\nNo signup required for guests.
URL:${inviteUrl}
LOCATION:${inviteUrl}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mamnoon-room-${state.roomCode}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Calendar file downloaded!', 'success');
    }

    function openGoogleCalendar() {
        const now = new Date();
        const end = new Date(now.getTime() + state.maxMinutes * 60000);
        
        const formatGoogleDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${state.roomCode}`;
        
        const title = encodeURIComponent('Mamnoon.ai Translation Room');
        const details = encodeURIComponent(`Join the real-time translation room:\n\nRoom Code: ${state.roomCode}\n\nClick to join: ${inviteUrl}\n\nNo signup required for guests.`);
        const location = encodeURIComponent(inviteUrl);
        const dates = `${formatGoogleDate(now)}/${formatGoogleDate(end)}`;
        
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
        
        window.open(googleUrl, '_blank');
    }

    async function sendEmailInvite() {
        const email = elements.inviteEmail.value.trim();
        
        if (!email || !email.includes('@')) {
            elements.emailStatus.textContent = 'Please enter a valid email';
            elements.emailStatus.className = 'email-status error';
            return;
        }
        
        elements.emailStatus.textContent = 'Sending...';
        elements.emailStatus.className = 'email-status sending';
        elements.sendEmailInvite.disabled = true;
        
        try {
            const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
            const inviteUrl = `${baseUrl}join.html?code=${state.roomCode}`;
            
            const response = await fetch(`${CONFIG.API_BASE}/api/invite/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_email: email,
                    room_code: state.roomCode,
                    host_name: state.user.name || 'Someone',
                    invite_url: inviteUrl
                })
            });
            
            if (response.ok) {
                elements.emailStatus.textContent = `✓ Invite sent to ${email}`;
                elements.emailStatus.className = 'email-status success';
                elements.inviteEmail.value = '';
            } else {
                throw new Error('Failed to send');
            }
        } catch (error) {
            elements.emailStatus.textContent = 'Failed to send. Try copying the link instead.';
            elements.emailStatus.className = 'email-status error';
        }
        
        elements.sendEmailInvite.disabled = false;
    }

    // ========================================
    // Transcript
    // ========================================
    function addToTranscript(entry) {
        state.transcript.push({
            timestamp: new Date().toISOString(),
            ...entry
        });
    }

    function downloadTranscript() {
        if (state.transcript.length === 0) {
            showNotification('No messages to download yet', 'info');
            return;
        }
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
        const timeStr = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit' 
        });
        
        let content = `MAMNOON.AI TRANSLATION TRANSCRIPT
================================
Room: ${state.roomCode}
Date: ${dateStr}
Time: ${timeStr}
Participants: ${state.user.name}
================================

`;

        state.transcript.forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            
            if (entry.type === 'system') {
                content += `[${time}] --- ${entry.message} ---\n\n`;
            } else if (entry.type === 'sent') {
                content += `[${time}] ${state.user.name} (${entry.language?.toUpperCase() || 'EN'}):\n`;
                content += `  "${entry.text}"\n\n`;
            } else if (entry.type === 'received') {
                content += `[${time}] ${entry.sender} (${entry.senderLanguage?.toUpperCase() || '??'}):\n`;
                content += `  Original: "${entry.originalText}"\n`;
                content += `  Translated: "${entry.translatedText}"\n\n`;
            }
        });

        content += `
================================
End of Transcript
Generated by Mamnoon.ai
================================`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transcript-${state.roomCode}-${now.toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Transcript downloaded!', 'success');
    }

    // ========================================
    // WebSocket
    // ========================================
    function connectWebSocket(videoUrl) {
        const wsUrl = `${CONFIG.WS_BASE}/ws/${state.roomCode}/${state.user.id}`;
        state.ws = new WebSocket(wsUrl);
        
        state.ws.onopen = () => {
            console.log('✅ Connected to room:', state.roomCode);
            
            // Send join message
            state.ws.send(JSON.stringify({
                type: 'join',
                user_name: state.user.name || state.user.email.split('@')[0],
                language: state.myLanguage,
                max_minutes: state.maxMinutes
            }));
            
            state.connected = true;
            showRoomUI(videoUrl);
            startTimer();
        };
        
        state.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleMessage(data);
        };
        
        state.ws.onclose = () => {
            console.log('❌ Disconnected');
            if (state.connected) {
                showNotification('Disconnected from room', 'info');
                disconnectRoom();
            }
        };
        
        state.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    function showRoomUI(videoUrl) {
        elements.welcomeState.style.display = 'none';
        elements.roomState.style.display = 'block';
        elements.activeRoomCode.textContent = state.roomCode;
        
        // Create video container with subtitle overlay
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.innerHTML = `
            <div class="subtitle-overlay" id="subtitleOverlay"></div>
        `;
        
        // Load video
        if (videoUrl) {
            const iframe = document.createElement('iframe');
            iframe.src = `${videoUrl}?t=${Date.now()}`;
            iframe.allow = 'camera; microphone; fullscreen; display-capture; autoplay';
            iframe.allowFullscreen = true;
            videoContainer.insertBefore(iframe, videoContainer.firstChild);
        } else {
            videoContainer.innerHTML = `
                <div class="video-placeholder">
                    <div class="video-placeholder-icon">📹</div>
                    <p>Video unavailable</p>
                </div>
            ` + videoContainer.innerHTML;
        }
        
        elements.videoSection.innerHTML = '';
        elements.videoSection.appendChild(videoContainer);
        
        // Store subtitle overlay reference
        elements.subtitleOverlay = document.getElementById('subtitleOverlay');
        
        // Add mic button
        createMicButton();
        
        elements.messageInput.focus();
    }
    
    function createMicButton() {
        // Create mic button container
        const micContainer = document.createElement('div');
        micContainer.className = 'mic-container';
        micContainer.innerHTML = `
            <button class="mic-btn" id="micBtn">
                <span class="mic-icon">🎤</span>
                <span class="mic-status">Start Voice</span>
            </button>
            <div class="mic-hint">Click to enable voice translation</div>
        `;
        
        // Insert after video section
        elements.videoSection.appendChild(micContainer);
        
        // Store reference and bind event
        elements.micBtn = document.getElementById('micBtn');
        elements.micBtn.addEventListener('click', toggleListening);
        
        // Show speech not supported warning
        if (!state.speechSupported) {
            micContainer.innerHTML += `
                <div class="mic-warning">⚠️ Voice not supported in this browser. Use Chrome or Edge.</div>
            `;
        }
    }

    function startTimer() {
        state.startTime = Date.now();
        
        state.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            const remaining = (state.maxMinutes * 60) - elapsed;
            
            if (remaining <= 0) {
                clearInterval(state.timerInterval);
                elements.timerValue.textContent = '0:00';
                showNotification('Time limit reached!', 'warning');
                disconnectRoom();
                
                // Show paywall if trial
                if (state.profile.tier === 'trial') {
                    showPaywall('TIME_LIMIT', 'Your trial session has ended. Subscribe to get longer sessions.');
                }
                return;
            }
            
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            elements.timerValue.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            // Warning at 1 minute
            if (remaining === 60) {
                showNotification('⚠️ 1 minute remaining!', 'warning');
            }
        }, 1000);
    }

    // ========================================
    // Messaging
    // ========================================
    function handleMessage(data) {
        switch (data.type) {
            case 'system':
                addSystemMessage(data.message);
                addToTranscript({ type: 'system', message: data.message });
                // Send notification if someone joined
                if (data.message.includes('joined')) {
                    sendNotification('Mamnoon.ai', data.message);
                }
                break;
            case 'translation':
                addReceivedMessage(data);
                addToTranscript({ 
                    type: 'received', 
                    sender: data.sender,
                    senderLanguage: data.sender_language,
                    originalText: data.original_text,
                    translatedText: data.translated_text
                });
                // Also show as subtitle!
                showSubtitle(data.sender, data.translated_text, data.original_text, data.sender_language);
                break;
            case 'sent':
                addSentMessage(data.original_text, data.recipients);
                addToTranscript({ 
                    type: 'sent', 
                    text: data.original_text,
                    language: state.myLanguage
                });
                break;
            case 'limit_reached':
                showNotification(data.message, 'warning');
                disconnectRoom();
                showPaywall('TIME_LIMIT', data.message);
                break;
            case 'error':
                showNotification(data.message, 'error');
                break;
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

    function addSystemMessage(text) {
        clearEmptyState();
        const div = document.createElement('div');
        div.className = 'message system';
        div.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
        elements.messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function addSentMessage(text, recipients) {
        clearEmptyState();
        const lang = LANGUAGES[state.myLanguage];
        const div = document.createElement('div');
        div.className = 'message sent';
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">You (${lang.name} ${lang.flag})</span>
                </div>
                <div class="message-text">${escapeHtml(text)}</div>
            </div>
        `;
        elements.messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function addReceivedMessage(data) {
        clearEmptyState();
        const senderLang = LANGUAGES[data.sender_language] || { name: data.sender_language, flag: '🌐' };
        const yourLang = LANGUAGES[data.your_language] || { name: data.your_language, flag: '🌐' };
        
        const div = document.createElement('div');
        div.className = 'message received';
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(data.sender)} (${senderLang.name} ${senderLang.flag})</span>
                    <span class="message-lang">${senderLang.flag} → ${yourLang.flag}</span>
                </div>
                <div class="message-text">${escapeHtml(data.translated_text)}</div>
                <div class="message-original">Original: "${escapeHtml(data.original_text)}"</div>
            </div>
        `;
        elements.messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function clearEmptyState() {
        const empty = elements.messagesContainer.querySelector('.empty-messages');
        if (empty) empty.remove();
    }

    function scrollToBottom() {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }

    // ========================================
    // Paywall
    // ========================================
    function showPaywall(code, message) {
        const titles = {
            'TRIAL_USED': '🎉 Trial Complete!',
            'SUBSCRIPTION_INACTIVE': '⚠️ Subscription Inactive',
            'ROOM_LIMIT': '📊 Room Limit Reached',
            'TIME_LIMIT': '⏱️ Time Limit Reached'
        };
        
        elements.paywallTitle.textContent = titles[code] || 'Upgrade Required';
        elements.paywallMessage.textContent = message || 'Please subscribe to continue using Mamnoon.ai';
        elements.paywallModal.style.display = 'flex';
    }

    function hidePaywall() {
        elements.paywallModal.style.display = 'none';
    }

    function goToCheckout(tier = 'personal') {
        window.location.href = 'pricing.html';
    }

    // ========================================
    // Payment Status
    // ========================================
    function checkPaymentStatus() {
        const params = new URLSearchParams(window.location.search);
        
        if (params.get('payment') === 'success') {
            const tier = params.get('tier') || 'personal';
            showNotification(`🎉 Welcome to ${tier}! Your subscription is now active.`, 'success');
            
            // Clear URL params
            window.history.replaceState({}, '', window.location.pathname);
            
            // Reload profile
            loadProfile();
        } else if (params.get('payment') === 'cancelled') {
            showNotification('Payment was cancelled. You can try again anytime.', 'info');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    // ========================================
    // Auth
    // ========================================
    function logout() {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('user');
            localStorage.removeItem('session');
            localStorage.removeItem('profile');
            window.location.href = 'login.html';
        }
    }

    // ========================================
    // Utilities
    // ========================================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showNotification(message, type = 'info') {
        // Remove existing
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Auto-remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    function showLoading(message = 'Loading...') {
        hideLoading();
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    function hideLoading() {
        document.getElementById('loadingOverlay')?.remove();
    }

    // ========================================
    // Start App
    // ========================================
    init();

})();
