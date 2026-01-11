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

    // Screen share events
    callObject.on('local-screen-share-started', () => {
        console.log('🖥️ Local screen share started');
        isScreenSharing = true;
    });
    callObject.on('local-screen-share-stopped', () => {
        console.log('🖥️ Local screen share stopped');
        isScreenSharing = false;
        // Make sure our camera video is still showing
        const local = callObject.participants().local;
        if (local && local.video) {
            const videoTrack = local.tracks?.video?.persistentTrack || local.tracks?.video?.track;
            if (videoTrack) {
                console.log('📹 Re-attaching local camera after screen share');
                attachVideoTrack(local.session_id, videoTrack);
                updateAvatarVisibility(local.session_id, true);
            }
        }
    });

    // Additional debug events
    callObject.on('active-speaker-change', (event) => {
        console.log('🎙️ Active speaker:', event.activeSpeaker?.user_name || 'none');
    });
    callObject.on('network-quality-change', (event) => {
        console.log('📶 Network quality:', event.threshold, 'for', event.type);
    });
    callObject.on('receive-settings-updated', (event) => {
        console.log('📡 Receive settings updated:', event);
    });

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
    const participant = event.participant;

    console.log(`🔄 Participant updated: ${participant.user_name}, video: ${participant.video}, screen: ${participant.screen}`);

    // Check if audio track became available
    if (!participant.local && participant.tracks?.audio) {
        const audioEl = document.getElementById(`audio-${participant.session_id}`);
        // If audio element exists but has no srcObject, try to attach the track
        if (audioEl && !audioEl.srcObject) {
            const audioTrack = participant.tracks.audio.persistentTrack || participant.tracks.audio.track;
            if (audioTrack) {
                console.log(`🔊 participant-updated: Found new audio track for ${participant.user_name}`);
                attachAudioTrack(participant.session_id, audioTrack);
            }
        }
    }

    // Handle screen share state changes
    const screenTileId = `screen-${participant.session_id}`;
    const screenTileExists = document.getElementById(screenTileId);

    // If participant stopped screen sharing but tile still exists, remove it
    if (!participant.screen && screenTileExists) {
        console.log(`🖥️ participant-updated: Screen share ended for ${participant.user_name}`);
        handleScreenShareStopped(participant);

        // Make sure camera video is still showing if camera is on
        if (participant.video && !participant.local) {
            const videoTrack = participant.tracks?.video?.persistentTrack || participant.tracks?.video?.track;
            if (videoTrack) {
                console.log(`📹 Re-attaching camera after screen share stopped for ${participant.user_name}`);
                setTimeout(() => {
                    attachVideoTrack(participant.session_id, videoTrack);
                    updateAvatarVisibility(participant.session_id, true);
                }, 100);
            }
        }
    }

    // If participant started screen sharing, handle it
    if (participant.screen && !screenTileExists) {
        const screenTrack = participant.tracks?.screenVideo?.persistentTrack || participant.tracks?.screenVideo?.track;
        if (screenTrack) {
            console.log(`🖥️ participant-updated: Screen share started for ${participant.user_name}`);
            handleScreenShareStarted(participant, screenTrack);
        }
    }

    updateParticipantTile(participant);
}

function handleParticipantLeft(event) {
    console.log('👋 Participant left:', event.participant.user_name);
    removeParticipantTile(event.participant.session_id);
}

