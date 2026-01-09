// ========================================
// Daily.co Call Object SDK Implementation
// Replace iframe approach with full layout control
// ========================================

let callObject = null;
let participants = {};

// ========================================
// Main Entry Point - Call this instead of iframe
// ========================================
async function joinDailyRoom(roomUrl, userName) {
    console.log('🎥 Joining Daily room with SDK:', roomUrl);

    // Clean up any existing call first
    if (callObject) {
        await callObject.destroy();
        callObject = null;
    }
    participants = {};

    // Create call object with camera/mic enabled
    callObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        dailyConfig: {
            experimentalChromeVideoMuteLightOff: true,
        }
    });

    // Set up event listeners
    callObject.on('joined-meeting', handleJoinedMeeting);
    callObject.on('participant-joined', handleParticipantJoined);
    callObject.on('participant-updated', handleParticipantUpdated);
    callObject.on('participant-left', handleParticipantLeft);
    callObject.on('track-started', handleTrackStarted);
    callObject.on('track-stopped', handleTrackStopped);
    callObject.on('left-meeting', handleLeftMeeting);
    callObject.on('error', handleError);
    callObject.on('camera-error', (e) => console.error('📷 Camera error:', e));
    callObject.on('app-message', handleAppMessage);

    // Join the room with camera and mic ON
    try {
        await callObject.join({
            url: roomUrl,
            userName: userName || 'Guest',
            startVideoOff: false,
            startAudioOff: false
        });
        console.log('✅ Successfully joined room');
    } catch (err) {
        console.error('❌ Failed to join Daily room:', err);
        handleError(err);
    }
}

// ========================================
// Event Handlers
// ========================================
function handleJoinedMeeting(event) {
    console.log('✅ Joined meeting');

    // Setup screen share event listeners
    setupScreenShareListeners();

    // Clear video tiles BUT PRESERVE subtitle overlay!
    const grid = document.getElementById('videoGrid');
    if (grid) {
        // Remove only video tiles, not the subtitle overlay
        const tiles = grid.querySelectorAll('.video-tile');
        tiles.forEach(tile => tile.remove());

        // If subtitle overlay doesn't exist, recreate it
        if (!document.getElementById('subtitleOverlay')) {
            const newOverlay = document.createElement('div');
            newOverlay.className = 'subtitle-overlay';
            newOverlay.id = 'subtitleOverlay';
            newOverlay.style.display = 'block';
            grid.appendChild(newOverlay);

            // Update elements reference if available
            if (window.elements) {
                window.elements.subtitleOverlay = newOverlay;
            }
            console.log('🔄 Recreated subtitle overlay');
        }
    }
    participants = {};

    // Get all participants including local
    const allParticipants = callObject.participants();
    console.log('👥 All participants:', Object.keys(allParticipants));

    // Add local participant first
    if (allParticipants.local) {
        addParticipantTile(allParticipants.local);
    }

    // Add any existing remote participants
    Object.entries(allParticipants).forEach(([id, participant]) => {
        if (id !== 'local' && !document.getElementById(`tile-${participant.session_id}`)) {
            console.log(`➕ Adding existing participant: ${participant.user_name}`);
            addParticipantTile(participant);
        }
    });
}

function handleParticipantJoined(event) {
    const p = event.participant;
    console.log('👤 Participant joined:', p.user_name, p.session_id);

    // Only add if not already present
    if (!participants[p.session_id]) {
        addParticipantTile(p);
    } else {
        console.log('⚠️ Participant already in grid:', p.user_name);
    }
}

function handleParticipantUpdated(event) {
    updateParticipantTile(event.participant);
}

function handleParticipantLeft(event) {
    console.log('👋 Participant left:', event.participant.user_name);
    removeParticipantTile(event.participant.session_id);
}

