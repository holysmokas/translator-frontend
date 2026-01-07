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

    // Join the room with user name
    try {
        await callObject.join({
            url: roomUrl,
            userName: userName || 'Guest'
        });
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
        updateAvatarVisibility(participant.session_id, true);
    }
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

    // Get initials for avatar fallback
    const name = participant.user_name || 'Guest';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const tile = document.createElement('div');
    tile.id = `tile-${sessionId}`;
    tile.className = 'video-tile';
    tile.innerHTML = `
        <video id="video-${sessionId}" autoplay playsinline ${participant.local ? 'muted' : ''}></video>
        <audio id="audio-${sessionId}" autoplay></audio>
        <div class="avatar-fallback" id="avatar-${sessionId}">${initials}</div>
        <div class="participant-name">${name}${participant.local ? ' (You)' : ''}</div>
        <div class="participant-status">
            <span class="mic-status">${participant.audio ? '🎤' : '🔇'}</span>
            <span class="cam-status">${participant.video ? '📹' : '📷'}</span>
        </div>
    `;

    grid.appendChild(tile);
    participants[sessionId] = participant;
    updateGridLayout();

    // Check if video is on/off and show/hide avatar
    updateAvatarVisibility(sessionId, participant.video);

    // Attach tracks if already available
    const tracks = callObject.participants()[sessionId]?.tracks;
    if (tracks?.video?.persistentTrack) {
        attachVideoTrack(sessionId, tracks.video.persistentTrack);
    } else if (tracks?.video?.track) {
        attachVideoTrack(sessionId, tracks.video.track);
    }
    if (tracks?.audio?.persistentTrack && !participant.local) {
        attachAudioTrack(sessionId, tracks.audio.persistentTrack);
    } else if (tracks?.audio?.track && !participant.local) {
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
    const video = document.getElementById(`video-${sessionId}`);
    if (video && track) {
        video.srcObject = new MediaStream([track]);
        video.style.display = 'block';
        // Hide avatar when video is attached
        const avatar = document.getElementById(`avatar-${sessionId}`);
        if (avatar) avatar.style.display = 'none';

        // Ensure video plays
        video.play().catch(err => console.log('Video autoplay prevented:', err));
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