function handleTrackStarted(event) {
    const { participant, track } = event;
    console.log(`🎬 Track started: ${track.kind} for ${participant.user_name} (session: ${participant.session_id}, local: ${participant.local}, label: ${track.label})`);

    // Log track details for debugging
    if (track.kind === 'audio') {
        console.log(`🔊 Audio track details:`, {
            id: track.id,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            label: track.label
        });
    }

    // Check if this is a screen share track
    // Method 1: Check track kind
    const isScreenVideoKind = track.kind === 'screenVideo';

    // Method 2: Check track label for common patterns
    const labelLower = track.label?.toLowerCase() || '';
    const hasScreenLabel = labelLower.includes('screen') ||
        labelLower.includes('window') ||
        labelLower.includes('display') ||
        labelLower.includes('monitor') ||
        labelLower.includes('entire') ||  // "Entire screen"
        labelLower.includes('tab');       // "Chrome Tab"

    // Method 3: Check if participant is screen sharing (most reliable)
    const participantIsScreenSharing = participant.screen === true;

    // Method 4: For local participant, check if we're in screen sharing mode
    const localScreenSharing = participant.local && isScreenSharing;

    // A screen tile already exists for this participant's camera
    const cameraTileExists = document.getElementById(`tile-${participant.session_id}`);
    const screenTileExists = document.getElementById(`screen-${participant.session_id}`);

    // Determine if this is a screen track
    // If participant.screen is true and this is a video track, and we already have their camera tile, 
    // this must be their screen share
    const isScreenTrack = isScreenVideoKind ||
        (track.kind === 'video' && participantIsScreenSharing && cameraTileExists && !screenTileExists) ||
        (track.kind === 'video' && localScreenSharing && cameraTileExists && !screenTileExists) ||
        (track.kind === 'video' && hasScreenLabel);

    console.log(`🔍 Screen detection: kind=${track.kind}, label="${track.label}", participant.screen=${participant.screen}, isScreenSharing=${isScreenSharing}, isScreenTrack=${isScreenTrack}`);

    // Handle screen share track
    if (isScreenTrack) {
        console.log(`🖥️ Screen share track started from ${participant.user_name}`);
        handleScreenShareStarted(participant, track);
        return;
    }

    // Make sure tile exists for regular video
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
        console.log(`🔊 Attaching audio track for REMOTE participant: ${participant.user_name}`);
        attachAudioTrack(participant.session_id, track);
    } else if (track.kind === 'audio' && participant.local) {
        console.log(`🔇 Skipping local audio (would cause echo): ${participant.user_name}`);
    }
}

function handleTrackStopped(event) {
    const { participant, track } = event;

    console.log(`🎬 Track stopped: ${track.kind} for ${participant.user_name}, label: ${track.label}, local: ${participant.local}`);

    // Check if this is a screen share track
    const isScreenTrack = track.kind === 'screenVideo' ||
        track.label?.toLowerCase().includes('screen') ||
        track.label?.toLowerCase().includes('window') ||
        track.label?.toLowerCase().includes('display') ||
        track.label?.toLowerCase().includes('monitor');

    // Check if a screen tile exists for this participant
    const screenTileId = `screen-${participant.session_id}`;
    const screenTileExists = document.getElementById(screenTileId);

    console.log(`🔍 isScreenTrack: ${isScreenTrack}, screenTileExists: ${!!screenTileExists}`);

    // If screen tile exists and ANY video track stops from this participant, 
    // check if it's the screen share
    if (screenTileExists) {
        // Remove the screen share tile
        console.log(`🖥️ Removing screen share tile for ${participant.user_name}`);
        handleScreenShareStopped(participant);

        // If this was identified as a screen track, don't touch camera
        if (isScreenTrack) {
            console.log(`🖥️ Was screen track, preserving camera`);
            return;
        }

        // If track label is ambiguous but screen tile existed, 
        // re-attach camera video to make sure it's still showing
        if (track.kind === 'video' && !participant.local) {
            console.log(`📹 Re-checking camera for remote participant after screen share stopped`);
            const allParticipants = callObject?.participants();
            const currentParticipant = Object.values(allParticipants || {}).find(
                p => p.session_id === participant.session_id
            );

            if (currentParticipant && currentParticipant.video) {
                const cameraTrack = currentParticipant.tracks?.video?.persistentTrack ||
                    currentParticipant.tracks?.video?.track;
                if (cameraTrack && cameraTrack !== track) {
                    console.log(`📹 Re-attaching camera for ${participant.user_name}`);
                    attachVideoTrack(participant.session_id, cameraTrack);
                    updateAvatarVisibility(participant.session_id, true);
                }
            }
        }
        return;
    }

    // No screen tile - this is a regular camera track stopping
    if (track.kind === 'video' && !isScreenTrack) {
        // Verify camera is actually off before detaching
        const allParticipants = callObject?.participants();
        const currentParticipant = participant.local
            ? allParticipants?.local
            : Object.values(allParticipants || {}).find(p => p.session_id === participant.session_id);

        const cameraOff = currentParticipant && !currentParticipant.video;

        if (cameraOff) {
            console.log(`📷 Camera stopped for ${participant.user_name}`);
            detachVideoTrack(participant.session_id);
            updateAvatarVisibility(participant.session_id, false);
        } else {
            console.log(`📷 Ignoring track-stopped for ${participant.user_name} - camera still on (video: ${currentParticipant?.video})`);
        }
    }
}