function handleTrackStarted(event) {
    const { participant, track } = event;
    console.log(`🎬 Track started: ${track.kind} for ${participant.user_name} (session: ${participant.session_id}, local: ${participant.local})`);

    // Make sure tile exists
    if (!document.getElementById(`tile-${participant.session_id}`)) {
        console.log(`📦 Creating tile for track-started participant: ${participant.user_name}`);
        addParticipantTile(participant);
    }

    if (track.kind === 'video') {
        console.log(`📹 Attaching video track for ${participant.user_name}`);
        attachVideoTrack(participant.session_id, track);
        updateAvatarVisibility(participant.session_id, true);
    }
    // Attach audio for remote participants only (local audio would cause echo)
    if (track.kind === 'audio' && !participant.local) {
        attachAudioTrack(participant.session_id, track);
    }
}

function handleTrackStopped(event) {
    const { participant, track } = event;
    if (track.kind === 'video') {
        detachVideoTrack(participant.session_id);
        updateAvatarVisibility(participant.session_id, false);
    }
}

function handleLeftMeeting() {
    console.log('🔴 Left meeting');
    cleanupCall();
}

function handleError(error) {
    console.error('❌ Daily error:', error);
}

// ========================================
// Video Grid Management
// ========================================
function addParticipantTile(participant) {
    const grid = document.getElementById('videoGrid');
    if (!grid) {
        console.error('videoGrid element not found');
        return;
    }

    const sessionId = participant.session_id;
    console.log(`➕ Adding tile for: ${participant.user_name} (${sessionId}), local: ${participant.local}, video: ${participant.video}`);

    // Don't duplicate
    if (document.getElementById(`tile-${sessionId}`)) {
        console.log(`⚠️ Tile already exists for ${sessionId}`);
        return;
    }

    // Check if already in participants
    if (participants[sessionId]) {
        console.log(`⚠️ Participant already tracked: ${sessionId}`);
        return;
    }

    // Get initials for avatar fallback
    const name = participant.user_name || 'Guest';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    const tile = document.createElement('div');
    tile.id = `tile-${sessionId}`;
    tile.className = 'video-tile';
    tile.innerHTML = `
        <video id="video-${sessionId}" autoplay playsinline ${participant.local ? 'muted' : ''} style="display: none;"></video>
        <audio id="audio-${sessionId}" autoplay></audio>
        <div class="avatar-fallback" id="avatar-${sessionId}" style="display: flex;">${initials}</div>
        <div class="participant-name">${name}${participant.local ? ' (You)' : ''}</div>
        <div class="participant-status">
            <span class="mic-status">${participant.audio ? '🎤' : '🔇'}</span>
            <span class="cam-status">${participant.video ? '📹' : '📷'}</span>
        </div>
    `;

    // Insert tile BEFORE subtitle overlay (so overlay stays on top)
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    if (subtitleOverlay) {
        grid.insertBefore(tile, subtitleOverlay);
    } else {
        grid.appendChild(tile);
    }

    participants[sessionId] = participant;
    updateGridLayout();

    // Try to attach video track if already available
    const tracks = participant.tracks;
    if (tracks?.video?.persistentTrack) {
        console.log(`📹 Found persistentTrack for ${name}`);
        attachVideoTrack(sessionId, tracks.video.persistentTrack);
    } else if (tracks?.video?.track) {
        console.log(`📹 Found track for ${name}`);
        attachVideoTrack(sessionId, tracks.video.track);
    } else {
        console.log(`⏳ No video track yet for ${name}, waiting for track-started event`);
    }

    // Attach audio for remote participants
    if (!participant.local) {
        if (tracks?.audio?.persistentTrack) {
            attachAudioTrack(sessionId, tracks.audio.persistentTrack);
        } else if (tracks?.audio?.track) {
            attachAudioTrack(sessionId, tracks.audio.track);
        }
    }
}

function removeParticipantTile(sessionId) {
    const tile = document.getElementById(`tile-${sessionId}`);
    if (tile) tile.remove();
    delete participants[sessionId];
    updateGridLayout();
}

function updateParticipantTile(participant) {
    const sessionId = participant.session_id;
    const tile = document.getElementById(`tile-${sessionId}`);
    if (!tile) return;

    // Update mic/cam status
    const micStatus = tile.querySelector('.mic-status');
    const camStatus = tile.querySelector('.cam-status');
    if (micStatus) micStatus.textContent = participant.audio ? '🎤' : '🔇';
    if (camStatus) camStatus.textContent = participant.video ? '📹' : '📷';

    // Show/hide avatar based on video state
    updateAvatarVisibility(sessionId, participant.video);
}

