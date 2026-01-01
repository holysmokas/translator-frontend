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
        notificationsEnabled: false,
        
        // Pending invites
        pendingInvites: [],
        pendingRoomCode: null,
        pendingMaxMinutes: 60,
        
        // Personal room
        personalRoomCode: null,
        hasPersonalRoom: false,
        
        // Participants tracking
        participants: new Map() // id -> {name, language, isMuted, isSpeaking}
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
        createInviteBtn: document.getElementById('createInviteBtn'),
        quickStartBtn: document.getElementById('quickStartBtn'),
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
        videoGrid: document.getElementById('videoGrid'),
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
        
        // Pre-invite modal elements
        preInviteModal: document.getElementById('preInviteModal'),
        closePreInviteModal: document.getElementById('closePreInviteModal'),
        preInviteLink: document.getElementById('preInviteLink'),
        copyPreInviteLink: document.getElementById('copyPreInviteLink'),
        preInviteCode: document.getElementById('preInviteCode'),
        copyPreInviteCode: document.getElementById('copyPreInviteCode'),
        preDownloadIcs: document.getElementById('preDownloadIcs'),
        preAddGoogleCal: document.getElementById('preAddGoogleCal'),
        preInviteEmail: document.getElementById('preInviteEmail'),
        preSendEmailInvite: document.getElementById('preSendEmailInvite'),
        preEmailStatus: document.getElementById('preEmailStatus'),
        startReservedRoom: document.getElementById('startReservedRoom'),
        pendingInvitesSection: document.getElementById('pendingInvitesSection'),
        pendingInvitesList: document.getElementById('pendingInvitesList'),
        // New schedule & message elements
        inviteDate: document.getElementById('inviteDate'),
        inviteTime: document.getElementById('inviteTime'),
        timezoneDisplay: document.getElementById('timezoneDisplay'),
        inviteMessage: document.getElementById('inviteMessage'),
        messageCharCount: document.getElementById('messageCharCount'),
        // Share buttons
        shareWhatsApp: document.getElementById('shareWhatsApp'),
        shareSMS: document.getElementById('shareSMS'),
        shareTelegram: document.getElementById('shareTelegram'),
        shareEmail: document.getElementById('shareEmail'),
        directEmailSection: document.getElementById('directEmailSection'),
        
        // Personal room elements
        personalRoomCard: document.getElementById('personalRoomCard'),
        dashboardPersonalLink: document.getElementById('dashboardPersonalLink'),
        copyDashboardLink: document.getElementById('copyDashboardLink'),
        startPersonalRoom: document.getElementById('startPersonalRoom'),
        
        // Active room invite modal elements
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
        
        // Confirm modal elements
        confirmModal: document.getElementById('confirmModal'),
        confirmIcon: document.getElementById('confirmIcon'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        confirmOk: document.getElementById('confirmOk'),
        confirmCancel: document.getElementById('confirmCancel'),
        
        // Multi-party UI elements
        participantCount: document.getElementById('participantCount'),
        tabParticipantCount: document.getElementById('tabParticipantCount'),
        participantsList: document.getElementById('participantsList'),
        participantsPanel: document.getElementById('participantsPanel'),
        chatPanel: document.getElementById('chatPanel'),
        controlsBar: document.getElementById('controlsBar'),
        toggleMicBtn: document.getElementById('toggleMicBtn'),
        toggleVideoBtn: document.getElementById('toggleVideoBtn'),
        toggleSubtitlesBtn: document.getElementById('toggleSubtitlesBtn'),
        endCallBtn: document.getElementById('endCallBtn'),
        unreadBadge: document.getElementById('unreadBadge'),
        
        // Speech elements (will be created dynamically)
        micBtn: null,
        subtitleOverlay: null
    };

    // ========================================
    // Custom Confirm Dialog
    // ========================================
    let confirmResolve = null;
    
    function showConfirm(options = {}) {
        const {
            title = 'Are you sure?',
            message = 'This action cannot be undone.',
            icon = '⚠️',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = true
        } = options;
        
        elements.confirmIcon.textContent = icon;
        elements.confirmTitle.textContent = title;
        elements.confirmMessage.textContent = message;
        elements.confirmOk.textContent = confirmText;
        elements.confirmCancel.textContent = cancelText;
        elements.confirmOk.className = danger ? 'btn btn-danger' : 'btn btn-primary';
        elements.confirmModal.style.display = 'flex';
        
        return new Promise((resolve) => {
            confirmResolve = resolve;
        });
    }
    
    function hideConfirm(result) {
        elements.confirmModal.style.display = 'none';
        if (confirmResolve) {
            confirmResolve(result);
            confirmResolve = null;
        }
    }

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
        
        // Load pending invites
        await loadPendingInvites();
        
        // Load personal room
        await loadPersonalRoom();
        
        // Initialize speech recognition
        initSpeechRecognition();
        
        // Request notification permission
        initNotifications();
        
        // Bind events
        bindEvents();
        
        // Check URL params for payment status
        checkPaymentStatus();
        
        // Check if we should auto-start personal room
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('start_personal') === 'true' && state.hasPersonalRoom) {
            // Clear URL param
            window.history.replaceState({}, '', window.location.pathname);
            // Start personal room
            startPersonalRoomSession();
        }
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
        const confirmed = await showConfirm({
            title: 'End Session?',
            message: `This will end session ${roomCode} and free up your room slot.`,
            icon: '🔴',
            confirmText: 'End Session',
            cancelText: 'Keep Active'
        });
        
        if (!confirmed) return;
        
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
        // Room creation - new flow
        elements.createInviteBtn?.addEventListener('click', createInvite);
        elements.quickStartBtn?.addEventListener('click', createRoom);
        elements.createRoomBtn?.addEventListener('click', createRoom);
        
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
        
        // Personal room
        elements.startPersonalRoom?.addEventListener('click', startPersonalRoomSession);
        elements.copyDashboardLink?.addEventListener('click', () => {
            const link = elements.dashboardPersonalLink?.value;
            if (link) {
                navigator.clipboard.writeText(link);
                showNotification('Link copied!', 'success');
            }
        });
        
        // Modal background click
        elements.joinModal?.addEventListener('click', (e) => {
            if (e.target === elements.joinModal) hideJoinModal();
        });
        elements.paywallModal?.addEventListener('click', (e) => {
            if (e.target === elements.paywallModal) hidePaywall();
        });
        
        // Pre-invite modal
        elements.closePreInviteModal?.addEventListener('click', hidePreInviteModal);
        elements.preInviteModal?.addEventListener('click', (e) => {
            if (e.target === elements.preInviteModal) hidePreInviteModal();
        });
        elements.copyPreInviteLink?.addEventListener('click', () => copyPreInviteLink());
        elements.copyPreInviteCode?.addEventListener('click', () => {
            navigator.clipboard.writeText(state.pendingRoomCode);
            showNotification('Room code copied!', 'success');
        });
        elements.preDownloadIcs?.addEventListener('click', () => downloadCalendarFile(state.pendingRoomCode));
        elements.preAddGoogleCal?.addEventListener('click', () => openGoogleCalendar(state.pendingRoomCode));
        elements.preSendEmailInvite?.addEventListener('click', () => sendPreInviteEmail());
        elements.preInviteEmail?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendPreInviteEmail();
        });
        elements.startReservedRoom?.addEventListener('click', startReservedRoom);
        
        // Message character count
        elements.inviteMessage?.addEventListener('input', (e) => {
            elements.messageCharCount.textContent = e.target.value.length;
        });
        
        // Share buttons
        elements.shareWhatsApp?.addEventListener('click', () => shareVia('whatsapp'));
        elements.shareSMS?.addEventListener('click', () => shareVia('sms'));
        elements.shareTelegram?.addEventListener('click', () => shareVia('telegram'));
        elements.shareEmail?.addEventListener('click', () => {
            elements.directEmailSection.style.display = 'block';
            elements.preInviteEmail.focus();
        });
        
        // Active room invite modal
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
        elements.downloadIcs?.addEventListener('click', () => downloadCalendarFile(state.roomCode));
        elements.addGoogleCal?.addEventListener('click', () => openGoogleCalendar(state.roomCode));
        elements.sendEmailInvite?.addEventListener('click', sendEmailInvite);
        elements.inviteEmail?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendEmailInvite();
        });
        elements.downloadTranscript?.addEventListener('click', downloadTranscript);
        
        // Confirm modal
        elements.confirmOk?.addEventListener('click', () => hideConfirm(true));
        elements.confirmCancel?.addEventListener('click', () => hideConfirm(false));
        elements.confirmModal?.addEventListener('click', (e) => {
            if (e.target === elements.confirmModal) hideConfirm(false);
        });
        
        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => switchSidebarTab(tab.dataset.tab));
        });
        
        // Control bar buttons
        elements.toggleMicBtn?.addEventListener('click', toggleMicrophone);
        elements.toggleVideoBtn?.addEventListener('click', toggleVideo);
        elements.toggleSubtitlesBtn?.addEventListener('click', toggleSubtitles);
        elements.endCallBtn?.addEventListener('click', leaveRoom);
    }

    // ========================================
    // Pre-Invite Flow (Create invite before starting)
    // ========================================
    async function createInvite() {
        showLoading('Reserving room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/reserve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.user.id })
            });
            
            const data = await response.json();
            
            if (response.status === 402 || response.status === 429) {
                hideLoading();
                const detail = data.detail || data;
                showPaywall(detail.code, detail.message);
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.detail?.message || data.detail || 'Failed to reserve room');
            }
            
            hideLoading();
            
            // Store pending room info
            state.pendingRoomCode = data.room_code;
            state.pendingMaxMinutes = data.max_minutes || 60;
            
            // Show pre-invite modal
            showPreInviteModal();
            
            // Refresh pending invites list
            loadPendingInvites();
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    function showPreInviteModal() {
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${state.pendingRoomCode}`;
        
        elements.preInviteLink.value = inviteUrl;
        elements.preInviteCode.textContent = state.pendingRoomCode;
        elements.preEmailStatus.textContent = '';
        elements.preInviteEmail.value = '';
        elements.inviteMessage.value = '';
        elements.messageCharCount.textContent = '0';
        elements.directEmailSection.style.display = 'none';
        
        // Set default date/time to now + 15 mins
        const now = new Date();
        now.setMinutes(now.getMinutes() + 15);
        elements.inviteDate.value = now.toISOString().split('T')[0];
        elements.inviteTime.value = now.toTimeString().slice(0, 5);
        
        // Show timezone
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        elements.timezoneDisplay.textContent = `Timezone: ${tz}`;
        
        elements.preInviteModal.style.display = 'flex';
    }

    function hidePreInviteModal() {
        elements.preInviteModal.style.display = 'none';
    }
    
    function getScheduledDateTime() {
        const date = elements.inviteDate?.value;
        const time = elements.inviteTime?.value;
        
        if (date && time) {
            return new Date(`${date}T${time}`);
        }
        return new Date(); // Now if not scheduled
    }
    
    function getInviteMessage() {
        return elements.inviteMessage?.value?.trim() || '';
    }
    
    function buildShareText() {
        const roomCode = state.pendingRoomCode;
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${roomCode}`;
        const message = getInviteMessage();
        const scheduled = getScheduledDateTime();
        const hostName = state.user?.name || 'Someone';
        
        let text = message ? `${message}\n\n` : `${hostName} invited you to a translation room!\n\n`;
        
        // Add scheduled time if set
        const dateVal = elements.inviteDate?.value;
        const timeVal = elements.inviteTime?.value;
        if (dateVal && timeVal) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
            text += `📅 ${scheduled.toLocaleDateString('en-US', options)}\n\n`;
        }
        
        text += `🔗 Join here: ${inviteUrl}\n`;
        text += `📝 Room Code: ${roomCode}\n\n`;
        text += `No signup required!`;
        
        return text;
    }
    
    function shareVia(platform) {
        const text = buildShareText();
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${state.pendingRoomCode}`;
        const encodedText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(inviteUrl);
        
        let shareUrl = '';
        
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodedText}`;
                break;
            case 'sms':
                // Works on mobile, opens default SMS app
                shareUrl = `sms:?body=${encodedText}`;
                break;
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text.replace(inviteUrl, '').trim())}`;
                break;
            case 'email':
                const subject = encodeURIComponent(`${state.user?.name || 'Someone'} invited you to Mamnoon.ai`);
                shareUrl = `mailto:?subject=${subject}&body=${encodedText}`;
                break;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank');
        }
    }

    function copyPreInviteLink() {
        const link = elements.preInviteLink.value;
        navigator.clipboard.writeText(link).then(() => {
            showNotification('Invite link copied!', 'success');
            elements.copyPreInviteLink.textContent = 'Copied!';
            setTimeout(() => {
                elements.copyPreInviteLink.textContent = 'Copy';
            }, 2000);
        });
    }

    async function sendPreInviteEmail() {
        const email = elements.preInviteEmail.value.trim();
        
        if (!email || !email.includes('@')) {
            elements.preEmailStatus.textContent = 'Please enter a valid email';
            elements.preEmailStatus.className = 'email-status error';
            return;
        }
        
        elements.preEmailStatus.textContent = 'Sending...';
        elements.preEmailStatus.className = 'email-status sending';
        elements.preSendEmailInvite.disabled = true;
        
        try {
            const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
            const inviteUrl = `${baseUrl}join.html?code=${state.pendingRoomCode}`;
            const message = getInviteMessage();
            const scheduledDate = getScheduledDateTime();
            
            const response = await fetch(`${CONFIG.API_BASE}/api/invite/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_email: email,
                    room_code: state.pendingRoomCode,
                    host_name: state.user.name || 'Someone',
                    invite_url: inviteUrl,
                    message: message || null,
                    scheduled_time: scheduledDate.toISOString()
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.copy_link) {
                    elements.preEmailStatus.innerHTML = `📋 Share link with <strong>${email}</strong>: <a href="#" onclick="document.getElementById('copyPreInviteLink').click(); return false;">Copy Link</a>`;
                } else {
                    elements.preEmailStatus.textContent = `✓ Invite sent to ${email}`;
                    elements.preInviteEmail.value = '';
                }
                elements.preEmailStatus.className = 'email-status success';
            } else {
                throw new Error(data.detail || 'Failed to send');
            }
        } catch (error) {
            elements.preEmailStatus.textContent = 'Failed to send. Copy the link instead.';
            elements.preEmailStatus.className = 'email-status error';
        }
        
        elements.preSendEmailInvite.disabled = false;
    }

    async function startReservedRoom() {
        showLoading('Starting room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/start/${state.pendingRoomCode}?user_id=${state.user.id}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Failed to start room');
            }
            
            hideLoading();
            hidePreInviteModal();
            
            // Store room info
            state.roomCode = data.room_code;
            state.sessionId = data.session_id;
            state.maxMinutes = data.max_minutes || 60;
            state.pendingRoomCode = null;
            
            // Request notification permission
            requestNotificationPermission();
            
            // Connect WebSocket
            connectWebSocket(data.video_url);
            
            // Refresh pending invites
            loadPendingInvites();
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    async function loadPendingInvites() {
        if (state.user.isGuest) return;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/pending/${state.user.id}`);
            const data = await response.json();
            
            state.pendingInvites = data.pending || [];
            displayPendingInvites();
        } catch (error) {
            console.error('Failed to load pending invites:', error);
        }
    }

    function displayPendingInvites() {
        if (!state.pendingInvites || state.pendingInvites.length === 0) {
            elements.pendingInvitesSection.style.display = 'none';
            return;
        }
        
        elements.pendingInvitesSection.style.display = 'block';
        
        const html = state.pendingInvites.map(invite => {
            const created = new Date(invite.created_at);
            const timeAgo = getTimeAgo(created);
            
            return `
                <div class="pending-invite-item">
                    <div class="pending-invite-info">
                        <span class="pending-invite-code">${invite.room_code}</span>
                        <span class="pending-invite-time">${timeAgo}</span>
                    </div>
                    <div class="pending-invite-actions">
                        <button class="btn btn-primary btn-sm" onclick="startPendingRoom('${invite.room_code}')">Start</button>
                        <button class="btn btn-ghost btn-sm" onclick="cancelPendingInvite('${invite.room_code}')">Cancel</button>
                    </div>
                </div>
            `;
        }).join('');
        
        elements.pendingInvitesList.innerHTML = html;
    }

    // Global functions for pending invites
    window.startPendingRoom = async function(roomCode) {
        state.pendingRoomCode = roomCode;
        await startReservedRoom();
    };

    window.cancelPendingInvite = async function(roomCode) {
        const confirmed = await showConfirm({
            title: 'Cancel Invite?',
            message: 'This will cancel the pending invite and release the room code.',
            icon: '🗑️',
            confirmText: 'Cancel Invite',
            cancelText: 'Keep It'
        });
        
        if (!confirmed) return;
        
        try {
            await fetch(`${CONFIG.API_BASE}/api/room/pending/${roomCode}?user_id=${state.user.id}`, {
                method: 'DELETE'
            });
            showNotification('Invite cancelled', 'success');
            loadPendingInvites();
        } catch (error) {
            showNotification('Failed to cancel', 'error');
        }
    };

    // ========================================
    // Personal Room Functions
    // ========================================
    async function loadPersonalRoom() {
        if (state.user.isGuest) return;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/personal-room/${state.user.id}`);
            const data = await response.json();
            
            if (data.has_personal_room) {
                state.hasPersonalRoom = true;
                state.personalRoomCode = data.room_code;
                
                // Show personal room card
                const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
                const roomLink = `${baseUrl}join.html?code=${data.room_code}`;
                
                elements.dashboardPersonalLink.value = roomLink;
                elements.personalRoomCard.style.display = 'block';
            } else {
                state.hasPersonalRoom = false;
                elements.personalRoomCard.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load personal room:', error);
            elements.personalRoomCard.style.display = 'none';
        }
    }

    async function startPersonalRoomSession() {
        if (!state.personalRoomCode) {
            showNotification('No personal room configured', 'error');
            return;
        }
        
        showLoading('Starting your room...');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/personal-room/start/${state.user.id}`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail?.message || data.detail || 'Failed to start room');
            }
            
            hideLoading();
            
            // Store room info
            state.roomCode = data.room_code;
            state.sessionId = data.session_id;
            state.maxMinutes = data.max_minutes || 60;
            
            // Request notification permission
            requestNotificationPermission();
            
            // Connect WebSocket
            connectWebSocket(data.video_url);
            
        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    // ========================================
    // Room Creation (Quick Start)
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

    async function leaveRoom() {
        const confirmed = await showConfirm({
            title: 'Leave Room?',
            message: 'You will disconnect from the translation session.',
            icon: '🚪',
            confirmText: 'Leave',
            cancelText: 'Stay',
            danger: false
        });
        
        if (confirmed) {
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

    function downloadCalendarFile(roomCode = null) {
        const code = roomCode || state.roomCode;
        const maxMins = roomCode ? (state.pendingMaxMinutes || 60) : state.maxMinutes;
        const message = getInviteMessage();
        
        // Use scheduled time if available, otherwise now
        const isPending = roomCode === state.pendingRoomCode;
        const start = isPending ? getScheduledDateTime() : new Date();
        const end = new Date(start.getTime() + maxMins * 60000);
        
        const formatDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${code}`;
        
        let description = message ? `${message}\\n\\n` : '';
        description += `Join the real-time translation room:\\n\\nRoom Code: ${code}\\n\\nClick to join: ${inviteUrl}\\n\\nNo signup required for guests.`;
        
        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mamnoon.ai//Translation Room//EN
BEGIN:VEVENT
UID:${code}@mamnoon.ai
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:Mamnoon.ai Translation Room
DESCRIPTION:${description}
URL:${inviteUrl}
LOCATION:${inviteUrl}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mamnoon-room-${code}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Calendar file downloaded!', 'success');
    }

    function openGoogleCalendar(roomCode = null) {
        const code = roomCode || state.roomCode;
        const maxMins = roomCode ? (state.pendingMaxMinutes || 60) : state.maxMinutes;
        const message = getInviteMessage();
        
        // Use scheduled time if available, otherwise now
        const isPending = roomCode === state.pendingRoomCode;
        const start = isPending ? getScheduledDateTime() : new Date();
        const end = new Date(start.getTime() + maxMins * 60000);
        
        const formatGoogleDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        
        const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
        const inviteUrl = `${baseUrl}join.html?code=${code}`;
        
        let details = message ? `${message}\n\n` : '';
        details += `Join the real-time translation room:\n\nRoom Code: ${code}\n\nClick to join: ${inviteUrl}\n\nNo signup required for guests.`;
        
        const title = encodeURIComponent('Mamnoon.ai Translation Room');
        const encodedDetails = encodeURIComponent(details);
        const location = encodeURIComponent(inviteUrl);
        const dates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
        
        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${encodedDetails}&location=${location}&dates=${dates}`;
        
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
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.copy_link) {
                    // Email service not available - prompt to copy link
                    elements.emailStatus.innerHTML = `📋 Share this link with <strong>${email}</strong>: <a href="#" onclick="document.getElementById('copyInviteLink').click(); return false;">Copy Link</a>`;
                    elements.emailStatus.className = 'email-status success';
                } else {
                    elements.emailStatus.textContent = `✓ Invite sent to ${email}`;
                    elements.emailStatus.className = 'email-status success';
                    elements.inviteEmail.value = '';
                }
            } else {
                throw new Error(data.detail || 'Failed to send');
            }
        } catch (error) {
            elements.emailStatus.textContent = 'Failed to send. Copy the link instead.';
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
        
        // Initialize participants with self
        state.participants.set(state.user.id, {
            name: state.user.name || 'You',
            language: state.myLanguage,
            isMuted: false,
            isSpeaking: false,
            isHost: !state.user.isGuest
        });
        updateParticipantsUI();
        
        elements.messageInput.focus();
    }
    
    // ========================================
    // Multi-Party UI Functions
    // ========================================
    
    function switchSidebarTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.sidebar-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        // Update panels
        if (elements.participantsPanel) {
            elements.participantsPanel.classList.toggle('active', tab === 'participants');
        }
        if (elements.chatPanel) {
            elements.chatPanel.classList.toggle('active', tab === 'chat');
        }
        
        // Clear unread badge when switching to chat
        if (tab === 'chat' && elements.unreadBadge) {
            elements.unreadBadge.style.display = 'none';
        }
    }
    
    function updateParticipantsUI() {
        const count = state.participants.size;
        
        // Update counts
        if (elements.participantCount) {
            elements.participantCount.querySelector('.count-value').textContent = count;
        }
        if (elements.tabParticipantCount) {
            elements.tabParticipantCount.textContent = count;
        }
        
        // Update video grid class
        if (elements.videoGrid) {
            elements.videoGrid.className = `video-grid participants-${Math.min(count, 9)}`;
        }
        
        // Check if current user is host
        const selfParticipant = state.participants.get(state.user.id);
        const isHost = selfParticipant?.isHost || false;
        
        // Update participants list
        if (elements.participantsList) {
            const html = Array.from(state.participants.entries()).map(([id, p]) => {
                const initials = (p.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                const lang = LANGUAGES[p.language] || { name: p.language, flag: '🌐' };
                const isMe = id === state.user.id;
                const showControls = isHost && !isMe;
                
                return `
                    <div class="participant-item ${p.isSpeaking ? 'speaking' : ''}" data-id="${id}">
                        <div class="participant-avatar">${initials}</div>
                        <div class="participant-info">
                            <div class="participant-name">
                                ${escapeHtml(p.name)}${isMe ? ' (You)' : ''}
                                ${p.isHost ? '<span class="host-badge">Host</span>' : ''}
                            </div>
                            <div class="participant-lang">${lang.flag} ${lang.name}</div>
                        </div>
                        <div class="participant-status">
                            ${p.isMuted ? '<span class="muted" title="Muted">🔇</span>' : '<span title="Mic on">🎤</span>'}
                            ${p.isSpeaking ? '<span class="speaking-indicator" title="Speaking">🔊</span>' : ''}
                        </div>
                        ${showControls ? `
                            <div class="participant-controls">
                                <button class="participant-control-btn" onclick="muteParticipant('${id}')" title="${p.isMuted ? 'Unmute' : 'Mute'}">
                                    ${p.isMuted ? '🔊' : '🔇'}
                                </button>
                                <button class="participant-control-btn danger" onclick="removeParticipant('${id}', '${escapeHtml(p.name)}')" title="Remove">
                                    ✕
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
            elements.participantsList.innerHTML = html;
        }
        
        // Show/hide host controls panel
        updateHostControlsVisibility(isHost);
    }
    
    function markSpeaking(identifier) {
        // Find participant by id or name
        let found = false;
        for (const [id, p] of state.participants) {
            if (id === identifier || p.name === identifier) {
                p.isSpeaking = true;
                found = true;
                
                // Clear speaking after 2 seconds
                setTimeout(() => {
                    p.isSpeaking = false;
                    updateParticipantsUI();
                }, 2000);
                break;
            }
        }
        
        if (found) {
            updateParticipantsUI();
        }
    }
    
    function toggleMicrophone() {
        const btn = elements.toggleMicBtn;
        if (!btn) return;
        
        const isMuted = btn.classList.toggle('muted');
        btn.querySelector('.control-icon').textContent = isMuted ? '🔇' : '🎤';
        btn.querySelector('.control-label').textContent = isMuted ? 'Mic Off' : 'Mic On';
        
        // Update self in participants
        const self = state.participants.get(state.user.id);
        if (self) {
            self.isMuted = isMuted;
            updateParticipantsUI();
        }
        
        // TODO: Actually mute the Daily.co mic via their API
        showNotification(isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
    }
    
    function toggleVideo() {
        const btn = elements.toggleVideoBtn;
        if (!btn) return;
        
        const isOff = btn.classList.toggle('muted');
        btn.querySelector('.control-icon').textContent = isOff ? '📷' : '📹';
        btn.querySelector('.control-label').textContent = isOff ? 'Cam Off' : 'Cam On';
        
        // TODO: Actually toggle Daily.co camera via their API
        showNotification(isOff ? 'Camera off' : 'Camera on', 'info');
    }
    
    function toggleSubtitles() {
        const btn = elements.toggleSubtitlesBtn;
        if (!btn) return;
        
        btn.classList.toggle('active');
        const isOn = btn.classList.contains('active');
        
        // Toggle subtitle overlay visibility
        if (elements.subtitleOverlay) {
            elements.subtitleOverlay.style.display = isOn ? 'block' : 'none';
        }
        
        showNotification(isOn ? 'Subtitles on' : 'Subtitles off', 'info');
    }
    
    // ========================================
    // Host Controls
    // ========================================
    
    function updateHostControlsVisibility(isHost) {
        const hostPanel = document.getElementById('hostControlsPanel');
        if (hostPanel) {
            hostPanel.style.display = isHost ? 'block' : 'none';
        }
    }
    
    // Mute a participant (host only)
    window.muteParticipant = async function(participantId) {
        const participant = state.participants.get(participantId);
        if (!participant) return;
        
        const newMuteState = !participant.isMuted;
        
        // Send to WebSocket
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'host_action',
                action: 'mute',
                target_id: participantId,
                muted: newMuteState
            }));
        }
        
        // Optimistic update
        participant.isMuted = newMuteState;
        updateParticipantsUI();
        
        showNotification(`${participant.name} ${newMuteState ? 'muted' : 'unmuted'}`, 'info');
    };
    
    // Remove a participant (host only)
    window.removeParticipant = async function(participantId, participantName) {
        const confirmed = await showConfirm({
            title: 'Remove Participant?',
            message: `Remove ${participantName} from this room? They can rejoin if they have the link.`,
            icon: '👋',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            danger: true
        });
        
        if (!confirmed) return;
        
        // Send to WebSocket
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'host_action',
                action: 'kick',
                target_id: participantId
            }));
        }
        
        // Also call API
        try {
            await fetch(`${CONFIG.API_BASE}/api/room/${state.roomCode}/kick/${participantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host_id: state.user.id })
            });
        } catch (error) {
            console.error('Kick API error:', error);
        }
        
        showNotification(`${participantName} removed from room`, 'info');
    };
    
    // Mute all participants (host only)
    window.muteAllParticipants = function() {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'host_action',
                action: 'mute_all'
            }));
        }
        
        // Update all non-host participants
        for (const [id, p] of state.participants) {
            if (id !== state.user.id) {
                p.isMuted = true;
            }
        }
        updateParticipantsUI();
        
        showNotification('All participants muted', 'info');
    };
    
    // Lock/unlock room (host only)
    window.toggleRoomLock = async function() {
        const lockBtn = document.getElementById('lockRoomBtn');
        const isLocked = lockBtn?.classList.contains('active');
        const newLockState = !isLocked;
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/${state.roomCode}/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    host_id: state.user.id,
                    locked: newLockState 
                })
            });
            
            if (response.ok) {
                if (lockBtn) {
                    lockBtn.classList.toggle('active', newLockState);
                    lockBtn.innerHTML = newLockState 
                        ? '🔒 <span>Room Locked</span>' 
                        : '🔓 <span>Lock Room</span>';
                }
                
                // Notify via WebSocket
                if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                    state.ws.send(JSON.stringify({
                        type: 'host_action',
                        action: 'lock',
                        locked: newLockState
                    }));
                }
                
                showNotification(newLockState ? 'Room locked - no new participants can join' : 'Room unlocked', 'info');
            }
        } catch (error) {
            showNotification('Failed to update room lock', 'error');
        }
    };
    
    // End meeting for everyone (host only)
    window.endMeetingForAll = async function() {
        const confirmed = await showConfirm({
            title: 'End Meeting?',
            message: 'This will disconnect all participants and end the session.',
            icon: '🚪',
            confirmText: 'End Meeting',
            cancelText: 'Cancel',
            danger: true
        });
        
        if (!confirmed) return;
        
        // Notify via WebSocket
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'host_action',
                action: 'end_meeting'
            }));
        }
        
        // End session
        disconnectRoom();
        showNotification('Meeting ended for all participants', 'info');
    };
    
    
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
                // Parse participant changes
                if (data.message.includes('joined')) {
                    const match = data.message.match(/(.+) joined/);
                    if (match) {
                        const name = match[1];
                        const id = data.user_id || 'user_' + Date.now();
                        state.participants.set(id, {
                            name: name,
                            language: data.language || 'en',
                            isMuted: false,
                            isSpeaking: false,
                            isHost: false
                        });
                        updateParticipantsUI();
                    }
                    sendNotification('Mamnoon.ai', data.message);
                }
                if (data.message.includes('left')) {
                    const match = data.message.match(/(.+) left/);
                    if (match) {
                        // Find and remove by name
                        for (const [id, p] of state.participants) {
                            if (p.name === match[1]) {
                                state.participants.delete(id);
                                break;
                            }
                        }
                        updateParticipantsUI();
                    }
                }
                break;
            case 'participants':
                // Full participant list update
                if (data.participants) {
                    state.participants.clear();
                    data.participants.forEach(p => {
                        state.participants.set(p.id, {
                            name: p.name,
                            language: p.language,
                            isMuted: p.muted || false,
                            isSpeaking: false,
                            isHost: p.is_host || false
                        });
                    });
                    updateParticipantsUI();
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
                // Mark sender as speaking briefly
                markSpeaking(data.sender_id || data.sender);
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
            case 'kicked':
                showNotification(data.message || 'You have been removed from the room', 'warning');
                disconnectRoom();
                break;
            case 'muted_by_host':
                showNotification(data.message || 'You have been muted by the host', 'info');
                // Update mic state
                const micBtn = elements.toggleMicBtn;
                if (micBtn && !micBtn.classList.contains('muted')) {
                    micBtn.classList.add('muted');
                    micBtn.querySelector('.control-icon').textContent = '🔇';
                    micBtn.querySelector('.control-label').textContent = 'Mic Off';
                }
                // Update self in participants
                const self = state.participants.get(state.user.id);
                if (self) {
                    self.isMuted = true;
                    updateParticipantsUI();
                }
                break;
            case 'room_locked':
                addSystemMessage(data.locked ? 'Room locked by host' : 'Room unlocked by host');
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
        
        // Show unread badge if chat panel is not active
        if (elements.chatPanel && !elements.chatPanel.classList.contains('active')) {
            if (elements.unreadBadge) {
                elements.unreadBadge.style.display = 'inline';
            }
        }
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
    async function logout() {
        const confirmed = await showConfirm({
            title: 'Log Out?',
            message: 'You will need to sign in again to use Mamnoon.ai.',
            icon: '👋',
            confirmText: 'Log Out',
            cancelText: 'Stay',
            danger: false
        });
        
        if (confirmed) {
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