// ========================================
// Screen Share Track Handling
// ========================================
function handleScreenShareStarted(participant, track) {
    const grid = document.getElementById('videoGrid');
    if (!grid) return;

    const screenTileId = `screen-${participant.session_id}`;

    // Don't duplicate
    if (document.getElementById(screenTileId)) {
        console.log('⚠️ Screen share tile already exists');
        return;
    }

    const name = participant.user_name || 'Guest';

    const tile = document.createElement('div');
    tile.id = screenTileId;
    tile.className = 'video-tile screen-share';
    tile.innerHTML = `
        <video id="video-${screenTileId}" autoplay playsinline></video>
        <div class="participant-name">${name}'s Screen</div>
    `;

    // Insert screen share tile at the beginning (prominently)
    const subtitleOverlay = document.getElementById('subtitleOverlay');
    if (subtitleOverlay) {
        grid.insertBefore(tile, subtitleOverlay);
    } else {
        grid.insertBefore(tile, grid.firstChild);
    }

    // Attach video track
    const video = document.getElementById(`video-${screenTileId}`);
    if (video && track) {
        video.srcObject = new MediaStream([track]);
        video.play().catch(e => console.log('Screen share autoplay prevented:', e));
    }

    updateGridLayout();
    console.log(`✅ Screen share tile created for ${name}`);
}

