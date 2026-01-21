// ========================================
// App.js
// Mamnoon.ai Translator - Main Application
// With Speech Recognition & Live Subtitles
// ========================================

(function () {
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
        hasTranscriptVault: false,
        vaultIncludedInPlan: false,
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

        // Host controls state
        allMuted: false,
        roomLocked: false,

        // Active session (for rejoin)
        activeSession: null,

        // Participants tracking
        participants: new Map(), // id -> {name, language, isMuted, isSpeaking}

        // Pending action for language selection flow
        pendingAction: null, // 'createInvite', 'quickStart', 'joinRoom'

        // File sharing
        roomFiles: [],
        isUploading: false,

        // Screen sharing
        isScreenSharing: false,

        // P2P WebRTC
        useP2P: false,
        p2pReady: false,
        existingParticipants: [],

        // Video mode (set by host's tier for guests)
        videoMode: null,  // 'p2p' or 'daily' - set when joining as guest
        hostTier: null,    // Host's tier when joining as guest

        // Whiteboard
        isHost: false,
        whiteboardOpen: false
    };

    // Language names and flags for display
    const LANGUAGES = {
        'en': { name: 'English', flag: '🇺🇸' },
        'es': { name: 'Spanish', flag: '🇪🇸' },
        'fr': { name: 'French', flag: '🇫🇷' },
        'de': { name: 'German', flag: '🇩🇪' },
        'it': { name: 'Italian', flag: '🇮🇹' },
        'pt': { name: 'Portuguese', flag: '🇵🇹' },
        'pt-BR': { name: 'Portuguese (BR)', flag: '🇧🇷' },
        'zh': { name: 'Chinese', flag: '🇨🇳' },
        'zh-TW': { name: 'Chinese (TW)', flag: '🇹🇼' },
        'ja': { name: 'Japanese', flag: '🇯🇵' },
        'ko': { name: 'Korean', flag: '🇰🇷' },
        'ru': { name: 'Russian', flag: '🇷🇺' },
        'ar': { name: 'Arabic', flag: '🇸🇦' },
        'fa': { name: 'Persian', flag: '🇮🇷' },
        'hi': { name: 'Hindi', flag: '🇮🇳' },
        'nl': { name: 'Dutch', flag: '🇳🇱' },
        'pl': { name: 'Polish', flag: '🇵🇱' },
        'tr': { name: 'Turkish', flag: '🇹🇷' },
        'vi': { name: 'Vietnamese', flag: '🇻🇳' },
        'th': { name: 'Thai', flag: '🇹🇭' },
        'uk': { name: 'Ukrainian', flag: '🇺🇦' },
        'he': { name: 'Hebrew', flag: '🇮🇱' },
        'sv': { name: 'Swedish', flag: '🇸🇪' },
        'da': { name: 'Danish', flag: '🇩🇰' },
        'fi': { name: 'Finnish', flag: '🇫🇮' },
        'no': { name: 'Norwegian', flag: '🇳🇴' },
        'el': { name: 'Greek', flag: '🇬🇷' },
        'cs': { name: 'Czech', flag: '🇨🇿' },
        'ro': { name: 'Romanian', flag: '🇷🇴' },
        'hu': { name: 'Hungarian', flag: '🇭🇺' },
        'id': { name: 'Indonesian', flag: '🇮🇩' }
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

        // Create Personal Room buttons
        createPersonalRoomBtn: document.getElementById('createPersonalRoomBtn'),
        createPersonalRoomSection: document.getElementById('createPersonalRoomSection'),
        createPersonalRoomMain: document.getElementById('createPersonalRoomMain'),

        // Active session banner
        activeSessionBanner: document.getElementById('activeSessionBanner'),
        activeSessionCode: document.getElementById('activeSessionCode'),
        activeSessionTime: document.getElementById('activeSessionTime'),
        returnToRoomBtn: document.getElementById('returnToRoomBtn'),

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
        supportBtn: document.getElementById('supportBtn'),
        supportModal: document.getElementById('supportModal'),
        roomHistory: document.getElementById('roomHistory'),

        // Language selection modal
        languageModal: document.getElementById('languageModal'),
        closeLanguageModal: document.getElementById('closeLanguageModal'),
        languageModalSelect: document.getElementById('languageModalSelect'),
        confirmLanguageBtn: document.getElementById('confirmLanguageBtn'),

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
        shareTelegram: document.getElementById('shareTelegram'),

        // Personal room elements
        personalRoomCard: document.getElementById('personalRoomCard'),
        dashboardPersonalLink: document.getElementById('dashboardPersonalLink'),
        copyDashboardLink: document.getElementById('copyDashboardLink'),
        startPersonalRoom: document.getElementById('startPersonalRoom'),
        deletePersonalRoom: document.getElementById('deletePersonalRoom'),

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
        toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
        startVoiceBtn: document.getElementById('startVoiceBtn'),
        endCallBtn: document.getElementById('endCallBtn'),
        unreadBadge: document.getElementById('unreadBadge'),
        transcriptBtn: document.getElementById('transcriptBtn'),
        transcriptMenu: document.getElementById('transcriptMenu'),
        downloadTranscriptTxt: document.getElementById('downloadTranscriptTxt'),
        downloadTranscriptJson: document.getElementById('downloadTranscriptJson'),

        // Speech elements
        subtitleOverlay: null,

        // Files panel elements
        filesTab: document.getElementById('filesTab'),
        filesPanel: document.getElementById('filesPanel'),
        fileInput: document.getElementById('fileInput'),
        uploadDropzone: document.getElementById('uploadDropzone'),
        selectFileBtn: document.getElementById('selectFileBtn'),
        uploadProgress: document.getElementById('uploadProgress'),
        uploadProgressFill: document.getElementById('uploadProgressFill'),
        uploadProgressText: document.getElementById('uploadProgressText'),
        filesList: document.getElementById('filesList'),
        tabFilesCount: document.getElementById('tabFilesCount'),
        maxFileSizeText: document.getElementById('maxFileSizeText'),

        // Screen share
        toggleScreenShareBtn: document.getElementById('toggleScreenShareBtn')
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

        // Display user info - extract first name from full_name if available
        const displayName = state.user.name
            ? state.user.name.split(' ')[0]  // First name from "John Doe"
            : state.user.email.split('@')[0];
        elements.userName.textContent = displayName;

        // Load profile and usage
        await loadProfile();

        // Check vault status
        await checkVaultStatus();

        // Load vault transcripts
        loadVaultTranscripts();

        // Check for active session first
        await checkActiveSession();

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

        // Initialize vault UI
        initResizableSidebar();

        // Vault refresh button
        const refreshBtn = document.getElementById('vaultRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.classList.add('spinning');
                loadVaultTranscripts().finally(() => {
                    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
                });
            });
        }

        // Close preview on overlay click
        const overlay = document.getElementById('transcriptPreviewOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeTranscriptPreview();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('transcriptPreviewOverlay')?.classList.contains('open')) {
                closeTranscriptPreview();
            }
        });

        // Check if we should auto-start personal room (urlParams already declared above)
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

            // Store video mode from host's tier (so guest uses same video system)
            state.videoMode = data.video_mode || 'p2p';  // 'p2p' or 'daily'
            state.hostTier = data.host_tier || 'trial';
            console.log(`🎥 Guest joining with video mode: ${state.videoMode} (host tier: ${state.hostTier})`);

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
    // Speech Recognition Setup (Azure Speech SDK)
    // Works on ALL browsers!
    // ========================================
    async function initSpeechRecognition() {
        // Azure Speech works on all browsers - always supported
        state.speechSupported = true;
        state.azureSpeechToken = null;
        state.azureSpeechRegion = null;
        state.recognizer = null;

        console.log('✅ Azure Speech recognition ready (works on all browsers)');
    }

    async function getAzureSpeechToken() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/speech/token`);
            if (!response.ok) {
                throw new Error('Failed to get speech token');
            }
            const data = await response.json();
            state.azureSpeechToken = data.token;
            state.azureSpeechRegion = data.region;
            return true;
        } catch (error) {
            console.error('❌ Failed to get Azure speech token:', error);
            showNotification('Speech service unavailable', 'error');
            return false;
        }
    }

    async function startAzureRecognition() {
        // Get fresh token
        if (!await getAzureSpeechToken()) {
            return false;
        }

        try {
            // Create speech config with token
            const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
                state.azureSpeechToken,
                state.azureSpeechRegion
            );

            // Set recognition language
            const langMap = {
                'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
                'it': 'it-IT', 'pt': 'pt-PT', 'pt-BR': 'pt-BR', 'zh': 'zh-CN',
                'zh-TW': 'zh-TW', 'ja': 'ja-JP', 'ko': 'ko-KR', 'ru': 'ru-RU',
                'ar': 'ar-SA', 'hi': 'hi-IN', 'bn': 'bn-IN', 'pa': 'pa-IN',
                'ta': 'ta-IN', 'te': 'te-IN', 'mr': 'mr-IN', 'gu': 'gu-IN',
                'ur': 'ur-PK', 'tr': 'tr-TR', 'nl': 'nl-NL', 'pl': 'pl-PL',
                'uk': 'uk-UA', 'cs': 'cs-CZ', 'sk': 'sk-SK', 'hu': 'hu-HU',
                'ro': 'ro-RO', 'bg': 'bg-BG', 'hr': 'hr-HR', 'sr': 'sr-RS',
                'sl': 'sl-SI', 'el': 'el-GR', 'he': 'he-IL', 'vi': 'vi-VN',
                'th': 'th-TH', 'id': 'id-ID', 'ms': 'ms-MY', 'tl': 'fil-PH',
                'fa': 'fa-IR', 'sw': 'sw-KE', 'af': 'af-ZA', 'da': 'da-DK',
                'sv': 'sv-SE', 'no': 'nb-NO', 'fi': 'fi-FI', 'et': 'et-EE',
                'lv': 'lv-LV', 'lt': 'lt-LT', 'ca': 'ca-ES', 'eu': 'eu-ES',
                'gl': 'gl-ES'
            };
            speechConfig.speechRecognitionLanguage = langMap[state.myLanguage] || 'en-US';

            // Create audio config from microphone
            const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

            // Create recognizer
            state.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

            // Handle interim results (while speaking)
            state.recognizer.recognizing = (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
                    showInterimSubtitle(e.result.text);
                }
            };

            // Handle final results
            state.recognizer.recognized = (s, e) => {
                if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    const text = e.result.text.trim();
                    if (text) {
                        console.log('🎤 Recognized:', text);
                        sendSpeechMessage(text);
                        hideInterimSubtitle();
                    }
                } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
                    console.log('⚠️ No speech recognized');
                }
            };

            // Handle errors
            state.recognizer.canceled = (s, e) => {
                console.error('❌ Speech canceled:', e.reason);
                if (e.reason === SpeechSDK.CancellationReason.Error) {
                    console.error('Error details:', e.errorDetails);
                    showNotification('Speech recognition error. Please try again.', 'error');
                }
                stopListening();
            };

            // Handle session stopped
            state.recognizer.sessionStopped = (s, e) => {
                console.log('🎤 Session stopped');
                // Auto-restart if still supposed to be listening
                if (state.isListening && state.connected) {
                    setTimeout(() => startAzureRecognition(), 500);
                }
            };

            // Start continuous recognition
            await state.recognizer.startContinuousRecognitionAsync();

            console.log('🎤 Azure Speech recognition started');
            state.isListening = true;
            updateMicButton();
            return true;

        } catch (error) {
            console.error('❌ Failed to start Azure speech:', error);
            showNotification('Failed to start voice recognition', 'error');
            return false;
        }
    }

    async function stopAzureRecognition() {
        if (state.recognizer) {
            try {
                await state.recognizer.stopContinuousRecognitionAsync();
                state.recognizer.close();
                state.recognizer = null;
            } catch (e) {
                console.log('Stop recognition error:', e);
            }
        }
        state.isListening = false;
        hideInterimSubtitle();
        updateMicButton();
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

    async function startListening() {
        if (!state.connected) {
            showNotification('Join a room first to use voice', 'warning');
            return;
        }

        if (state.isListening) {
            return;
        }

        showNotification('Starting voice recognition...', 'info');

        // Check if Azure Speech SDK is loaded
        if (typeof SpeechSDK === 'undefined') {
            showNotification('Loading speech engine...', 'info');
            await loadAzureSpeechSDK();
        }

        await startAzureRecognition();
    }

    async function stopListening() {
        await stopAzureRecognition();
    }

    async function toggleListening() {
        if (state.isListening) {
            await stopListening();
        } else {
            await startListening();
        }
    }

    // Load Azure Speech SDK dynamically
    function loadAzureSpeechSDK() {
        return new Promise((resolve, reject) => {
            if (typeof SpeechSDK !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://aka.ms/csspeech/jsbrowserpackageraw';
            script.onload = () => {
                console.log('✅ Azure Speech SDK loaded');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load Azure Speech SDK'));
            };
            document.head.appendChild(script);
        });
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
        const btn = elements.startVoiceBtn;
        if (!btn) return;

        if (state.isListening) {
            btn.classList.add('active');
            btn.querySelector('.control-icon').textContent = '🎤';
            btn.querySelector('.control-label').textContent = 'Listening...';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.control-icon').textContent = '🎤';
            btn.querySelector('.control-label').textContent = 'Start Speaking';
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

        // Create clean subtitle element - only show translated text
        const subtitle = document.createElement('div');
        subtitle.className = 'subtitle-text received';
        subtitle.innerHTML = `
            <div class="subtitle-sender">${langInfo.flag} ${escapeHtml(sender)}</div>
            <div class="subtitle-main">${escapeHtml(text)}</div>
        `;

        // Clear old subtitles and show new one
        elements.subtitleOverlay.innerHTML = '';
        elements.subtitleOverlay.appendChild(subtitle);
        elements.subtitleOverlay.style.display = 'block';

        // Auto-hide after 6 seconds
        setTimeout(() => {
            if (subtitle.parentNode === elements.subtitleOverlay) {
                subtitle.classList.add('fade-out');
                setTimeout(() => subtitle.remove(), 500);
            }
        }, 6000);
    }

    // ========================================
    // Profile & Usage
    // ========================================
    async function loadProfile() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/profile/${state.user.id}`);
            if (response.ok) {
                const data = await response.json();
                console.log('👤 Profile loaded:', data);
                state.profile = data.profile || {};

                // Update UI
                updatePlanDisplay(data);

                // Store profile
                localStorage.setItem('profile', JSON.stringify(state.profile));
            } else {
                console.error('❌ Profile load failed:', response.status);
                // FIXED: Default to trial tier when profile doesn't exist
                state.profile = { tier: 'trial' };
                state.tier = 'trial';
                updatePlanDisplay({ profile: { tier: 'trial' }, usage: {}, limits: {} });
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            // FIXED: Default to trial tier on error
            state.profile = { tier: 'trial' };
            state.tier = 'trial';
            updatePlanDisplay({ profile: { tier: 'trial' }, usage: {}, limits: {} });
        }
    }

    function updatePlanDisplay(data) {
        const tier = data.profile?.tier || 'trial';
        const tierLabels = {
            'trial': 'Free Trial',
            'starter': 'Starter',
            'professional': 'Professional',
            'business': 'Business',
            'enterprise': 'Enterprise'
        };

        // Store tier in state for feature checks
        state.tier = tier;

        // FIXED: Update username display with first name from profile
        const fullName = data.profile?.full_name;
        if (fullName && elements.userName) {
            // Extract first name (e.g., "John Doe" -> "John")
            const firstName = fullName.split(' ')[0];
            elements.userName.textContent = firstName;
            // Also update state.user.name for consistency
            state.user.name = fullName;
        }

        elements.userTier.textContent = tierLabels[tier] || tier;
        elements.userTier.className = `user-tier tier-${tier}`;
        elements.currentPlan.textContent = tierLabels[tier] || tier;

        // Hide Create Invite for trial and starter
        const inviteAllowedTiers = ['professional', 'business', 'enterprise'];
        if (elements.createInviteBtn) {
            if (inviteAllowedTiers.includes(tier)) {
                elements.createInviteBtn.style.display = 'inline-flex';
            } else {
                elements.createInviteBtn.style.display = 'none';
            }
        }

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

        // Update file sharing and screen share UI based on tier
        updateFileSharingUI();
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

            // Add rejoin/end buttons for active sessions
            const actionBtns = isActive ? `
                <button class="rejoin-session-btn" onclick="rejoinFromHistory('${session.room_code}', '${session.id}')" title="Rejoin room">
                    ↩️
                </button>
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
                        ${actionBtns}
                    </div>
                </div>
            `;
        }).join('');

        elements.roomHistory.innerHTML = html;
    }

    window.disconnectRoom = disconnectRoom;
    // Rejoin from history
    window.rejoinFromHistory = async function (roomCode, sessionId) {
        rejoinActiveSession({
            room_code: roomCode,
            session_id: sessionId,
            remaining_minutes: 60
        });
    };

    // End stuck session (kill switch)
    window.endStuckSession = async function (sessionId, roomCode) {
        const confirmed = await showConfirm({
            title: 'End Session?',
            message: `This will end session ${roomCode} and free up your room slot.`,
            icon: '🔴',
            confirmText: 'End Session',
            cancelText: 'Keep Active'
        });

        if (!confirmed) return;

        try {
            // Use the user's id to end session, not session id
            const response = await fetch(`${CONFIG.API_BASE}/api/session/end/${state.user.id}`, {
                method: 'POST'
            });

            if (response.ok) {
                showNotification(`Session ${roomCode} ended`, 'success');
                // Reload page to reset everything
                setTimeout(() => {
                    window.location.reload();
                }, 500);
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
        // Mobile sidebar toggle
        const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
        const mobileSidebarClose = document.getElementById('mobileSidebarClose');
        const appSidebar = document.getElementById('appSidebar');

        mobileSidebarToggle?.addEventListener('click', () => {
            appSidebar?.classList.add('mobile-open');
        });

        mobileSidebarClose?.addEventListener('click', () => {
            appSidebar?.classList.remove('mobile-open');
        });

        // Close sidebar when clicking a sidebar button on mobile
        document.querySelectorAll('.sidebar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    appSidebar?.classList.remove('mobile-open');
                }
            });
        });

        // Room creation - now shows language selection first
        elements.createInviteBtn?.addEventListener('click', () => promptLanguageThen('createInvite'));
        elements.quickStartBtn?.addEventListener('click', () => promptLanguageThen('quickStart'));
        elements.createRoomBtn?.addEventListener('click', () => promptLanguageThen('quickStart'));

        // Language modal
        elements.closeLanguageModal?.addEventListener('click', hideLanguageModal);
        elements.languageModal?.addEventListener('click', (e) => {
            if (e.target === elements.languageModal) hideLanguageModal();
        });
        elements.confirmLanguageBtn?.addEventListener('click', confirmLanguageSelection);

        // Return to active session
        elements.returnToRoomBtn?.addEventListener('click', () => {
            if (state.activeSession) {
                rejoinActiveSession(state.activeSession);
            }
        });

        // Create Personal Room buttons
        elements.createPersonalRoomBtn?.addEventListener('click', createPersonalRoom);
        elements.createPersonalRoomMain?.addEventListener('click', createPersonalRoom);

        // Room joining - also prompt for language first
        elements.joinRoomBtn?.addEventListener('click', () => promptLanguageThen('joinRoom'));
        elements.welcomeJoinBtn?.addEventListener('click', () => promptLanguageThen('joinRoom'));
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
            const newLanguage = e.target.value;
            const oldLanguage = state.myLanguage;
            state.myLanguage = newLanguage;
            console.log(`🌐 Language changed from ${oldLanguage} to: ${newLanguage}`);

            // Notify backend via WebSocket if connected
            if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({
                    type: 'language_change',
                    language: newLanguage
                }));
                console.log('🌐 Sent language change to server');
            }

            // Restart speech recognition with new language if active
            if (state.isRecording && state.speechRecognizer) {
                console.log('🎤 Restarting speech recognition with new language...');
                stopVoice();
                setTimeout(() => {
                    startVoice();
                }, 500);
            }
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

        // Support modal
        elements.supportBtn?.addEventListener('click', openSupportModal);
        document.getElementById('closeSupportModal')?.addEventListener('click', closeSupportModal);
        document.getElementById('supportForm')?.addEventListener('submit', submitSupportForm);

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
        elements.deletePersonalRoom?.addEventListener('click', deletePersonalRoomHandler);

        // Modal background click
        elements.joinModal?.addEventListener('click', (e) => {
            if (e.target === elements.joinModal) hideJoinModal();
        });
        elements.paywallModal?.addEventListener('click', (e) => {
            if (e.target === elements.paywallModal) hidePaywall();
        });

        // Pre-invite modal - close/cancel should delete the pending invite
        elements.closePreInviteModal?.addEventListener('click', cancelAndCloseInviteModal);
        elements.preInviteModal?.addEventListener('click', (e) => {
            if (e.target === elements.preInviteModal) cancelAndCloseInviteModal();
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

        // Message character count
        elements.inviteMessage?.addEventListener('input', (e) => {
            elements.messageCharCount.textContent = e.target.value.length;
        });

        // Share buttons
        elements.shareWhatsApp?.addEventListener('click', () => shareVia('whatsapp'));
        elements.shareTelegram?.addEventListener('click', () => shareVia('telegram'));

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

        // File sharing events
        elements.selectFileBtn?.addEventListener('click', () => elements.fileInput?.click());
        elements.fileInput?.addEventListener('change', handleFileSelect);
        elements.uploadDropzone?.addEventListener('dragover', handleDragOver);
        elements.uploadDropzone?.addEventListener('dragleave', handleDragLeave);
        elements.uploadDropzone?.addEventListener('drop', handleFileDrop);
        elements.uploadDropzone?.addEventListener('click', (e) => {
            if (e.target !== elements.selectFileBtn) elements.fileInput?.click();
        });

        // Screen share
        elements.toggleScreenShareBtn?.addEventListener('click', toggleScreenShare);

        // Control bar buttons
        elements.startVoiceBtn?.addEventListener('click', toggleListening);
        elements.toggleFullscreenBtn?.addEventListener('click', toggleFullscreen);
        elements.endCallBtn?.addEventListener('click', leaveRoom);

        // Transcript dropdown
        elements.transcriptBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.transcriptMenu?.classList.toggle('show');
        });
        elements.downloadTranscriptTxt?.addEventListener('click', () => downloadTranscript('txt'));
        elements.downloadTranscriptJson?.addEventListener('click', () => downloadTranscript('json'));
        document.addEventListener('click', () => {
            elements.transcriptMenu?.classList.remove('show');
        });
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

    // Cancel and close invite modal - deletes the pending room reservation
    async function cancelAndCloseInviteModal() {
        if (state.pendingRoomCode) {
            // Delete the pending reservation
            try {
                await fetch(`${CONFIG.API_BASE}/api/room/pending/${state.pendingRoomCode}?user_id=${state.user.id}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.log('Failed to cancel reservation:', error);
            }
            state.pendingRoomCode = null;
        }
        hidePreInviteModal();
        loadPendingInvites();
    }

    // ========================================
    // Language Selection Flow
    // ========================================
    function promptLanguageThen(action) {
        state.pendingAction = action;
        // Set current language in modal
        if (elements.languageModalSelect) {
            elements.languageModalSelect.value = state.myLanguage || 'en';
        }
        elements.languageModal.style.display = 'flex';
    }

    function hideLanguageModal() {
        elements.languageModal.style.display = 'none';
        state.pendingAction = null;
    }

    function confirmLanguageSelection() {
        // Save selected language
        const selectedLanguage = elements.languageModalSelect?.value || 'en';
        state.myLanguage = selectedLanguage;

        // Update sidebar selector too
        if (elements.languageSelect) {
            elements.languageSelect.value = selectedLanguage;
        }

        // Save the action before hiding (which clears pendingAction)
        const actionToExecute = state.pendingAction;

        hideLanguageModal();

        // Execute the pending action
        switch (actionToExecute) {
            case 'createInvite':
                createInvite();
                break;
            case 'quickStart':
                createRoom();
                break;
            case 'joinRoom':
                showJoinModal();
                break;
        }
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
            const hostName = state.user.name || state.user.email?.split('@')[0] || 'Someone';

            // Send via backend (Resend)
            const response = await fetch(`${CONFIG.API_BASE}/api/invite/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_email: email,
                    host_name: hostName,
                    room_code: state.pendingRoomCode,
                    invite_url: inviteUrl,
                    scheduled_time: scheduledDate.toISOString(),
                    message: message || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to send email');
            }

            showNotification(`Invite sent to ${email}! Room code: ${state.pendingRoomCode}`, 'success');

            // Close the modal after successful send
            setTimeout(() => {
                hidePreInviteModal();
                loadPendingInvites();
            }, 500);

        } catch (error) {
            console.error('Email error:', error);
            elements.preEmailStatus.innerHTML = `Failed: ${error.message}. <a href="#" onclick="document.getElementById('copyPreInviteLink').click(); return false;">Copy link</a> instead.`;
            elements.preEmailStatus.className = 'email-status error';
        }

        elements.preSendEmailInvite.disabled = false;
    }

    async function startReservedRoom() {
        // Clear previous session data
        state.participants.clear();
        state.transcript = [];

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
    window.startPendingRoom = async function (roomCode) {
        state.pendingRoomCode = roomCode;
        await startReservedRoom();
    };

    window.cancelPendingInvite = async function (roomCode) {
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
    // Active Session Recovery
    // ========================================
    async function checkActiveSession() {
        if (state.user.isGuest) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/session/active/${state.user.id}`);
            const data = await response.json();

            if (data.has_active_session && data.room_code) {
                // Store active session data
                state.activeSession = data;

                // Show the persistent banner
                showActiveSessionBanner(data);

                // Also show dialog on first load
                const shouldRejoin = await showConfirm({
                    title: 'Active Session Found',
                    message: `You have an active room: ${data.room_code}. Would you like to rejoin?`,
                    icon: '🔄',
                    confirmText: 'Rejoin Room',
                    cancelText: 'Stay Here'
                });

                if (shouldRejoin) {
                    rejoinActiveSession(data);
                }
                // If they click "Stay Here", banner remains visible
            } else {
                hideActiveSessionBanner();
            }
        } catch (error) {
            console.error('Failed to check active session:', error);
        }
    }

    function showActiveSessionBanner(sessionData) {
        if (!elements.activeSessionBanner) return;

        elements.activeSessionCode.textContent = sessionData.room_code;

        if (sessionData.remaining_minutes) {
            const mins = Math.floor(sessionData.remaining_minutes);
            elements.activeSessionTime.textContent = `${mins} min remaining`;
        } else {
            elements.activeSessionTime.textContent = '';
        }

        elements.activeSessionBanner.style.display = 'flex';
    }

    function hideActiveSessionBanner() {
        if (elements.activeSessionBanner) {
            elements.activeSessionBanner.style.display = 'none';
        }
        state.activeSession = null;
    }

    async function rejoinActiveSession(sessionData) {
        showLoading('Rejoining room...');

        try {
            // Clear any stale state
            state.participants.clear();
            state.transcript = [];

            // Set room info
            state.roomCode = sessionData.room_code;
            state.sessionId = sessionData.session_id;
            state.maxMinutes = sessionData.remaining_minutes || 60;

            // Hide the banner since we're rejoining
            hideActiveSessionBanner();

            // Get video URL
            const response = await fetch(`${CONFIG.API_BASE}/api/room/${sessionData.room_code}/rejoin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.user.id })
            });

            const data = await response.json();

            hideLoading();

            if (response.ok && data.video_url) {
                connectWebSocket(data.video_url);
            } else {
                showNotification('Could not rejoin room', 'error');
                // Re-show banner if rejoin failed
                if (sessionData) showActiveSessionBanner(sessionData);
            }
        } catch (error) {
            hideLoading();
            showNotification('Failed to rejoin', 'error');
        }
    }

    // ========================================
    // Personal Room Functions
    // ========================================
    async function loadPersonalRoom() {
        if (state.user.isGuest) return;

        try {
            console.log('🔗 Loading personal room for user:', state.user.id);
            const response = await fetch(`${CONFIG.API_BASE}/api/personal-room/${state.user.id}`);

            // FIXED: Handle API errors (404, 500, etc.) - hide premium features
            if (!response.ok) {
                console.log('🔗 Personal room API error:', response.status, '- hiding premium features');
                state.hasPersonalRoom = false;
                hideCreatePersonalRoomButtons();
                if (elements.personalRoomCard) {
                    elements.personalRoomCard.style.display = 'none';
                }
                return;
            }

            const data = await response.json();
            console.log('🔗 Personal room response:', data);

            if (data.has_personal_room) {
                state.hasPersonalRoom = true;
                state.personalRoomCode = data.room_code;

                // Show personal room card in sidebar
                const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
                const roomLink = `${baseUrl}join.html?code=${data.room_code}`;

                if (elements.dashboardPersonalLink) {
                    elements.dashboardPersonalLink.value = roomLink;
                }
                if (elements.personalRoomCard) {
                    elements.personalRoomCard.style.display = 'block';
                    console.log('🔗 Showing personal room card');
                }

                // Hide create buttons since room exists
                hideCreatePersonalRoomButtons();

            } else if (data.upgrade_required === false) {
                // FIXED: Explicit check - User is on paid plan (Business/Enterprise) but doesn't have a personal room
                // Show the "Create My Meeting Room" buttons
                console.log('🔗 User can create personal room, showing buttons');
                state.hasPersonalRoom = false;
                showCreatePersonalRoomButtons();

                if (elements.personalRoomCard) {
                    elements.personalRoomCard.style.display = 'none';
                }
            } else {
                // User is on trial/starter/professional OR upgrade_required is true - hide everything
                console.log('🔗 Upgrade required for personal room (upgrade_required:', data.upgrade_required, ')');
                state.hasPersonalRoom = false;
                hideCreatePersonalRoomButtons();
                if (elements.personalRoomCard) {
                    elements.personalRoomCard.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to load personal room:', error);
            hideCreatePersonalRoomButtons();
            if (elements.personalRoomCard) {
                elements.personalRoomCard.style.display = 'none';
            }
        }
    }

    function showCreatePersonalRoomButtons() {
        if (elements.createPersonalRoomBtn) {
            elements.createPersonalRoomBtn.style.display = 'flex';
        }
        if (elements.createPersonalRoomSection) {
            elements.createPersonalRoomSection.style.display = 'block';
        }
    }

    function hideCreatePersonalRoomButtons() {
        if (elements.createPersonalRoomBtn) {
            elements.createPersonalRoomBtn.style.display = 'none';
        }
        if (elements.createPersonalRoomSection) {
            elements.createPersonalRoomSection.style.display = 'none';
        }
    }

    async function createPersonalRoom() {
        showLoading('Creating your meeting room...');

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/personal-room/create/${state.user.id}`, {
                method: 'POST'
            });

            hideLoading();

            if (response.ok) {
                const data = await response.json();
                state.hasPersonalRoom = true;
                state.personalRoomCode = data.room_code;

                const baseUrl = window.location.origin + window.location.pathname.replace('app.html', '');
                const roomLink = `${baseUrl}join.html?code=${data.room_code}`;

                if (elements.dashboardPersonalLink) {
                    elements.dashboardPersonalLink.value = roomLink;
                }
                if (elements.personalRoomCard) {
                    elements.personalRoomCard.style.display = 'block';
                }

                // Hide create buttons now that room exists
                hideCreatePersonalRoomButtons();

                showNotification('Personal meeting room created!', 'success');
            } else {
                const errData = await response.json();
                showNotification(errData.detail?.message || 'Failed to create room', 'error');
            }
        } catch (error) {
            hideLoading();
            console.error('Failed to create personal room:', error);
            showNotification('Failed to create room', 'error');
        }
    }

    async function deletePersonalRoomHandler() {
        const confirmed = await showConfirm({
            title: 'Delete Personal Room?',
            message: 'This will delete your permanent meeting room link. You can create a new one anytime.',
            icon: '🗑️',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/personal-room/delete/${state.user.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                state.personalRoomCode = null;
                elements.personalRoomCard.style.display = 'none';
                showNotification('Personal room deleted', 'success');
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            showNotification('Failed to delete room', 'error');
        }
    }

    async function startPersonalRoomSession() {
        if (!state.personalRoomCode) {
            showNotification('No personal room configured', 'error');
            return;
        }

        // Clear previous session data
        state.participants.clear();
        state.transcript = [];

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

        // Clear previous session data
        state.participants.clear();
        state.transcript = [];

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

            // ============================================
            // CRITICAL FIX: Capture video_mode from API
            // This ensures guests use the same video system as the host
            // Without this, guests ignore WebRTC signals from hosts
            // ============================================
            if (data.video_mode) {
                state.videoMode = data.video_mode;
                state.hostTier = data.host_tier;
                console.log(`📹 Guest video mode set: ${data.video_mode} (host tier: ${data.host_tier})`);
            }

            connectWebSocket(data.video_url);

        } catch (error) {
            hideLoading();
            showNotification(error.message, 'error');
        }
    }

    async function leaveRoom() {
        // Show end session modal with transcript download options
        showEndSessionModal();
    }

    function disconnectRoom() {
        // Cleanup P2P WebRTC if active
        if (state.useP2P && typeof WebRTCP2P !== 'undefined') {
            WebRTCP2P.cleanup();
        }

        // Cleanup Daily SDK call
        if (typeof cleanupCall === 'function') {
            cleanupCall();
        }

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
            }).catch(() => { });
        }

        state.roomCode = null;
        state.sessionId = null;
        state.connected = false;
        state.transcript = [];
        state.useP2P = false;
        state.p2pReady = false;
        state.existingParticipants = [];
        state.videoMode = null;
        state.hostTier = null;

        // Clean reload of the page to reset everything properly
        showNotification('Session ended', 'success');
        setTimeout(() => {
            // For guests, redirect to home page instead of reload
            // This prevents auto-rejoin from URL params
            if (state.user?.isGuest) {
                window.location.href = 'index.html';
            } else {
                window.location.reload();
            }
        }, 500);
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

                    // Auto-close modal after brief delay so user sees success message
                    setTimeout(() => {
                        hideInviteModal();
                        elements.emailStatus.textContent = '';
                        elements.emailStatus.className = 'email-status';
                    }, 1500);
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

        // Also add to conversation sidebar if it's a message
        if (entry.type === 'sent' || entry.type === 'received' || entry.type === 'voice') {
            addToConversationSidebar(entry);
        }
    }

    function addToConversationSidebar(entry) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';

        const isVoice = entry.type === 'voice' || entry.isVoice;
        const icon = isVoice ? '🎤' : '💬';

        if (entry.type === 'sent') {
            messageDiv.classList.add('sent');
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-icon">${icon}</span>
                    <span class="message-sender">You</span>
                    <span class="message-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="message-text">${entry.text}</div>
            `;
        } else if (entry.type === 'received' || entry.type === 'voice') {
            messageDiv.classList.add('received');
            const displayText = entry.translatedText || entry.text;
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-icon">${icon}</span>
                    <span class="message-sender">${entry.sender || 'Unknown'}</span>
                    <span class="message-time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="message-text">${displayText}</div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Update unread badge if not on chat tab
        const chatTab = document.querySelector('.sidebar-tab[data-tab="chat"]');
        if (chatTab && !chatTab.classList.contains('active')) {
            elements.unreadBadge.style.display = 'inline';
        }
    }

    function downloadTranscript(format = 'txt') {
        if (state.transcript.length === 0) {
            showNotification('No messages to download yet', 'info');
            return;
        }

        // Close dropdown if open
        elements.transcriptMenu?.classList.remove('show');

        const now = new Date();

        if (format === 'json') {
            downloadTranscriptJSON(now);
        } else if (format === 'pdf') {
            downloadTranscriptPDF(now);
        } else {
            downloadTranscriptTXT(now);
        }
    }

    function downloadTranscriptPDF(now) {
        const dateStr = now.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Create a printable HTML document and trigger print/save as PDF
        const printWindow = window.open('', '_blank');

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Transcript - ${state.roomCode}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    color: #333;
                }
                .header { 
                    border-bottom: 2px solid #6366f1; 
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 { 
                    color: #6366f1; 
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                .meta { 
                    color: #666; 
                    font-size: 14px;
                }
                .meta span { 
                    margin-right: 20px; 
                }
                .entry { 
                    margin-bottom: 20px; 
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 3px solid #6366f1;
                }
                .entry-header { 
                    font-weight: 600; 
                    color: #6366f1;
                    margin-bottom: 8px;
                    font-size: 12px;
                }
                .original { 
                    margin-bottom: 5px;
                }
                .translated { 
                    color: #059669;
                    font-style: italic;
                }
                .label {
                    font-size: 10px;
                    color: #999;
                    text-transform: uppercase;
                }
                @media print {
                    body { padding: 20px; }
                    .entry { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🌍 Mamnoon.ai Transcript</h1>
                <div class="meta">
                    <span><strong>Room:</strong> ${state.roomCode || 'N/A'}</span>
                    <span><strong>Date:</strong> ${dateStr}</span>
                    <span><strong>Duration:</strong> ${state.startTime ? Math.floor((Date.now() - state.startTime) / 60000) : 0} min</span>
                    <span><strong>Lines:</strong> ${state.transcript.length}</span>
                </div>
            </div>
        `;

        state.transcript.forEach(entry => {
            if (entry.type === 'system') return;

            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit'
            });

            if (entry.type === 'sent') {
                html += `
                <div class="entry">
                    <div class="entry-header">${state.user.name || 'You'} · ${time}</div>
                    <div class="original">${escapeHtml(entry.text)}</div>
                </div>
                `;
            } else if (entry.type === 'received') {
                html += `
                <div class="entry">
                    <div class="entry-header">${escapeHtml(entry.sender || 'Unknown')} · ${time}</div>
                    <div class="original">
                        <span class="label">Original (${entry.senderLanguage || '?'}):</span><br>
                        ${escapeHtml(entry.originalText || '')}
                    </div>
                    <div class="translated">
                        <span class="label">Translated:</span><br>
                        ${escapeHtml(entry.translatedText || '')}
                    </div>
                </div>
                `;
            }
        });

        html += `
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();

        showNotification('PDF ready - use Print dialog to save', 'success');
    }

    function downloadTranscriptTXT(now) {
        const dateStr = now.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });

        // Get participant list
        const participants = Array.from(state.participants.values()).map(p => p.name).join(', ');

        let content = `MAMNOON.AI TRANSLATION TRANSCRIPT
================================
Room: ${state.roomCode}
Date: ${dateStr}
Time: ${timeStr}
Participants: ${participants}
================================

`;

        state.transcript.forEach(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            const icon = entry.isVoice ? '[VOICE]' : '[TEXT]';

            if (entry.type === 'system') {
                content += `[${time}] --- ${entry.message} ---\n\n`;
            } else if (entry.type === 'sent') {
                content += `[${time}] ${icon} ${state.user.name} (${entry.language?.toUpperCase() || 'EN'}):\n`;
                content += `  "${entry.text}"\n\n`;
            } else if (entry.type === 'received' || entry.type === 'voice') {
                content += `[${time}] ${icon} ${entry.sender} (${entry.senderLanguage?.toUpperCase() || '??'}):\n`;
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

        showNotification('Transcript (TXT) downloaded!', 'success');
    }

    function downloadTranscriptJSON(now) {
        // Build participant list
        const participants = [];
        state.participants.forEach((p, id) => {
            participants.push({
                id: id,
                name: p.name,
                language: p.language || 'en',
                isHost: p.isHost || false
            });
        });

        // Build messages array
        const messages = state.transcript.filter(e => e.type !== 'system').map(entry => {
            const msg = {
                timestamp: entry.timestamp,
                type: entry.isVoice ? 'voice' : 'text',
                speaker_name: entry.type === 'sent' ? state.user.name : entry.sender,
                original_language: entry.type === 'sent' ? state.myLanguage : entry.senderLanguage,
                original_text: entry.type === 'sent' ? entry.text : entry.originalText
            };

            // Add translations if available
            if (entry.translatedText) {
                msg.translations = {};
                msg.translations[state.myLanguage] = entry.translatedText;
            }

            return msg;
        });

        const jsonData = {
            session_id: state.sessionId || state.roomCode,
            room_code: state.roomCode,
            date: now.toISOString(),
            duration_minutes: state.maxMinutes ? (state.maxMinutes - Math.floor(state.remainingTime / 60)) : null,
            host: {
                id: state.user.id,
                name: state.user.name,
                language: state.myLanguage
            },
            participants: participants,
            messages: messages,
            metadata: {
                platform: 'Mamnoon.ai',
                version: CONFIG.VERSION,
                export_format: '1.0'
            }
        };

        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transcript-${state.roomCode}-${now.toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Transcript (JSON) downloaded!', 'success');
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

        // Get the EXISTING videoGrid from app.html
        const videoGrid = document.getElementById('videoGrid');

        // Clear it (removes the placeholder)
        if (videoGrid) {
            videoGrid.innerHTML = '';

            // Add subtitle overlay INSIDE the existing videoGrid
            const subtitleOverlay = document.createElement('div');
            subtitleOverlay.className = 'subtitle-overlay';
            subtitleOverlay.id = 'subtitleOverlay';
            subtitleOverlay.style.display = 'block';
            videoGrid.appendChild(subtitleOverlay);

            // Store reference immediately
            elements.subtitleOverlay = subtitleOverlay;
        }

        // Decide: P2P or Daily.co
        // For GUESTS: Use state.videoMode set by the API (based on host's tier)
        // For HOSTS: Determine from their own tier
        let useP2P;

        if (state.videoMode) {
            // Guest: use the video mode returned by the API (matches host's system)
            useP2P = state.videoMode === 'p2p' && typeof WebRTCP2P !== 'undefined';
            console.log(`🎥 Guest video mode: ${state.videoMode} (host tier: ${state.hostTier})`);
        } else {
            // Host: determine from their own profile tier
            // P2P tiers: trial, starter, payperminute (mobile app users)
            const tier = state.profile?.tier || 'trial';
            useP2P = (tier === 'trial' || tier === 'starter' || tier === 'payperminute') && typeof WebRTCP2P !== 'undefined';
            console.log(`🎥 Host video mode: ${useP2P ? 'P2P WebRTC' : 'Daily.co'} (tier: ${tier})`);
        }

        state.useP2P = useP2P;

        if (useP2P) {
            // Initialize P2P WebRTC
            initP2PVideo(videoGrid);
        } else if (videoUrl && typeof joinDailyRoom === 'function') {
            // Use Daily.co for higher tiers
            const userName = state.user.name || state.user.email?.split('@')[0] || 'Guest';
            joinDailyRoom(videoUrl, userName);
        } else if (!videoUrl && !useP2P) {
            if (videoGrid) {
                videoGrid.innerHTML = `
                <div class="video-placeholder">
                    <div class="video-placeholder-icon">📹</div>
                    <p>Video unavailable</p>
                </div>
            `;
            }
        }

        // COMPLETE STATE RESET
        state.participants.clear();
        state.transcript = [];
        state.allMuted = false;
        state.roomLocked = false;

        // Clear chat messages in sidebar
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }

        // Reset host control buttons
        const muteBtn = document.querySelector('.host-control-btn[onclick*="muteAll"]');
        if (muteBtn) {
            muteBtn.innerHTML = '🔇 <span>Mute All</span>';
        }
        const lockBtn = document.getElementById('lockRoomBtn');
        if (lockBtn) {
            lockBtn.classList.remove('active');
            lockBtn.innerHTML = '🔓 <span>Lock Room</span>';
        }

        // Initialize with self
        state.isHost = !state.user.isGuest;
        state.participants.set(state.user.id, {
            name: state.user.name || 'You',
            language: state.myLanguage,
            isMuted: false,
            isSpeaking: false,
            isHost: state.isHost
        });
        updateParticipantsUI();

        // Initialize whiteboard
        if (typeof Whiteboard !== 'undefined') {
            Whiteboard.init(state.ws, state.isHost);
            console.log('📋 Whiteboard initialized for', state.isHost ? 'host' : 'guest');
        }

        // Initialize sidebar panels - show participants by default
        if (elements.participantsPanel) {
            elements.participantsPanel.classList.add('active');
            elements.participantsPanel.style.display = '';
        }
        if (elements.chatPanel) {
            elements.chatPanel.classList.remove('active');
            elements.chatPanel.style.display = 'none';
        }
        if (elements.filesPanel) {
            elements.filesPanel.classList.remove('active');
            elements.filesPanel.style.display = 'none';
        }

        // Reset sidebar tab selection
        document.querySelectorAll('.sidebar-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === 'participants');
        });

        // Update file sharing UI based on tier (show/hide Files tab and Screen Share button)
        updateFileSharingUI();

        // Load room files if user has file sharing access
        if (canShareFiles()) {
            loadRoomFiles();
        }

        // Reset files state
        state.roomFiles = [];
        state.isScreenSharing = false;

        elements.messageInput.focus();
    }

    // Initialize P2P Video
    async function initP2PVideo(videoGrid) {
        console.log('🎥 Initializing P2P WebRTC...');

        const userName = state.user.name || state.user.email?.split('@')[0] || 'Guest';

        const initialized = await WebRTCP2P.init({
            roomCode: state.roomCode,
            userId: state.user.id,
            userName: userName,
            websocket: state.ws,
            videoGrid: videoGrid,
            onParticipantJoined: (peerId, peerName) => {
                console.log('👤 P2P participant joined:', peerName);
                if (!state.participants.has(peerId)) {
                    state.participants.set(peerId, {
                        name: peerName,
                        language: 'en',
                        isMuted: false,
                        isSpeaking: false,
                        isHost: false
                    });
                    updateParticipantsUI();
                }
            },
            onParticipantLeft: (peerId) => {
                console.log('👋 P2P participant left:', peerId);
                state.participants.delete(peerId);
                updateParticipantsUI();
            }
        });

        if (initialized) {
            state.p2pReady = true;
            console.log('✅ P2P WebRTC ready');

            // Notify server we're ready for P2P
            if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ type: 'p2p_ready' }));
            }

            // ============================================================
            // CRITICAL FIX: If there are existing participants, DON'T initiate
            // We are the JOINER - the person already in the room will initiate
            // This matches the mobile app's behavior
            // ============================================================
            if (state.existingParticipants && state.existingParticipants.length > 0) {
                const peer = state.existingParticipants[0];
                console.log('👤 Found existing peer - setting up connection (waiting for their offer):', peer.user_name);
                // Use setupConnectionWithoutOffer instead of startCall
                WebRTCP2P.setupConnectionWithoutOffer(peer.user_id, peer.user_name);
            }
        } else {
            console.error('❌ P2P WebRTC failed to initialize');
            // Fall back to showing video unavailable
            if (videoGrid) {
                videoGrid.innerHTML = `
                <div class="video-placeholder">
                    <div class="video-placeholder-icon">📹</div>
                    <p>Could not access camera/microphone</p>
                </div>
            `;
            }
        }
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
            elements.participantsPanel.style.display = tab === 'participants' ? '' : 'none';
        }
        if (elements.chatPanel) {
            elements.chatPanel.classList.toggle('active', tab === 'chat');
            elements.chatPanel.style.display = tab === 'chat' ? '' : 'none';
        }
        if (elements.filesPanel) {
            // Only show files panel if user can share files AND it's the active tab
            const showFiles = tab === 'files' && canShareFiles();
            elements.filesPanel.classList.toggle('active', showFiles);
            elements.filesPanel.style.display = showFiles ? '' : 'none';
        }

        // Clear unread badge when switching to chat
        if (tab === 'chat' && elements.unreadBadge) {
            elements.unreadBadge.style.display = 'none';
        }

        // Load files when switching to files tab
        if (tab === 'files' && state.roomCode && canShareFiles()) {
            loadRoomFiles();
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

    function toggleFullscreen() {
        const btn = elements.toggleFullscreenBtn;
        const mainArea = document.querySelector('.main-area');
        const roomContent = document.querySelector('.room-content-multiparty');

        // Check if native fullscreen is supported
        const fullscreenSupported = document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.msFullscreenEnabled;

        // Check if we're on iOS (doesn't support fullscreen API on iPhones)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isIPhone = /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        // Use pseudo-fullscreen for mobile/iOS
        if (!fullscreenSupported || isIPhone) {
            // Toggle pseudo-fullscreen class
            if (roomContent) {
                roomContent.classList.toggle('pseudo-fullscreen');
                document.body.classList.toggle('fullscreen-mode');

                if (roomContent.classList.contains('pseudo-fullscreen')) {
                    if (btn) {
                        btn.classList.add('active');
                        const label = btn.querySelector('.control-label');
                        if (label) label.textContent = 'Exit';
                    }
                    // Scroll to top to hide address bar on mobile
                    window.scrollTo(0, 1);
                } else {
                    if (btn) {
                        btn.classList.remove('active');
                        const label = btn.querySelector('.control-label');
                        if (label) label.textContent = 'Fullscreen';
                    }
                }
            }
            return;
        }

        // Native fullscreen for desktop/tablets that support it
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Enter fullscreen
            const target = mainArea || document.querySelector('.video-container') || document.documentElement;
            if (target.requestFullscreen) {
                target.requestFullscreen();
            } else if (target.webkitRequestFullscreen) {
                target.webkitRequestFullscreen();
            } else if (target.msRequestFullscreen) {
                target.msRequestFullscreen();
            }
            if (btn) {
                btn.classList.add('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Exit';
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            if (btn) {
                btn.classList.remove('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Fullscreen';
            }
        }
    }

    // Listen for fullscreen changes (e.g., user presses Escape)
    document.addEventListener('fullscreenchange', () => {
        const btn = elements.toggleFullscreenBtn;
        if (btn) {
            if (document.fullscreenElement) {
                btn.classList.add('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Exit';
            } else {
                btn.classList.remove('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Fullscreen';
            }
        }
    });

    document.addEventListener('webkitfullscreenchange', () => {
        const btn = elements.toggleFullscreenBtn;
        if (btn) {
            if (document.webkitFullscreenElement) {
                btn.classList.add('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Exit';
            } else {
                btn.classList.remove('active');
                const label = btn.querySelector('.control-label');
                if (label) label.textContent = 'Fullscreen';
            }
        }
    });

    // ========================================
    // Host Controls
    // ========================================

    function updateHostControlsVisibility(isHost) {
        const hostPanel = document.getElementById('hostControlsPanel');
        if (hostPanel) {
            // Host controls only available for Professional tier and above
            const tier = state.profile?.tier || 'trial';
            const hasHostControls = ['professional', 'business', 'enterprise'].includes(tier);

            hostPanel.style.display = (isHost && hasHostControls) ? 'block' : 'none';
        }
    }

    // Mute a participant (host only)
    window.muteParticipant = async function (participantId) {
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
    window.removeParticipant = async function (participantId, participantName) {
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

        // Also call API (may fail for ghost entries, that's ok)
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/room/${state.roomCode}/kick/${participantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host_id: state.user.id })
            });

            // If 404, it's a ghost entry - just remove locally
            if (response.status === 404) {
                console.log('Ghost participant removed locally');
            }
        } catch (error) {
            console.error('Kick API error:', error);
        }

        // Always remove from local state
        state.participants.delete(participantId);
        updateParticipantsUI();

        showNotification(`${participantName} removed from room`, 'info');
    };

    // Mute/Unmute all participants (host only)
    window.muteAllParticipants = function () {
        // Toggle the mute state
        state.allMuted = !state.allMuted;

        // Send mute request via Daily SDK (this actually mutes participants)
        if (typeof window.sendMuteAllRequest === 'function') {
            window.sendMuteAllRequest(state.allMuted);
        }

        // Also send via WebSocket for any non-Daily participants
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'host_action',
                action: state.allMuted ? 'mute_all' : 'unmute_all'
            }));
        }

        // Update all non-host participants
        for (const [id, p] of state.participants) {
            if (id !== state.user.id) {
                p.isMuted = state.allMuted;
            }
        }
        updateParticipantsUI();

        // Update button text
        const muteBtn = document.querySelector('.host-control-btn[onclick*="muteAll"]');
        if (muteBtn) {
            muteBtn.innerHTML = state.allMuted ?
                '🔊 <span>Unmute All</span>' :
                '🔇 <span>Mute All</span>';
        }

        showNotification(state.allMuted ? 'All participants muted' : 'All participants unmuted', 'info');
    };

    // Lock/unlock room (host only)
    window.toggleRoomLock = async function () {
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
    window.endMeetingForAll = async function () {
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

                // Store existing participants for P2P setup
                if (data.existing_participants) {
                    state.existingParticipants = data.existing_participants;
                    console.log('📋 Existing participants:', state.existingParticipants);

                    if (state.useP2P && state.p2pReady && state.existingParticipants.length > 0 && typeof WebRTCP2P !== 'undefined') {
                        const peer = state.existingParticipants[0];
                        console.log('👤 P2P ready, setting up connection with existing peer:', peer.user_name);
                        WebRTCP2P.setupConnectionWithoutOffer(peer.user_id, peer.user_name);
                    }
                }

                // Parse participant changes (for non-P2P mode)
                if (data.message.includes('joined') && !state.useP2P) {
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
                if (data.message.includes('left') && !state.useP2P) {
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

            // P2P: Peer joined the room
            case 'peer_joined':
                console.log('👤 Peer joined:', data.user_name);
                addSystemMessage(data.message);
                sendNotification('Mamnoon.ai', data.message);

                // Add to participants
                if (!state.participants.has(data.user_id)) {
                    state.participants.set(data.user_id, {
                        name: data.user_name,
                        language: data.language || 'en',
                        isMuted: false,
                        isSpeaking: false,
                        isHost: false
                    });
                    updateParticipantsUI();
                }

                // If P2P mode and we're ready, initiate call
                if (state.useP2P && state.p2pReady && typeof WebRTCP2P !== 'undefined') {
                    WebRTCP2P.handlePeerJoined(data.user_id, data.user_name);
                }
                break;

            // P2P: Peer left the room
            case 'peer_left':
                console.log('👋 Peer left:', data.user_name);
                addSystemMessage(data.message);

                // Remove from participants
                state.participants.delete(data.user_id);
                updateParticipantsUI();

                // If P2P mode, clean up
                if (state.useP2P && typeof WebRTCP2P !== 'undefined') {
                    WebRTCP2P.handlePeerLeft(data.user_id);
                }
                break;

            // P2P: Another peer is ready
            case 'peer_ready':
                console.log('✅ Peer ready for P2P:', data.user_name);
                if (state.useP2P && state.p2pReady && typeof WebRTCP2P !== 'undefined') {
                    // Start call if we don't have a connection yet
                    WebRTCP2P.handlePeerJoined(data.user_id, data.user_name);
                }
                break;

            // Language changed confirmation (for self)
            case 'language_changed':
                console.log('🌐 Language change confirmed:', data.language);
                showNotification(`Language changed to ${data.language.toUpperCase()}`, 'success');
                break;

            // Peer changed their language
            case 'peer_language_changed':
                console.log('🌐 Peer language changed:', data.user_name, '->', data.language);
                addSystemMessage(data.message);

                // Update participant's language in state
                if (state.participants.has(data.user_id)) {
                    const participant = state.participants.get(data.user_id);
                    participant.language = data.language;
                    state.participants.set(data.user_id, participant);
                    updateParticipantsUI();
                }
                break;

            // P2P: WebRTC signaling message
            case 'webrtc_signal':
                if (state.useP2P && typeof WebRTCP2P !== 'undefined') {
                    WebRTCP2P.handleSignal(data);
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

            // ============================================
            // WHITEBOARD SYNC
            // ============================================
            case 'whiteboard':
                console.log('📋 Whiteboard message:', data.action);

                if (data.action === 'requestState') {
                    // Someone is asking for the current whiteboard state
                    if (state.isHost && typeof Whiteboard !== 'undefined') {
                        Whiteboard.sendFullState(data.user_id);
                    }
                } else {
                    // Handle incoming whiteboard action
                    if (typeof Whiteboard !== 'undefined') {
                        Whiteboard.handleRemoteAction(data);
                    }
                }
                break;
            // ============================================

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
                // Update self in participants
                const selfMuted = state.participants.get(state.user.id);
                if (selfMuted) {
                    selfMuted.isMuted = true;
                    updateParticipantsUI();
                }
                break;
            case 'room_locked':
                addSystemMessage(data.locked ? 'Room locked by host' : 'Room unlocked by host');
                break;
            case 'error':
                showNotification(data.message, 'error');
                // Handle specific error codes
                if (data.code === 'ROOM_FULL') {
                    // Disconnect and show message
                    setTimeout(() => {
                        if (state.ws) {
                            state.ws.close();
                            state.ws = null;
                        }
                        state.connected = false;
                        // Redirect to dashboard
                        elements.welcomeState.style.display = 'block';
                        elements.roomState.style.display = 'none';
                    }, 1500);
                }
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
    // Support Modal
    // ========================================
    function openSupportModal() {
        const modal = elements.supportModal;
        if (!modal) return;

        // Pre-fill name and email if user is logged in
        const nameInput = document.getElementById('supportName');
        const emailInput = document.getElementById('supportEmail');

        if (state.user?.name && nameInput) {
            nameInput.value = state.user.name;
        }
        if (state.user?.email && emailInput) {
            emailInput.value = state.user.email;
        }

        // Clear previous message and status
        const messageInput = document.getElementById('supportMessage');
        const status = document.getElementById('supportStatus');
        if (messageInput) messageInput.value = '';
        if (status) status.innerHTML = '';

        modal.style.display = 'flex';
    }

    function closeSupportModal() {
        if (elements.supportModal) {
            elements.supportModal.style.display = 'none';
        }
    }

    async function submitSupportForm(e) {
        e.preventDefault();

        const name = document.getElementById('supportName')?.value?.trim();
        const email = document.getElementById('supportEmail')?.value?.trim();
        const message = document.getElementById('supportMessage')?.value?.trim();
        const status = document.getElementById('supportStatus');
        const submitBtn = document.getElementById('submitSupportBtn');

        if (!name || !email || !message) {
            if (status) status.innerHTML = '<span style="color: #ef4444;">Please fill in all fields</span>';
            return;
        }

        // Disable button while sending
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/support`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                    user_id: state.user?.id || null,
                    tier: state.profile?.tier || null
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                if (status) {
                    status.innerHTML = '<span style="color: #10b981;">✅ Message sent! We\'ll get back to you soon.</span>';
                }
                showNotification('Support request sent!', 'success');

                // Close modal after delay
                setTimeout(() => {
                    closeSupportModal();
                }, 2000);
            } else {
                throw new Error(result.message || 'Failed to send');
            }
        } catch (error) {
            console.error('Support form error:', error);
            if (status) {
                status.innerHTML = '<span style="color: #ef4444;">Failed to send. Please try again.</span>';
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
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

        // Handle objects - extract message string
        let displayMessage = message;
        if (typeof message === 'object') {
            displayMessage = message?.message || message?.detail || message?.error || JSON.stringify(message);
        }
        if (!displayMessage || displayMessage === '{}') {
            displayMessage = 'An error occurred';
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = displayMessage;
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
    // PWA Install Prompt
    // ========================================
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome's default install prompt
        e.preventDefault();
        deferredPrompt = e;

        // Check if user dismissed before
        if (localStorage.getItem('pwaInstallDismissed')) {
            return;
        }

        // Show custom install banner
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) {
            banner.style.display = 'flex';
        }
    });

    // Handle install button click
    document.getElementById('pwaInstallBtn')?.addEventListener('click', async () => {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';

        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for user response
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA install outcome: ${outcome}`);

        deferredPrompt = null;
    });

    // Handle dismiss button
    document.getElementById('pwaInstallDismiss')?.addEventListener('click', () => {
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        localStorage.setItem('pwaInstallDismissed', 'true');
    });

    // Hide banner if app is already installed
    window.addEventListener('appinstalled', () => {
        console.log('✅ PWA was installed');
        const banner = document.getElementById('pwaInstallBanner');
        if (banner) banner.style.display = 'none';
        deferredPrompt = null;
    });

    // ========================================
    // Transcript Vault & End Session Modal
    // ========================================

    async function checkVaultStatus() {
        if (state.user.isGuest) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/transcript-vault/status/${state.user.id}`);
            const data = await response.json();
            state.hasTranscriptVault = data.has_vault || false;
            state.vaultIncludedInPlan = data.included_in_plan || false;
        } catch (e) {
            console.log('Could not check vault status:', e);
            state.hasTranscriptVault = false;
        }
    }

    function showEndSessionModal() {
        // Update summary
        const duration = state.startTime ? Math.floor((Date.now() - state.startTime) / 60000) : 0;
        const lines = state.transcript ? state.transcript.length : 0;

        document.getElementById('summaryDuration').textContent = `${duration} min`;
        document.getElementById('summaryLanguages').textContent = state.myLanguage?.toUpperCase() || 'EN';
        document.getElementById('summaryLines').textContent = lines;

        // Show/hide vault elements based on status
        const vaultWarning = document.getElementById('vaultWarning');
        const vaultSaved = document.getElementById('vaultSaved');
        const vaultUpsell = document.getElementById('vaultUpsell');

        if (state.hasTranscriptVault) {
            // Has vault - show saved message, hide warning and upsell
            if (vaultWarning) vaultWarning.style.display = 'none';
            if (vaultSaved) vaultSaved.style.display = 'block';
            if (vaultUpsell) vaultUpsell.style.display = 'none';

            // Auto-save transcript
            saveTranscriptToVault();
        } else {
            // No vault - show warning and upsell
            if (vaultWarning) vaultWarning.style.display = 'block';
            if (vaultSaved) vaultSaved.style.display = 'none';
            if (vaultUpsell) vaultUpsell.style.display = 'block';
        }

        document.getElementById('endSessionModal').style.display = 'flex';
    }

    function closeEndSessionModal() {
        document.getElementById('endSessionModal').style.display = 'none';
    }

    function confirmEndSession() {
        closeEndSessionModal();
        disconnectRoom();
    }

    async function saveTranscriptToVault() {
        if (!state.hasTranscriptVault || !state.transcript || state.transcript.length === 0) {
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/transcript/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.user.id,
                    session_id: state.sessionId || 'unknown',
                    room_code: state.roomCode || 'unknown',
                    duration_minutes: state.startTime ? Math.floor((Date.now() - state.startTime) / 60000) : 0,
                    source_language: state.myLanguage || 'unknown',
                    target_language: 'mixed',
                    transcript_data: state.transcript
                })
            });

            if (response.ok) {
                console.log('✅ Transcript saved to vault');
            }
        } catch (e) {
            console.error('Failed to save transcript to vault:', e);
        }
    }

    async function subscribeToVault() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/transcript-vault/subscribe?user_id=${state.user.id}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.message) {
                showNotification(data.message, 'info');
            }
        } catch (e) {
            showNotification('Failed to start subscription', 'error');
        }
    }

    // Make functions available globally for onclick handlers
    window.showEndSessionModal = showEndSessionModal;
    window.closeEndSessionModal = closeEndSessionModal;
    window.confirmEndSession = confirmEndSession;
    window.subscribeToVault = subscribeToVault;
    window.downloadTranscript = downloadTranscript;

    // ========================================
    // Transcript Vault UI
    // ========================================

    let currentPreviewTranscript = null;

    // Language flags map
    const languageFlags = {
        'en': '🇺🇸', 'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹',
        'pt': '🇵🇹', 'pt-BR': '🇧🇷', 'zh': '🇨🇳', 'zh-TW': '🇹🇼', 'ja': '🇯🇵',
        'ko': '🇰🇷', 'ru': '🇷🇺', 'ar': '🇸🇦', 'hi': '🇮🇳', 'nl': '🇳🇱',
        'pl': '🇵🇱', 'tr': '🇹🇷', 'vi': '🇻🇳', 'th': '🇹🇭', 'uk': '🇺🇦',
        'he': '🇮🇱', 'sv': '🇸🇪', 'da': '🇩🇰', 'fi': '🇫🇮', 'no': '🇳🇴',
        'el': '🇬🇷', 'cs': '🇨🇿', 'ro': '🇷🇴', 'hu': '🇭🇺', 'id': '🇮🇩'
    };

    function getLanguageFlag(lang) {
        return languageFlags[lang] || '🌐';
    }

    // Load vault transcripts
    async function loadVaultTranscripts() {
        const vaultContent = document.getElementById('vaultContent');
        if (!vaultContent) return;

        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;

        // Check if user has vault access
        if (!state.hasTranscriptVault && !state.vaultIncludedInPlan) {
            // Show upsell
            vaultContent.innerHTML = `
            <div class="vault-upsell-sidebar">
                <div class="upsell-icon">💾</div>
                <h4>Transcript Vault</h4>
                <p>Auto-save all your session transcripts. Download anytime.</p>
                <button class="btn btn-accent btn-sm" onclick="window.location.href='pricing.html'">
                    Add for $29/mo
                </button>
            </div>
        `;
            return;
        }

        // Show loading
        vaultContent.innerHTML = `
        <div class="vault-empty">
            <div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;"></div>
            <p>Loading transcripts...</p>
        </div>
    `;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/transcripts/${user.id}`);
            const data = await response.json();

            if (!data.transcripts || data.transcripts.length === 0) {
                // Empty state
                vaultContent.innerHTML = `
                <div class="vault-empty">
                    <div class="vault-empty-icon">📂</div>
                    <p>No transcripts yet.<br>They'll appear here after your sessions.</p>
                </div>
            `;
                return;
            }

            // Render transcript cards
            let html = '<div class="vault-transcripts">';

            data.transcripts.forEach(t => {
                const date = new Date(t.created_at);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const srcFlag = getLanguageFlag(t.source_language);
                const tgtFlag = getLanguageFlag(t.target_language);

                html += `
                <div class="transcript-card" onclick="openTranscriptPreview('${t.id}')">
                    <div class="transcript-card-header">
                        <span class="transcript-card-icon">📄</span>
                        <span class="transcript-card-date">${dateStr}</span>
                        <span class="transcript-card-time">${timeStr}</span>
                    </div>
                    <div class="transcript-card-meta">
                        <span>🏷️ ${t.room_code}</span>
                        <span>⏱️ ${t.duration_minutes} min</span>
                        <span>💬 ${t.line_count} lines</span>
                    </div>
                    <div class="transcript-card-languages">
                        ${srcFlag} ${t.source_language.toUpperCase()}
                        <span class="arrow">↔</span>
                        ${tgtFlag} ${t.target_language.toUpperCase()}
                    </div>
                </div>
            `;
            });

            html += '</div>';

            // Add "View All" if there are more
            if (data.transcripts.length >= 10) {
                html += `
                <div class="vault-load-more">
                    <button onclick="window.location.href='vault.html'">View All Transcripts →</button>
                </div>
            `;
            }

            vaultContent.innerHTML = html;

        } catch (error) {
            console.error('Failed to load transcripts:', error);
            vaultContent.innerHTML = `
            <div class="vault-empty">
                <div class="vault-empty-icon">⚠️</div>
                <p>Failed to load transcripts.<br>Click refresh to try again.</p>
            </div>
        `;
        }
    }

    // Open transcript preview panel
    async function openTranscriptPreview(transcriptId) {
        const overlay = document.getElementById('transcriptPreviewOverlay');
        const content = document.getElementById('previewContent');

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Show loading
        content.innerHTML = `
        <div class="preview-loading">
            <div class="spinner"></div>
            <p>Loading transcript...</p>
        </div>
    `;

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await fetch(`${CONFIG.API_BASE}/api/transcript/${transcriptId}?user_id=${user.id}`);

            if (!response.ok) throw new Error('Failed to load transcript');

            const transcript = await response.json();
            currentPreviewTranscript = transcript;

            // Update meta
            const date = new Date(transcript.created_at);
            document.getElementById('previewDate').textContent = date.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
            document.getElementById('previewRoom').textContent = transcript.room_code;
            document.getElementById('previewDuration').textContent = `${transcript.duration_minutes} minutes`;

            const srcFlag = getLanguageFlag(transcript.source_language);
            const tgtFlag = getLanguageFlag(transcript.target_language);
            document.getElementById('previewLanguages').textContent =
                `${srcFlag} ${transcript.source_language.toUpperCase()} ↔ ${tgtFlag} ${transcript.target_language.toUpperCase()}`;

            // Render transcript entries
            if (!transcript.transcript_data || transcript.transcript_data.length === 0) {
                content.innerHTML = `
                <div class="vault-empty">
                    <p>No transcript content available.</p>
                </div>
            `;
                return;
            }

            let html = '';
            transcript.transcript_data.forEach(entry => {
                const time = entry.timestamp || '';
                const speaker = entry.sender || entry.speaker || 'Unknown';
                const original = entry.text || entry.original || '';
                const translated = entry.translatedText || entry.translated || '';
                const lang = entry.language || transcript.source_language || '';

                html += `
                <div class="preview-entry">
                    <div class="preview-entry-header">
                        <span class="preview-entry-speaker">${speaker}</span>
                        <span class="preview-entry-time">${time}</span>
                        <span class="preview-entry-lang">${lang.toUpperCase()}</span>
                    </div>
                    <div class="preview-entry-original">${escapeHtml(original)}</div>
                    ${translated ? `<div class="preview-entry-translated">→ ${escapeHtml(translated)}</div>` : ''}
                </div>
            `;
            });

            content.innerHTML = html;

        } catch (error) {
            console.error('Failed to load transcript:', error);
            content.innerHTML = `
            <div class="vault-empty">
                <div class="vault-empty-icon">⚠️</div>
                <p>Failed to load transcript.</p>
            </div>
        `;
        }
    }

    // Close transcript preview panel
    function closeTranscriptPreview() {
        const overlay = document.getElementById('transcriptPreviewOverlay');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        currentPreviewTranscript = null;
    }

    // Download from preview panel
    function downloadPreviewTranscript(format) {
        if (!currentPreviewTranscript) return;

        const t = currentPreviewTranscript;
        const date = new Date(t.created_at);
        const dateStr = date.toISOString().split('T')[0];
        const filename = `transcript_${t.room_code}_${dateStr}`;

        if (format === 'json') {
            const json = JSON.stringify(t, null, 2);
            downloadFile(json, `${filename}.json`, 'application/json');
        } else if (format === 'txt') {
            let txt = `Mamnoon.ai Transcript\n`;
            txt += `======================\n\n`;
            txt += `Room: ${t.room_code}\n`;
            txt += `Date: ${date.toLocaleString()}\n`;
            txt += `Duration: ${t.duration_minutes} minutes\n`;
            txt += `Languages: ${t.source_language} ↔ ${t.target_language}\n\n`;
            txt += `--- Transcript ---\n\n`;

            (t.transcript_data || []).forEach(entry => {
                const speaker = entry.sender || entry.speaker || 'Unknown';
                const time = entry.timestamp || '';
                const original = entry.text || entry.original || '';
                const translated = entry.translatedText || entry.translated || '';

                txt += `[${time}] ${speaker}:\n`;
                txt += `  ${original}\n`;
                if (translated) txt += `  → ${translated}\n`;
                txt += `\n`;
            });

            downloadFile(txt, `${filename}.txt`, 'text/plain');
        } else if (format === 'pdf') {
            // Open print dialog
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Transcript - ${t.room_code}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { font-size: 24px; margin-bottom: 8px; }
                    .meta { color: #666; margin-bottom: 24px; }
                    .meta span { margin-right: 16px; }
                    .entry { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
                    .speaker { font-weight: 600; color: #6366f1; }
                    .time { color: #999; font-size: 12px; margin-left: 8px; }
                    .original { margin: 4px 0; }
                    .translated { color: #666; font-style: italic; padding-left: 12px; border-left: 2px solid #ddd; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <h1>📄 Mamnoon.ai Transcript</h1>
                <div class="meta">
                    <span>🏷️ Room: ${t.room_code}</span>
                    <span>📅 ${date.toLocaleString()}</span>
                    <span>⏱️ ${t.duration_minutes} min</span>
                    <span>🌐 ${t.source_language.toUpperCase()} ↔ ${t.target_language.toUpperCase()}</span>
                </div>
                ${(t.transcript_data || []).map(entry => `
                    <div class="entry">
                        <span class="speaker">${entry.sender || entry.speaker || 'Unknown'}</span>
                        <span class="time">${entry.timestamp || ''}</span>
                        <div class="original">${escapeHtml(entry.text || entry.original || '')}</div>
                        ${(entry.translatedText || entry.translated) ? `<div class="translated">→ ${escapeHtml(entry.translatedText || entry.translated)}</div>` : ''}
                    </div>
                `).join('')}
            </body>
            </html>
        `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    // Delete transcript from preview
    async function deletePreviewTranscript() {
        if (!currentPreviewTranscript) return;

        const confirmed = await showConfirm({
            title: 'Delete Transcript?',
            message: 'This transcript will be permanently deleted. This cannot be undone.',
            icon: '🗑️',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });

        if (!confirmed) return;

        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await fetch(
                `${CONFIG.API_BASE}/api/transcript/${currentPreviewTranscript.id}?user_id=${user.id}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                closeTranscriptPreview();
                loadVaultTranscripts(); // Refresh list
                showNotification('Transcript deleted', 'success');
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            console.error('Failed to delete transcript:', error);
            showNotification('Failed to delete transcript', 'error');
        }
    }

    // Helper: Download file
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Helper: Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // File Sharing Functions
    // ========================================

    // File size limits by tier (in bytes)
    const FILE_SIZE_LIMITS = {
        'starter': 0,
        'professional': 10 * 1024 * 1024,  // 10MB
        'business': 25 * 1024 * 1024,      // 25MB
        'enterprise': 50 * 1024 * 1024     // 50MB
    };

    // Allowed tiers for file sharing
    const FILE_SHARING_TIERS = ['professional', 'business', 'enterprise'];

    // Get file icon based on type
    function getFileIcon(contentType) {
        if (contentType.includes('pdf')) return '📄';
        if (contentType.includes('image')) return '🖼️';
        if (contentType.includes('word') || contentType.includes('document')) return '📝';
        if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
        return '📎';
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Check if user can share files
    function canShareFiles() {
        const tier = state.profile?.tier || 'trial';
        return FILE_SHARING_TIERS.includes(tier);
    }

    // Show/hide file sharing UI based on tier
    function updateFileSharingUI() {
        const tier = state.profile?.tier || 'trial';
        const canShare = canShareFiles();

        console.log('📁 updateFileSharingUI called:', { tier, canShare, profile: state.profile });

        // Show/hide files tab
        if (elements.filesTab) {
            elements.filesTab.style.display = canShare ? '' : 'none';
            console.log('📁 filesTab display:', canShare ? 'visible' : 'hidden');
        } else {
            console.log('⚠️ filesTab element not found');
        }

        // Show/hide files panel (keep it hidden if user can't share)
        if (elements.filesPanel) {
            // Only allow the panel to be shown if user can share files
            // The panel is controlled by .active class, but we need to prevent it entirely for non-eligible users
            if (!canShare) {
                elements.filesPanel.style.display = 'none';
            }
        }

        // Update max file size text
        if (elements.maxFileSizeText && canShare) {
            const maxSize = FILE_SIZE_LIMITS[tier] || 0;
            elements.maxFileSizeText.textContent = formatFileSize(maxSize);
        }

        // Show/hide screen share button
        if (elements.toggleScreenShareBtn) {
            elements.toggleScreenShareBtn.style.display = canShare ? '' : 'none';
            console.log('📁 screenShareBtn display:', canShare ? 'visible' : 'hidden');
        }
    }

    // Handle drag over
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadDropzone?.classList.add('dragover');
    }

    // Handle drag leave
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadDropzone?.classList.remove('dragover');
    }

    // Handle file drop
    function handleFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadDropzone?.classList.remove('dragover');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
    }

    // Handle file select from input
    function handleFileSelect(e) {
        const files = e.target?.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
        // Reset input so same file can be selected again
        if (elements.fileInput) elements.fileInput.value = '';
    }

    // Upload file to server
    async function uploadFile(file) {
        if (!canShareFiles()) {
            showNotification('File sharing requires Professional plan or higher', 'error');
            return;
        }

        if (state.isUploading) {
            showNotification('Please wait for current upload to finish', 'warning');
            return;
        }

        const tier = state.profile?.tier || 'trial';
        const maxSize = FILE_SIZE_LIMITS[tier] || 0;

        if (file.size > maxSize) {
            showNotification(`File too large. Maximum size is ${formatFileSize(maxSize)}`, 'error');
            return;
        }

        state.isUploading = true;

        // Show progress
        if (elements.uploadProgress) elements.uploadProgress.style.display = 'block';
        if (elements.uploadProgressFill) elements.uploadProgressFill.style.width = '0%';
        if (elements.uploadProgressText) elements.uploadProgressText.textContent = 'Uploading...';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('room_code', state.roomCode);
            formData.append('user_id', state.user.id);
            formData.append('user_name', state.user.name || 'User');

            // Simulate progress (since fetch doesn't support progress for uploads easily)
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress = Math.min(progress + 10, 90);
                if (elements.uploadProgressFill) elements.uploadProgressFill.style.width = progress + '%';
            }, 100);

            const response = await fetch(`${CONFIG.API_BASE}/api/files/upload`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }

            if (elements.uploadProgressFill) elements.uploadProgressFill.style.width = '100%';
            if (elements.uploadProgressText) elements.uploadProgressText.textContent = 'Complete!';

            setTimeout(() => {
                if (elements.uploadProgress) elements.uploadProgress.style.display = 'none';
            }, 1000);

            showNotification('File uploaded successfully', 'success');
            loadRoomFiles();

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(error.message || 'Failed to upload file', 'error');
            if (elements.uploadProgress) elements.uploadProgress.style.display = 'none';
        } finally {
            state.isUploading = false;
        }
    }

    // Load files for current room
    async function loadRoomFiles() {
        if (!state.roomCode || !canShareFiles()) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/files/room/${state.roomCode}`);
            if (!response.ok) throw new Error('Failed to load files');

            const data = await response.json();
            state.roomFiles = data.files || [];
            renderFilesList();

        } catch (error) {
            console.error('Failed to load files:', error);
        }
    }

    // Render files list
    function renderFilesList() {
        if (!elements.filesList) return;

        // Update count
        if (elements.tabFilesCount) {
            elements.tabFilesCount.textContent = state.roomFiles.length;
        }

        if (state.roomFiles.length === 0) {
            elements.filesList.innerHTML = `
                <div class="empty-files">
                    <div class="empty-files-icon">📂</div>
                    <p>No files shared yet</p>
                </div>
            `;
            return;
        }

        elements.filesList.innerHTML = state.roomFiles.map(file => {
            const icon = getFileIcon(file.content_type);
            const size = formatFileSize(file.size);
            const time = new Date(file.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Debug: log user IDs to see why delete button might not show
            console.log('📁 File:', file.name, 'file.user_id:', file.user_id, 'state.user.id:', state.user.id);

            // Check if current user can delete (they uploaded it)
            const canDelete = file.user_id === state.user.id || file.user_id === state.user?.id;

            return `
                <div class="file-item" data-file-id="${file.id}">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                        <div class="file-meta">
                            <span>${size}</span>
                            <span>${file.user_name}</span>
                            <span>${time}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="file-action-btn download" onclick="downloadSharedFile('${file.id}')" title="Download">
                            📥
                        </button>
                        <button class="file-action-btn delete" onclick="deleteSharedFile('${file.id}')" title="Delete" style="${canDelete ? '' : 'display:none;'}">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Download a shared file
    async function downloadSharedFile(fileId) {
        try {
            const url = `${CONFIG.API_BASE}/api/files/download/${fileId}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Download error:', error);
            showNotification('Failed to download file', 'error');
        }
    }

    // Delete a shared file
    async function deleteSharedFile(fileId) {
        const confirmed = await showConfirm({
            title: 'Delete File?',
            message: 'This file will be permanently deleted from the room.',
            icon: '🗑️',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/api/files/${fileId}?user_id=${state.user.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete');
            }

            showNotification('File deleted', 'success');
            loadRoomFiles();

        } catch (error) {
            console.error('Delete error:', error);
            showNotification(error.message || 'Failed to delete file', 'error');
        }
    }

    // Make file functions global
    window.downloadSharedFile = downloadSharedFile;
    window.deleteSharedFile = deleteSharedFile;

    // ========================================
    // Screen Sharing Functions
    // ========================================

    async function toggleScreenShare() {
        if (!canShareFiles()) { // Same tier requirement as file sharing
            showNotification('Screen sharing requires Professional plan or higher', 'error');
            return;
        }

        if (typeof toggleDailyScreenShare === 'function') {
            const result = await toggleDailyScreenShare();
            state.isScreenSharing = result;
            updateScreenShareButton();
        } else if (typeof window.toggleDailyScreenShare === 'function') {
            const result = await window.toggleDailyScreenShare();
            state.isScreenSharing = result;
            updateScreenShareButton();
        } else {
            showNotification('Screen sharing not available', 'error');
        }
    }

    function updateScreenShareButton() {
        if (!elements.toggleScreenShareBtn) return;

        if (state.isScreenSharing) {
            elements.toggleScreenShareBtn.classList.add('screen-sharing');
            elements.toggleScreenShareBtn.querySelector('.control-icon').textContent = '🖥️';
            elements.toggleScreenShareBtn.querySelector('.control-label').textContent = 'Stop Sharing';
        } else {
            elements.toggleScreenShareBtn.classList.remove('screen-sharing');
            elements.toggleScreenShareBtn.querySelector('.control-icon').textContent = '🖥️';
            elements.toggleScreenShareBtn.querySelector('.control-label').textContent = 'Share Screen';
        }
    }

    // Listen for screen share state changes from browser's native stop button
    window.addEventListener('screenShareStateChanged', (event) => {
        console.log('🖥️ Screen share state changed via browser:', event.detail);
        state.isScreenSharing = event.detail.isSharing;
        updateScreenShareButton();
    });

    // ========================================
    // Resizable Sidebar
    // ========================================

    function initResizableSidebar() {
        const sidebar = document.getElementById('appSidebar');
        const handle = document.getElementById('sidebarResizeHandle');

        if (!sidebar || !handle) return;

        // Load saved width
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
            sidebar.style.width = savedWidth + 'px';
        }

        let isResizing = false;
        let startX, startWidth;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;

            document.body.classList.add('sidebar-resizing');
            handle.classList.add('dragging');

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const diff = e.clientX - startX;
            const newWidth = Math.min(Math.max(startWidth + diff, 280), 500);
            sidebar.style.width = newWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;

            isResizing = false;
            document.body.classList.remove('sidebar-resizing');
            handle.classList.remove('dragging');

            // Save width
            localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
        });

        // Double-click to reset
        handle.addEventListener('dblclick', () => {
            sidebar.style.width = '280px';
            localStorage.removeItem('sidebarWidth');
        });
    }



    // Make functions global
    window.openTranscriptPreview = openTranscriptPreview;
    window.closeTranscriptPreview = closeTranscriptPreview;
    window.downloadPreviewTranscript = downloadPreviewTranscript;
    window.deletePreviewTranscript = deletePreviewTranscript;

    // ========================================
    // Start App
    // ========================================
    init();

})();