function updateAvatarVisibility(sessionId, hasVideo) {
    const avatar = document.getElementById(`avatar-${sessionId}`);
    const video = document.getElementById(`video-${sessionId}`);

    if (avatar) {
        avatar.style.display = hasVideo ? 'none' : 'flex';
    }
    if (video) {
        video.style.display = hasVideo ? 'block' : 'none';
    }
}

function attachVideoTrack(sessionId, track) {
    console.log(`🎬 attachVideoTrack called for ${sessionId}, track:`, track);
    const video = document.getElementById(`video-${sessionId}`);
    if (!video) {
        console.error(`❌ Video element not found: video-${sessionId}`);
        return;
    }
    if (!track) {
        console.error(`❌ Track is null for ${sessionId}`);
        return;
    }

    try {
        video.srcObject = new MediaStream([track]);
        video.style.display = 'block';

        // Hide avatar when video is attached
        const avatar = document.getElementById(`avatar-${sessionId}`);
        if (avatar) avatar.style.display = 'none';

        // Ensure video plays
        video.play().then(() => {
            console.log(`✅ Video playing for ${sessionId}`);
        }).catch(err => {
            console.log('⚠️ Video autoplay prevented:', err);
            // Try muted autoplay
            video.muted = true;
            video.play().catch(e => console.error('Failed even muted:', e));
        });
    } catch (err) {
        console.error(`❌ Error attaching video track for ${sessionId}:`, err);
    }
}

function attachAudioTrack(sessionId, track) {
    const audio = document.getElementById(`audio-${sessionId}`);
    if (audio && track) {
        audio.srcObject = new MediaStream([track]);
        audio.play().catch(err => console.log('Audio autoplay prevented:', err));
    }
}

function detachVideoTrack(sessionId) {
    const video = document.getElementById(`video-${sessionId}`);
    if (video) {
        video.srcObject = null;
        video.style.display = 'none';
    }
    // Show avatar when video is detached
    const avatar = document.getElementById(`avatar-${sessionId}`);
    if (avatar) avatar.style.display = 'flex';
}

function updateGridLayout() {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;

    const count = Object.keys(participants).length;
    console.log(`📊 Updating grid layout: ${count} participants`);

    // Remove old participant-count classes
    grid.className = 'video-grid';

    // Add participant count class for CSS grid layout
    if (count <= 9) {
        grid.classList.add(`participants-${count}`);
    } else {
        grid.classList.add('participants-many');
    }
}

// ========================================
// Controls
// ========================================
function toggleMute() {
    if (!callObject) return;
    const localAudio = callObject.localAudio();
    callObject.setLocalAudio(!localAudio);

    // Update button UI
    const btn = document.getElementById('toggleMuteBtn');
    if (btn) {
        btn.innerHTML = localAudio ? '🔇 Unmute' : '🎤 Mute';
    }
}

function toggleVideo() {
    if (!callObject) return;
    const localVideo = callObject.localVideo();
    callObject.setLocalVideo(!localVideo);

    // Update button UI
    const btn = document.getElementById('toggleVideoBtn');
    if (btn) {
        btn.innerHTML = localVideo ? '📷 Start Video' : '📹 Stop Video';
    }
}

// ========================================
// Handle App Messages (for host controls like mute all)
// ========================================
function handleAppMessage(event) {
    console.log('📨 App message received:', event);
    const { data, fromId } = event;

    if (data.type === 'mute_all') {
        // Host requested everyone to mute
        console.log('🔇 Host requested mute all');
        if (callObject && callObject.localAudio()) {
            callObject.setLocalAudio(false);
            // Update button UI
            const btn = document.getElementById('toggleMuteBtn');
            if (btn) {
                btn.innerHTML = '🔇 Unmute';
            }
            if (typeof showNotification === 'function') {
                showNotification('Host muted all participants', 'info');
            }
        }
    } else if (data.type === 'unmute_all') {
        // Host allowed everyone to unmute (just notify, don't force unmute)
        console.log('🔊 Host allowed unmute');
        if (typeof showNotification === 'function') {
            showNotification('Host enabled audio - you can unmute now', 'info');
        }
    }
}