function handleScreenShareStopped(participant) {
    const screenTileId = `screen-${participant.session_id}`;
    const tile = document.getElementById(screenTileId);

    if (tile) {
        tile.remove();
        updateGridLayout();
        console.log(`✅ Screen share tile removed for ${participant.user_name}`);
    }

    // Update local state if this was our screen share
    if (participant.local) {
        isScreenSharing = false;
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
        console.log(`🔊 Checking audio tracks for remote participant: ${name}`);
        console.log(`🔊 Audio track info:`, {
            hasAudioObj: !!tracks?.audio,
            state: tracks?.audio?.state,
            subscribed: tracks?.audio?.subscribed,
            hasPersistentTrack: !!tracks?.audio?.persistentTrack,
            hasTrack: !!tracks?.audio?.track
        });

        if (tracks?.audio?.persistentTrack) {
            console.log(`🔊 Found audio persistentTrack for ${name}`);
            attachAudioTrack(sessionId, tracks.audio.persistentTrack);
        } else if (tracks?.audio?.track) {
            console.log(`🔊 Found audio track for ${name}`);
            attachAudioTrack(sessionId, tracks.audio.track);
        } else {
            console.log(`⏳ No audio track yet for ${name}, waiting for track-started event`);
        }
    } else {
        console.log(`🔇 Skipping audio attachment for local participant: ${name}`);
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

    // Only update avatar visibility if video state actually changed
    // Don't hide video if it's currently playing
    const video = document.getElementById(`video-${sessionId}`);
    const videoPlaying = video && video.srcObject && !video.paused;

    if (!videoPlaying) {
        updateAvatarVisibility(sessionId, participant.video);
    }
}

function updateAvatarVisibility(sessionId, hasVideo) {
    const avatar = document.getElementById(`avatar-${sessionId}`);
    const video = document.getElementById(`video-${sessionId}`);

    // Don't hide video if it has an active stream
    const videoHasStream = video && video.srcObject && video.srcObject.active;

    if (avatar) {
        avatar.style.display = (hasVideo || videoHasStream) ? 'none' : 'flex';
    }
    if (video) {
        video.style.display = (hasVideo || videoHasStream) ? 'block' : 'none';
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
    console.log(`🔊 attachAudioTrack called for ${sessionId}, track:`, track);
    const audio = document.getElementById(`audio-${sessionId}`);

    if (!audio) {
        console.error(`❌ Audio element not found: audio-${sessionId}`);
        return;
    }
    if (!track) {
        console.error(`❌ Audio track is null for ${sessionId}`);
        return;
    }

    try {
        // Check track state
        console.log(`🔊 Track state: ${track.readyState}, enabled: ${track.enabled}, muted: ${track.muted}`);

        audio.srcObject = new MediaStream([track]);
        audio.muted = false;  // Ensure not muted
        audio.volume = 1.0;   // Full volume

        // Try to play
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log(`✅ Audio playing for ${sessionId}`);
            }).catch(err => {
                console.warn(`⚠️ Audio autoplay blocked for ${sessionId}:`, err.message);

                // Store reference for later resume
                if (!window.pendingAudioElements) {
                    window.pendingAudioElements = [];
                }
                window.pendingAudioElements.push(audio);

                // Show notification to user
                if (typeof showNotification === 'function') {
                    showNotification('Click anywhere to enable audio', 'info');
                }

                // Add one-time click handler to resume audio
                const resumeAudio = () => {
                    console.log('🔊 Attempting to resume blocked audio...');
                    if (window.pendingAudioElements) {
                        window.pendingAudioElements.forEach(audioEl => {
                            audioEl.play().then(() => {
                                console.log('✅ Audio resumed after user interaction');
                            }).catch(e => console.error('❌ Still failed:', e));
                        });
                        window.pendingAudioElements = [];
                    }
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('touchstart', resumeAudio);
                };

                document.addEventListener('click', resumeAudio, { once: true });
                document.addEventListener('touchstart', resumeAudio, { once: true });
            });
        }
    } catch (err) {
        console.error(`❌ Error attaching audio track for ${sessionId}:`, err);
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

    // Update button UI - check both possible IDs
    const btn = document.getElementById('toggleMicBtn') || document.getElementById('toggleMuteBtn');
    if (btn) {
        if (localAudio) {
            // Now muted
            btn.classList.add('muted');
            btn.querySelector('.control-icon').textContent = '🔇';
            btn.querySelector('.control-label').textContent = 'Unmute';
        } else {
            // Now unmuted
            btn.classList.remove('muted');
            btn.querySelector('.control-icon').textContent = '🎤';
            btn.querySelector('.control-label').textContent = 'Mute';
        }
    }
}

function toggleVideo() {
    if (!callObject) return;
    const localVideo = callObject.localVideo();
    callObject.setLocalVideo(!localVideo);

    // Update button UI
    const btn = document.getElementById('toggleVideoBtn');
    if (btn) {
        if (localVideo) {
            // Now video off
            btn.classList.add('video-off');
            btn.querySelector('.control-icon').textContent = '📷';
            btn.querySelector('.control-label').textContent = 'Start Video';
        } else {
            // Now video on
            btn.classList.remove('video-off');
            btn.querySelector('.control-icon').textContent = '📹';
            btn.querySelector('.control-label').textContent = 'Stop Video';
        }
    }
}

// ========================================
// Screen Share
// ========================================
let isScreenSharing = false;

