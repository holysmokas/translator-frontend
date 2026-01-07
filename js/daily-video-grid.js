// ========================================
// Daily.co Call Object SDK Implementation
// Replace iframe approach with full layout control
// ========================================

let callObject = null;
let participants = {};

// ========================================
// Main Entry Point - Call this instead of iframe
// ========================================
async function joinDailyRoom(roomUrl) {
    console.log('🎥 Joining Daily room with SDK:', roomUrl);

    // Create call object
    callObject = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
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

    // Join the room
    try {
        await callObject.join({ url: roomUrl });
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
    const local = callObject.participants().local;
    addParticipantTile(local);
}

function handleParticipantJoined(event) {
    console.log('👤 Participant joined:', event.participant.user_name);
    addParticipantTile(event.participant);
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
    if (track.kind === 'video') {
        attachVideoTrack(participant.session_id, track);
    }
    if (track.kind === 'audio' && !participant.local) {
        attachAudioTrack(participant.session_id, track);
    }
}

function handleTrackStopped(event) {
    const { participant, track } = event;
    if (track.kind === 'video') {
        detachVideoTrack(participant.session_id);
    }
}

function handleLeftMeeting() {
    console.log('📴 Left meeting');
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

    // Don't duplicate
    if (document.getElementById(`tile-${sessionId}`)) return;

    const tile = document.createElement('div');
    tile.id = `tile-${sessionId}`;
    tile.className = 'video-tile';
    tile.innerHTML = `
        <video id="video-${sessionId}" autoplay playsinline ${participant.local ? 'muted' : ''}></video>
        <audio id="audio-${sessionId}" autoplay></audio>
        <div class="participant-name">${participant.user_name || 'Guest'}${participant.local ? ' (You)' : ''}</div>
        <div class="participant-status">
            <span class="mic-status">${participant.audio ? '🎤' : '🔇'}</span>
            <span class="cam-status">${participant.video ? '📹' : '📷'}</span>
        </div>
    `;

    grid.appendChild(tile);
    participants[sessionId] = participant;
    updateGridLayout();

    // Attach tracks if already available
    const tracks = callObject.participants()[sessionId]?.tracks;
    if (tracks?.video?.track) {
        attachVideoTrack(sessionId, tracks.video.track);
    }
    if (tracks?.audio?.track && !participant.local) {
        attachAudioTrack(sessionId, tracks.audio.track);
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
}

function attachVideoTrack(sessionId, track) {
    const video = document.getElementById(`video-${sessionId}`);
    if (video && track) {
        video.srcObject = new MediaStream([track]);
    }
}

function attachAudioTrack(sessionId, track) {
    const audio = document.getElementById(`audio-${sessionId}`);
    if (audio && track) {
        audio.srcObject = new MediaStream([track]);
    }
}

function detachVideoTrack(sessionId) {
    const video = document.getElementById(`video-${sessionId}`);
    if (video) {
        video.srcObject = null;
    }
}

function updateGridLayout() {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;

    const count = Object.keys(participants).length;

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

function leaveCall() {
    if (callObject) {
        callObject.leave();
    }
}

function cleanupCall() {
    if (callObject) {
        callObject.destroy();
        callObject = null;
    }
    participants = {};
    const grid = document.getElementById('videoGrid');
    if (grid) grid.innerHTML = '';
}

// ========================================
// Updated showRoomUI Function
// Replace existing showRoomUI in app.js with this
// ========================================
function showRoomUI_DailySDK(videoUrl) {
    // Hide welcome, show room state
    const welcomeState = document.getElementById('welcomeState');
    const roomState = document.getElementById('roomState');
    const activeRoomCode = document.getElementById('activeRoomCode');
    const videoSection = document.getElementById('videoSection');

    if (welcomeState) welcomeState.style.display = 'none';
    if (roomState) roomState.style.display = 'block';
    if (activeRoomCode && window.state?.roomCode) {
        activeRoomCode.textContent = window.state.roomCode;
    }

    // Create video grid container with controls
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.innerHTML = `
        <div class="video-grid" id="videoGrid"></div>
        <div class="subtitle-overlay" id="subtitleOverlay"></div>
        <div class="video-controls">
            <button class="control-btn" id="toggleMuteBtn" onclick="toggleMute()">🎤 Mute</button>
            <button class="control-btn" id="toggleVideoBtn" onclick="toggleVideo()">📹 Video</button>
            <button class="control-btn control-btn-danger" onclick="leaveCall()">Leave</button>
        </div>
    `;

    if (videoSection) {
        videoSection.innerHTML = '';
        videoSection.appendChild(videoContainer);
    }

    // Join Daily room with SDK instead of iframe
    if (videoUrl) {
        joinDailyRoom(videoUrl);
    }

    // Store subtitle overlay reference for translation system
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    if (subtitleOverlay) {
        subtitleOverlay.style.display = 'block';
        // If you have elements object, update it
        if (window.elements) {
            window.elements.subtitleOverlay = subtitleOverlay;
        }
    }
}