// ========================================
// Host Controls - Mute All Participants
// ========================================
function sendMuteAllRequest(mute) {
    if (!callObject) {
        console.log('⚠️ No call object for mute all');
        return false;
    }

    try {
        callObject.sendAppMessage({ type: mute ? 'mute_all' : 'unmute_all' }, '*');
        console.log(`📢 Sent ${mute ? 'mute' : 'unmute'} all request`);
        return true;
    } catch (e) {
        console.error('❌ Failed to send mute all:', e);
        return false;
    }
}

// Expose to global scope for app.js
window.sendMuteAllRequest = sendMuteAllRequest;

// ========================================
// Screen Sharing
// ========================================
let isScreenSharing = false;

async function toggleDailyScreenShare() {
    if (!callObject) {
        console.log('⚠️ No call object for screen share');
        return false;
    }

    try {
        if (isScreenSharing) {
            // Stop screen share
            await callObject.stopScreenShare();
            isScreenSharing = false;
            console.log('🖥️ Screen share stopped');

            if (typeof showNotification === 'function') {
                showNotification('Screen sharing stopped', 'info');
            }
        } else {
            // Start screen share
            await callObject.startScreenShare();
            isScreenSharing = true;
            console.log('🖥️ Screen share started');

            if (typeof showNotification === 'function') {
                showNotification('Screen sharing started', 'success');
            }
        }
        return isScreenSharing;
    } catch (err) {
        console.error('❌ Screen share error:', err);
        isScreenSharing = false;

        if (typeof showNotification === 'function') {
            if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
                showNotification('Screen share permission denied', 'error');
            } else {
                showNotification('Failed to share screen', 'error');
            }
        }
        return false;
    }
}

// Listen for screen share stopped event (user clicked browser's stop button)
function setupScreenShareListeners() {
    if (!callObject) return;

    callObject.on('participant-updated', (event) => {
        if (event.participant.local && event.participant.screen === false && isScreenSharing) {
            isScreenSharing = false;
            console.log('🖥️ Screen share stopped via browser');

            // Update UI in app.js if function exists
            if (typeof window.updateScreenShareButton === 'function') {
                window.state = window.state || {};
                window.state.isScreenSharing = false;
                window.updateScreenShareButton();
            }
        }
    });
}

// Expose to global scope
window.toggleDailyScreenShare = toggleDailyScreenShare;

// ========================================
// Leave Call - FIXED: Properly disconnect everything
// ========================================
function leaveCall() {
    console.log('👋 Leaving call...');

    // First cleanup Daily call
    if (callObject) {
        try {
            callObject.leave();
        } catch (e) {
            console.log('Error leaving call:', e);
        }
    }

    // Then trigger the full app disconnect
    // This handles WebSocket, cleanup, and proper redirect
    if (typeof disconnectRoom === 'function') {
        // For guests, clear URL params first to prevent auto-rejoin
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('guest') === 'true') {
            // Clear URL params before disconnecting
            window.history.replaceState({}, '', window.location.pathname);
        }
        disconnectRoom();
    } else if (typeof window.disconnectRoom === 'function') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('guest') === 'true') {
            window.history.replaceState({}, '', window.location.pathname);
        }
        window.disconnectRoom();
    } else {
        // Fallback: just reload without params
        console.log('⚠️ disconnectRoom not found, falling back to redirect');
        cleanupCall();
        window.location.href = window.location.pathname;
    }
}

function cleanupCall() {
    if (callObject) {
        try {
            callObject.destroy();
        } catch (e) {
            console.log('Error destroying call:', e);
        }
        callObject = null;
    }
    participants = {};

    // Clear only video tiles, preserve subtitle overlay
    const grid = document.getElementById('videoGrid');
    if (grid) {
        const tiles = grid.querySelectorAll('.video-tile');
        tiles.forEach(tile => tile.remove());
    }
}