async function toggleDailyScreenShare() {
    if (!callObject) {
        console.log('⚠️ No call object for screen share');
        return false;
    }

    try {
        if (!isScreenSharing) {
            // Start screen share
            console.log('🖥️ Starting screen share...');
            // Set flag BEFORE starting so track detection knows this is a screen share
            isScreenSharing = true;
            await callObject.startScreenShare();
            console.log('✅ Screen share started');
        } else {
            // Stop screen share
            console.log('🖥️ Stopping screen share...');
            await callObject.stopScreenShare();
            isScreenSharing = false;
            console.log('✅ Screen share stopped');
        }
        return isScreenSharing;
    } catch (err) {
        console.error('❌ Screen share error:', err);
        // Reset flag on failure
        isScreenSharing = false;
        // User may have cancelled the browser picker
        if (err.name === 'NotAllowedError') {
            console.log('ℹ️ User cancelled screen share picker');
        }
        return false;
    }
}

// Expose screen share to global scope
window.toggleDailyScreenShare = toggleDailyScreenShare;

// ========================================
// Handle App Messages (for host controls like mute all)
// ========================================
function handleAppMessage(event) {
    console.log('📨 App message received:', event);
    const { data, fromId } = event;

    if (data.type === 'mute_all') {
        // Host requested everyone to mute
        console.log('🔇 Host requested mute all');
        try {
            if (callObject) {
                callObject.setLocalAudio(false);
                localAudio = false;
                // Update button UI - check both possible IDs
                const btn = document.getElementById('toggleMicBtn') || document.getElementById('toggleMuteBtn');
                if (btn) {
                    btn.classList.add('muted');
                    const icon = btn.querySelector('.control-icon');
                    const label = btn.querySelector('.control-label');
                    if (icon) icon.textContent = '🔇';
                    if (label) label.textContent = 'Unmute';
                }
                if (typeof showNotification === 'function') {
                    showNotification('Host muted all participants', 'info');
                }
                console.log('✅ Audio muted by host');
            }
        } catch (e) {
            console.error('❌ Failed to mute:', e);
        }
    } else if (data.type === 'unmute_all') {
        // Host allowed everyone to unmute - ACTUALLY unmute them
        console.log('🔊 Host requested unmute all');
        try {
            if (callObject) {
                callObject.setLocalAudio(true);
                localAudio = true;
                // Update button UI - check both possible IDs
                const btn = document.getElementById('toggleMicBtn') || document.getElementById('toggleMuteBtn');
                if (btn) {
                    btn.classList.remove('muted');
                    const icon = btn.querySelector('.control-icon');
                    const label = btn.querySelector('.control-label');
                    if (icon) icon.textContent = '🎤';
                    if (label) label.textContent = 'Mute';
                }
                if (typeof showNotification === 'function') {
                    showNotification('Host unmuted all participants', 'info');
                }
                console.log('✅ Audio unmuted by host');
            }
        } catch (e) {
            console.error('❌ Failed to unmute:', e);
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

// ========================================
// Debug Functions - Call from console
// ========================================
function debugAudio() {
    console.log('=== AUDIO DEBUG ===');

    if (!callObject) {
        console.log('❌ No call object');
        return;
    }

    const allParticipants = callObject.participants();
    console.log('All participants:', Object.keys(allParticipants));

    Object.entries(allParticipants).forEach(([id, p]) => {
        console.log(`\n👤 ${p.user_name} (${id}, local: ${p.local})`);
        console.log(`   Audio: ${p.audio ? 'ON' : 'OFF'}`);
        console.log(`   Video: ${p.video ? 'ON' : 'OFF'}`);

        if (p.tracks?.audio) {
            const audioTrack = p.tracks.audio;
            console.log(`   Audio track state: ${audioTrack.state}`);
            console.log(`   Audio track subscribed: ${audioTrack.subscribed}`);
            if (audioTrack.track) {
                console.log(`   Track enabled: ${audioTrack.track.enabled}`);
                console.log(`   Track readyState: ${audioTrack.track.readyState}`);
            }
            if (audioTrack.persistentTrack) {
                console.log(`   PersistentTrack enabled: ${audioTrack.persistentTrack.enabled}`);
                console.log(`   PersistentTrack readyState: ${audioTrack.persistentTrack.readyState}`);
            }
        } else {
            console.log(`   ⚠️ No audio track object`);
        }

        // Check audio element - DEEPER inspection
        const audioEl = document.getElementById(`audio-${p.session_id}`);
        if (audioEl) {
            console.log(`   Audio element: found`);
            console.log(`   Audio element paused: ${audioEl.paused}`);
            console.log(`   Audio element muted: ${audioEl.muted}`);
            console.log(`   Audio element volume: ${audioEl.volume}`);
            console.log(`   Audio element srcObject: ${audioEl.srcObject ? 'set' : 'null'}`);

            // DEEPER: Check the actual MediaStream
            if (audioEl.srcObject) {
                const stream = audioEl.srcObject;
                console.log(`   MediaStream active: ${stream.active}`);
                console.log(`   MediaStream id: ${stream.id}`);
                const audioTracks = stream.getAudioTracks();
                console.log(`   MediaStream audio tracks: ${audioTracks.length}`);
                audioTracks.forEach((track, i) => {
                    console.log(`     Track ${i}: enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);
                });
            }
        } else {
            console.log(`   ⚠️ Audio element NOT found`);
        }
    });

    // Check AudioContext state
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`\n🔊 AudioContext state: ${audioCtx.state}`);
        if (audioCtx.state === 'suspended') {
            console.log('⚠️ AudioContext is suspended! Click page to resume.');
        }
        audioCtx.close();
    } catch (e) {
        console.log('Could not check AudioContext:', e);
    }

    console.log('\n=== END AUDIO DEBUG ===');
}

function forcePlayAllAudio() {
    console.log('🔊 Force playing all audio elements...');
    document.querySelectorAll('audio').forEach((audio, i) => {
        console.log(`Audio ${i}: paused=${audio.paused}, muted=${audio.muted}, src=${audio.srcObject ? 'set' : 'null'}`);
        if (audio.srcObject) {
            audio.muted = false;
            audio.volume = 1.0;
            audio.play().then(() => {
                console.log(`✅ Audio ${i} now playing`);
            }).catch(e => {
                console.error(`❌ Audio ${i} failed:`, e);
            });
        }
    });
}

// Fix audio by reattaching tracks from Daily.co
function fixAudio() {
    console.log('🔧 Attempting to fix audio by reattaching tracks...');

    if (!callObject) {
        console.log('❌ No call object');
        return;
    }

    const allParticipants = callObject.participants();

    Object.entries(allParticipants).forEach(([id, p]) => {
        // Skip local participant
        if (p.local) return;

        console.log(`🔧 Fixing audio for: ${p.user_name}`);

        const audioEl = document.getElementById(`audio-${p.session_id}`);
        if (!audioEl) {
            console.log(`   ❌ No audio element found`);
            return;
        }

        // Get the track from Daily
        const audioTrack = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track;

        if (!audioTrack) {
            console.log(`   ❌ No audio track available from Daily`);
            return;
        }

        console.log(`   📡 Got track: enabled=${audioTrack.enabled}, readyState=${audioTrack.readyState}`);

        // Create fresh MediaStream and attach
        const newStream = new MediaStream([audioTrack]);
        console.log(`   📡 New MediaStream: active=${newStream.active}, tracks=${newStream.getAudioTracks().length}`);

        audioEl.srcObject = newStream;
        audioEl.muted = false;
        audioEl.volume = 1.0;

        audioEl.play().then(() => {
            console.log(`   ✅ Audio now playing for ${p.user_name}`);
        }).catch(e => {
            console.error(`   ❌ Play failed:`, e);
        });
    });

    console.log('🔧 Fix audio complete');
}

// Expose debug functions globally
window.debugAudio = debugAudio;
window.forcePlayAllAudio = forcePlayAllAudio;
window.fixAudio = fixAudio;

// Expose toggle controls to global scope for button onclick handlers
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;