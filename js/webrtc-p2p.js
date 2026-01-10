// ========================================
// WebRTC P2P Video - Mamnoon.ai
// ========================================
// Handles 2-person video calls without Daily.co
// Uses STUN/TURN for NAT traversal
// ========================================

const WebRTCP2P = (function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const ICE_SERVERS = [
        // Free Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Metered.ca free TURN (50GB/month free)
        // Sign up at https://www.metered.ca/ and replace with your credentials
        {
            urls: 'turn:a.relay.metered.ca:80',
            username: 'd6900d6ee48e0b2376a913e9',
            credential: 'z+msMrPEVLxX0Qeo'
        },
        {
            urls: 'turn:a.relay.metered.ca:443',
            username: 'd6900d6ee48e0b2376a913e9',
            credential: 'z+msMrPEVLxX0Qeo'
        },
        {
            urls: 'turn:a.relay.metered.ca:443?transport=tcp',
            username: 'd6900d6ee48e0b2376a913e9',
            credential: 'z+msMrPEVLxX0Qeo'
        }
    ];

    const MEDIA_CONSTRAINTS = {
        video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };

    // ========================================
    // State
    // ========================================
    let localStream = null;
    let peerConnection = null;
    let remoteStream = null;
    let isInitiator = false;
    let websocket = null;
    let roomCode = null;
    let userId = null;
    let userName = null;
    let remoteUserId = null;
    let remoteUserName = null;
    let videoGrid = null;
    let onParticipantJoined = null;
    let onParticipantLeft = null;
    let iceCandidatesQueue = [];
    let isNegotiating = false;

    // ========================================
    // Initialization
    // ========================================
    
    async function init(options) {
        console.log('🎥 P2P WebRTC initializing...');
        
        roomCode = options.roomCode;
        userId = options.userId;
        userName = options.userName;
        websocket = options.websocket;
        videoGrid = options.videoGrid || document.getElementById('videoGrid');
        onParticipantJoined = options.onParticipantJoined || (() => {});
        onParticipantLeft = options.onParticipantLeft || (() => {});

        // Get local media
        try {
            localStream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
            console.log('✅ Got local media stream');
            
            // Create local video tile
            createVideoTile('local', userId, userName, localStream, true);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to get media:', error);
            handleMediaError(error);
            return false;
        }
    }

    function handleMediaError(error) {
        let message = 'Could not access camera/microphone';
        
        if (error.name === 'NotAllowedError') {
            message = 'Camera/microphone permission denied. Please allow access and refresh.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera or microphone found.';
        } else if (error.name === 'NotReadableError') {
            message = 'Camera/microphone is in use by another application.';
        }
        
        if (typeof showNotification === 'function') {
            showNotification(message, 'error');
        } else {
            alert(message);
        }
    }

    // ========================================
    // Peer Connection
    // ========================================

    function createPeerConnection() {
        if (peerConnection) {
            console.log('⚠️ Peer connection already exists');
            return peerConnection;
        }

        console.log('🔗 Creating peer connection...');
        
        const config = {
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 10
        };

        peerConnection = new RTCPeerConnection(config);

        // Add local tracks to connection
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('📤 Adding local track:', track.kind);
                peerConnection.addTrack(track, localStream);
            });
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 Sending ICE candidate');
                sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 ICE state:', peerConnection.iceConnectionState);
            
            if (peerConnection.iceConnectionState === 'connected') {
                console.log('✅ P2P connection established!');
            } else if (peerConnection.iceConnectionState === 'failed') {
                console.log('❌ ICE connection failed, attempting restart...');
                restartIce();
            } else if (peerConnection.iceConnectionState === 'disconnected') {
                console.log('⚠️ Peer disconnected');
            }
        };

        // Handle negotiation needed
        peerConnection.onnegotiationneeded = async () => {
            if (isNegotiating) return;
            isNegotiating = true;
            
            try {
                if (isInitiator) {
                    console.log('📝 Creating offer (negotiation needed)');
                    await createAndSendOffer();
                }
            } catch (error) {
                console.error('❌ Negotiation error:', error);
            } finally {
                isNegotiating = false;
            }
        };

        // Handle remote tracks
        peerConnection.ontrack = (event) => {
            console.log('📥 Received remote track:', event.track.kind);
            
            if (!remoteStream) {
                remoteStream = new MediaStream();
            }
            
            remoteStream.addTrack(event.track);
            
            // Create or update remote video tile
            if (remoteUserId) {
                createVideoTile('remote', remoteUserId, remoteUserName || 'Guest', remoteStream, false);
            }
        };

        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log('🔌 Connection state:', peerConnection.connectionState);
            
            if (peerConnection.connectionState === 'failed') {
                console.log('❌ Connection failed');
            }
        };

        return peerConnection;
    }

    async function createAndSendOffer() {
        if (!peerConnection) return;
        
        try {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await peerConnection.setLocalDescription(offer);
            console.log('📤 Sending offer');
            
            sendSignal({
                type: 'offer',
                sdp: offer
            });
        } catch (error) {
            console.error('❌ Error creating offer:', error);
        }
    }

    async function handleOffer(offer, fromUserId, fromUserName) {
        console.log('📥 Received offer from:', fromUserName);
        
        remoteUserId = fromUserId;
        remoteUserName = fromUserName;
        
        if (!peerConnection) {
            createPeerConnection();
        }
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Process queued ICE candidates
            await processIceCandidateQueue();
            
            // Create and send answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            console.log('📤 Sending answer');
            sendSignal({
                type: 'answer',
                sdp: answer
            });
            
            onParticipantJoined(fromUserId, fromUserName);
            
        } catch (error) {
            console.error('❌ Error handling offer:', error);
        }
    }

    async function handleAnswer(answer) {
        console.log('📥 Received answer');
        
        if (!peerConnection) return;
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Process queued ICE candidates
            await processIceCandidateQueue();
            
        } catch (error) {
            console.error('❌ Error handling answer:', error);
        }
    }

    async function handleIceCandidate(candidate) {
        if (!peerConnection) {
            console.log('⏳ Queuing ICE candidate');
            iceCandidatesQueue.push(candidate);
            return;
        }
        
        if (!peerConnection.remoteDescription) {
            console.log('⏳ Queuing ICE candidate (no remote description yet)');
            iceCandidatesQueue.push(candidate);
            return;
        }
        
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('🧊 Added ICE candidate');
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    }

    async function processIceCandidateQueue() {
        console.log(`🧊 Processing ${iceCandidatesQueue.length} queued ICE candidates`);
        
        while (iceCandidatesQueue.length > 0) {
            const candidate = iceCandidatesQueue.shift();
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('❌ Error processing queued ICE candidate:', error);
            }
        }
    }

    async function restartIce() {
        if (!peerConnection || !isInitiator) return;
        
        console.log('🔄 Restarting ICE...');
        
        try {
            const offer = await peerConnection.createOffer({ iceRestart: true });
            await peerConnection.setLocalDescription(offer);
            
            sendSignal({
                type: 'offer',
                sdp: offer
            });
        } catch (error) {
            console.error('❌ ICE restart failed:', error);
        }
    }

    // ========================================
    // Signaling
    // ========================================

    function sendSignal(data) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket not connected');
            return;
        }
        
        websocket.send(JSON.stringify({
            type: 'webrtc_signal',
            signal: data,
            from_user_id: userId,
            from_user_name: userName
        }));
    }

    function handleSignal(message) {
        const signal = message.signal;
        const fromUserId = message.from_user_id;
        const fromUserName = message.from_user_name;
        
        console.log('📨 Received signal:', signal.type, 'from:', fromUserName);
        
        switch (signal.type) {
            case 'offer':
                handleOffer(signal.sdp, fromUserId, fromUserName);
                break;
            case 'answer':
                handleAnswer(signal.sdp);
                break;
            case 'ice-candidate':
                handleIceCandidate(signal.candidate);
                break;
            default:
                console.log('⚠️ Unknown signal type:', signal.type);
        }
    }

    // ========================================
    // Peer Management
    // ========================================

    function startCall(remoteId, remoteName) {
        console.log('📞 Starting call with:', remoteName);
        
        remoteUserId = remoteId;
        remoteUserName = remoteName;
        isInitiator = true;
        
        createPeerConnection();
        createAndSendOffer();
        
        onParticipantJoined(remoteId, remoteName);
    }

    function handlePeerJoined(peerId, peerName) {
        console.log('👤 Peer joined:', peerName);
        
        // If we're already here, we become the initiator
        if (!peerConnection && !remoteUserId) {
            startCall(peerId, peerName);
        }
    }

    function handlePeerLeft(peerId) {
        console.log('👋 Peer left:', peerId);
        
        // Remove remote video tile
        removeVideoTile('remote');
        
        // Clean up peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        remoteStream = null;
        remoteUserId = null;
        remoteUserName = null;
        isInitiator = false;
        iceCandidatesQueue = [];
        
        onParticipantLeft(peerId);
    }

    // ========================================
    // Video UI
    // ========================================

    function createVideoTile(type, oderId, name, stream, isLocal) {
        if (!videoGrid) return;
        
        const tileId = `video-tile-${type}`;
        
        // Remove existing tile
        const existingTile = document.getElementById(tileId);
        if (existingTile) {
            existingTile.remove();
        }
        
        const tile = document.createElement('div');
        tile.id = tileId;
        tile.className = 'video-tile p2p-tile';
        if (isLocal) tile.classList.add('local');
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = isLocal; // Mute local to prevent feedback
        video.srcObject = stream;
        
        const nameLabel = document.createElement('div');
        nameLabel.className = 'participant-name';
        nameLabel.textContent = isLocal ? `${name} (You)` : name;
        
        // Status indicators
        const indicators = document.createElement('div');
        indicators.className = 'video-indicators';
        indicators.innerHTML = `
            <span class="indicator mic-indicator" title="Microphone">🎤</span>
            <span class="indicator cam-indicator" title="Camera">📹</span>
        `;
        
        tile.appendChild(video);
        tile.appendChild(nameLabel);
        tile.appendChild(indicators);
        
        // Add to grid (local first)
        if (isLocal) {
            videoGrid.insertBefore(tile, videoGrid.firstChild);
        } else {
            videoGrid.appendChild(tile);
        }
        
        // Play video
        video.play().catch(e => console.log('Video play error:', e));
        
        console.log(`✅ Created ${type} video tile for ${name}`);
        
        updateGridLayout();
    }

    function removeVideoTile(type) {
        const tileId = `video-tile-${type}`;
        const tile = document.getElementById(tileId);
        
        if (tile) {
            tile.remove();
            console.log(`🗑️ Removed ${type} video tile`);
            updateGridLayout();
        }
    }

    function updateGridLayout() {
        if (!videoGrid) return;
        
        const tiles = videoGrid.querySelectorAll('.video-tile');
        const count = tiles.length;
        
        videoGrid.className = 'video-grid';
        
        if (count === 1) {
            videoGrid.classList.add('single');
        } else if (count === 2) {
            videoGrid.classList.add('duo');
        }
    }

    // ========================================
    // Media Controls
    // ========================================

    function toggleAudio() {
        if (!localStream) return false;
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            console.log('🎤 Microphone:', audioTrack.enabled ? 'ON' : 'OFF');
            
            updateLocalIndicator('mic', audioTrack.enabled);
            
            return audioTrack.enabled;
        }
        return false;
    }

    function toggleVideo() {
        if (!localStream) return false;
        
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            console.log('📹 Camera:', videoTrack.enabled ? 'ON' : 'OFF');
            
            updateLocalIndicator('cam', videoTrack.enabled);
            
            return videoTrack.enabled;
        }
        return false;
    }

    function updateLocalIndicator(type, enabled) {
        const localTile = document.getElementById('video-tile-local');
        if (!localTile) return;
        
        const indicator = localTile.querySelector(`.${type}-indicator`);
        if (indicator) {
            indicator.style.opacity = enabled ? '1' : '0.3';
            indicator.style.textDecoration = enabled ? 'none' : 'line-through';
        }
    }

    function isAudioEnabled() {
        if (!localStream) return false;
        const audioTrack = localStream.getAudioTracks()[0];
        return audioTrack ? audioTrack.enabled : false;
    }

    function isVideoEnabled() {
        if (!localStream) return false;
        const videoTrack = localStream.getVideoTracks()[0];
        return videoTrack ? videoTrack.enabled : false;
    }

    // ========================================
    // Cleanup
    // ========================================

    function cleanup() {
        console.log('🧹 Cleaning up P2P WebRTC...');
        
        // Close peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Clear remote stream
        remoteStream = null;
        
        // Remove video tiles
        removeVideoTile('local');
        removeVideoTile('remote');
        
        // Reset state
        isInitiator = false;
        remoteUserId = null;
        remoteUserName = null;
        iceCandidatesQueue = [];
        isNegotiating = false;
        
        console.log('✅ P2P cleanup complete');
    }

    // ========================================
    // Public API
    // ========================================

    return {
        init,
        handleSignal,
        handlePeerJoined,
        handlePeerLeft,
        startCall,
        toggleAudio,
        toggleVideo,
        isAudioEnabled,
        isVideoEnabled,
        cleanup,
        
        // Expose for debugging
        getState: () => ({
            hasLocalStream: !!localStream,
            hasPeerConnection: !!peerConnection,
            hasRemoteStream: !!remoteStream,
            isInitiator,
            connectionState: peerConnection?.connectionState,
            iceState: peerConnection?.iceConnectionState
        })
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebRTCP2P;
}