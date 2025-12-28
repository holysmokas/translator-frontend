// ========================================
// Mamnoon.ai Translator - Main Application
// ========================================

(function() {
    'use strict';

    // ========================================
    // Auth Check
    // ========================================
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // ========================================
    // State
    // ========================================
    const state = {
        user: user,
        profile: JSON.parse(localStorage.getItem('profile')) || {},
        ws: null,
        roomCode: null,
        sessionId: null,
        maxMinutes: 15,
        timerInterval: null,
        startTime: null,
        myLanguage: 'en',
        connected: false
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
        accountBtn: document.getElementById('accountBtn')
    };

    // ========================================
    // Initialize
    // ========================================
    async function init() {
        console.log('🌍 Mamnoon.ai App initialized');
        
        // Display user info
        elements.userName.textContent = state.user.name || state.user.email.split('@')[0];
        
        // Load profile and usage
        await loadProfile();
        
        // Bind events
        bindEvents();
        
        // Check URL params for payment status
        checkPaymentStatus();
    }

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
        }
    }

    function checkPaymentStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get('payment');
        
        if (payment === 'success') {
            showNotification('🎉 Payment successful! Your subscription is now active.', 'success');
            // Clear URL params
            window.history.replaceState({}, document.title, 'app.html');
            // Reload profile
            loadProfile();
        } else if (payment === 'cancelled') {
            showNotification('Payment cancelled. You can try again anytime.', 'info');
            window.history.replaceState({}, document.title, 'app.html');
        }
    }

    // ========================================
    // Event Binding
    // ========================================
    function bindEvents() {
        // Create room buttons
        elements.createRoomBtn.addEventListener('click', createRoom);
        elements.welcomeCreateBtn.addEventListener('click', createRoom);
        
        // Join room buttons
        elements.joinRoomBtn.addEventListener('click', () => showJoinModal());
        elements.welcomeJoinBtn.addEventListener('click', () => showJoinModal());
        elements.closeJoinModal.addEventListener('click', () => hideJoinModal());
        elements.confirmJoinBtn.addEventListener('click', joinRoom);
        elements.joinRoomCode.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinRoom();
        });
        
        // Room actions
        elements.leaveRoomBtn.addEventListener('click', leaveRoom);
        elements.copyCodeBtn.addEventListener('click', copyRoomCode);
        
        // Messaging
        elements.sendBtn.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Language
        elements.languageSelect.addEventListener('change', (e) => {
            state.myLanguage = e.target.value;
        });
        
        // Paywall
        elements.paywallUpgradeBtn.addEventListener('click', () => {
            const selectedPlan = document.querySelector('.paywall-plan.selected');
            const plan = selectedPlan ? selectedPlan.dataset.plan : 'professional';
            window.location.href = `checkout.html?plan=${plan}`;
        });
        elements.paywallCloseBtn.addEventListener('click', hidePaywall);
        
        // Plan selection in paywall
        document.querySelectorAll('.paywall-plan').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.paywall-plan').forEach(p => p.classList.remove('selected'));
                el.classList.add('selected');
            });
        });
        
        // Auth
        elements.logoutBtn.addEventListener('click', logout);
        elements.accountBtn.addEventListener('click', () => openBillingPortal());
    }

    // ========================================
    // Room Management
    // ========================================
    async function createRoom() {
        try {
            showLoading('Creating room...');
            
            const response = await fetch(`${CONFIG.API_BASE}/api/room/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: state.user.id })
            });
            
            const data = await response.json();
            
            if (response.status === 402) {
                // Payment required - show paywall
                hideLoading();
                showPaywall(data.detail.code, data.detail.message);
                return;
            }
            
            if (response.status === 429) {
                // Room limit reached
                hideLoading();
                showPaywall('ROOM_LIMIT', data.detail.message);
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.detail?.message || data.detail || 'Failed to create room');
            }
            
            hideLoading();
            
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
        if (code.length !== 6) {
            showNotification('Please enter a valid 6-character room code', 'error');
            return;
        }
        
        try {
            hideJoinModal();
            showLoading('Joining room...');
            
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
        
        // Reset UI
        elements.roomState.style.display = 'none';
        elements.welcomeState.style.display = 'flex';
        elements.messagesContainer.innerHTML = '<div class="empty-messages"><p>💬 Messages will appear here</p></div>';
        elements.videoSection.innerHTML = '<div class="video-placeholder"><div class="video-placeholder-icon">📹</div><p>Loading video...</p></div>';
        
        // Reload profile to update usage
        loadProfile();
    }

    function copyRoomCode() {
        navigator.clipboard.writeText(state.roomCode).then(() => {
            showNotification('Room code copied!', 'success');
        });
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
        
        // Load video
        if (videoUrl) {
            elements.videoSection.innerHTML = `
                <iframe 
                    src="${videoUrl}?t=${Date.now()}"
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    allowfullscreen
                ></iframe>
            `;
        }
        
        elements.messageInput.focus();
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
                break;
            case 'translation':
                addReceivedMessage(data);
                break;
            case 'sent':
                addSentMessage(data.original_text, data.recipients);
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
            'TRIAL_USED': 'Trial Expired',
            'SUBSCRIPTION_INACTIVE': 'Subscription Inactive',
            'ROOM_LIMIT': 'Room Limit Reached',
            'TIME_LIMIT': 'Session Ended'
        };
        
        elements.paywallTitle.textContent = titles[code] || 'Upgrade Required';
        elements.paywallMessage.textContent = message;
        elements.paywallModal.style.display = 'flex';
        
        // Pre-select professional plan
        document.querySelectorAll('.paywall-plan').forEach(p => p.classList.remove('selected'));
        document.querySelector('.paywall-plan[data-plan="professional"]').classList.add('selected');
    }

    function hidePaywall() {
        elements.paywallModal.style.display = 'none';
    }

    // ========================================
    // UI Helpers
    // ========================================
    function showLoading(text) {
        // Simple loading - could be enhanced
        elements.welcomeCreateBtn.disabled = true;
        elements.welcomeCreateBtn.innerHTML = `<span class="spinner"></span> ${text}`;
    }

    function hideLoading() {
        elements.welcomeCreateBtn.disabled = false;
        elements.welcomeCreateBtn.innerHTML = '<span>Create Room</span>';
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    function logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('session');
        localStorage.removeItem('profile');
        localStorage.removeItem('selectedPlan');
        window.location.href = 'index.html';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
