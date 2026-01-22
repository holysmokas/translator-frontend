// ============================================
// Whiteboard Module for Mamnoon.ai
// Real-time collaborative whiteboard with detachable window
// ============================================

const Whiteboard = (function () {
    'use strict';

    // ============================================
    // State
    // ============================================
    let canvas = null;
    let isOpen = false;
    let currentTool = 'pen';
    let currentColor = '#000000';
    let currentWidth = 4;
    let ws = null;
    let isHost = false;
    let collaborativeMode = true;
    let canDraw = true;
    let popoutWindow = null;
    let roomCode = null;

    // Color palette
    const colors = [
        '#000000', // Black
        '#FFFFFF', // White
        '#EF4444', // Red
        '#F59E0B', // Orange
        '#10B981', // Green
        '#3B82F6', // Blue
        '#8B5CF6', // Purple
        '#EC4899', // Pink
    ];

    // Brush sizes
    const brushSizes = [2, 4, 8, 12];

    // History for undo/redo
    let history = [];
    let historyIndex = -1;

    // ============================================
    // Initialize
    // ============================================
    function init(websocket, hostStatus, code) {
        ws = websocket;
        isHost = hostStatus;
        roomCode = code || 'default';
        canDraw = collaborativeMode || isHost;

        createWhiteboardPanel();
        initCanvas();
        bindEvents();
        setupPopoutListener();

        console.log('📋 Whiteboard initialized', { isHost, canDraw, roomCode });
    }

    // ============================================
    // Listen for messages from popout window
    // ============================================
    function setupPopoutListener() {
        window.addEventListener('message', (event) => {
            // Verify origin for security (same origin)
            if (event.origin !== window.location.origin) return;

            const { type, action, data } = event.data || {};
            if (type !== 'whiteboard-popout') return;

            console.log('📋 Message from popout:', action);

            handlePopoutMessage(action, data);
        });
    }

    function handlePopoutMessage(action, data) {
        if (!canvas) return;

        switch (action) {
            case 'draw':
                // Add path to main canvas
                if (data.path) {
                    fabric.util.enlivenObjects([data.path], (objects) => {
                        objects.forEach(obj => canvas.add(obj));
                        canvas.renderAll();
                        saveState();
                    });
                    // Broadcast to other participants
                    broadcastAction('draw', { path: data.path });
                }
                break;

            case 'clear':
                canvas.clear();
                canvas.backgroundColor = '#ffffff';
                canvas.renderAll();
                saveState();
                broadcastAction('clear', {});
                break;

            case 'undo':
                if (historyIndex > 0) {
                    historyIndex--;
                    loadState(history[historyIndex]);
                    broadcastAction('undo', { index: historyIndex });
                }
                break;

            case 'redo':
                if (historyIndex < history.length - 1) {
                    historyIndex++;
                    loadState(history[historyIndex]);
                    broadcastAction('redo', { index: historyIndex });
                }
                break;

            case 'requestState':
                // Send current state to popout
                sendStateToPopout();
                break;

            case 'popoutClosed':
                popoutWindow = null;
                console.log('📋 Popout window closed');
                break;
        }
    }

    function sendStateToPopout() {
        if (!popoutWindow || popoutWindow.closed || !canvas) return;

        popoutWindow.postMessage({
            type: 'whiteboard-main',
            action: 'fullState',
            data: {
                state: JSON.stringify(canvas.toJSON()),
                history: history,
                historyIndex: historyIndex
            }
        }, window.location.origin);
    }

    function sendToPopout(action, data) {
        if (!popoutWindow || popoutWindow.closed) return;

        popoutWindow.postMessage({
            type: 'whiteboard-main',
            action: action,
            data: data
        }, window.location.origin);
    }

    // ============================================
    // Create Whiteboard Panel HTML
    // ============================================
    function createWhiteboardPanel() {
        if (document.getElementById('whiteboardPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'whiteboardPanel';
        panel.className = 'whiteboard-panel';
        panel.innerHTML = `
            <div class="whiteboard-header">
                <div class="whiteboard-title">
                    <span class="whiteboard-icon">📋</span>
                    <span>Whiteboard</span>
                </div>
                <div class="whiteboard-header-actions">
                    <button class="wb-header-btn" onclick="Whiteboard.popOut()" title="Detach whiteboard">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                    <button class="wb-header-btn danger" onclick="Whiteboard.clear()" title="Clear whiteboard">
                        Clear
                    </button>
                    <button class="wb-header-btn" onclick="Whiteboard.close()" title="Close whiteboard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="whiteboard-canvas-container">
                <canvas id="whiteboardCanvas"></canvas>
            </div>
            
            <div class="whiteboard-toolbar">
                <div class="toolbar-section tools">
                    <button class="tool-btn active" data-tool="pen" title="Pen">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                            <path d="M2 2l7.586 7.586"></path>
                        </svg>
                    </button>
                    <button class="tool-btn" data-tool="highlighter" title="Highlighter">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 11l-6 6v3h9l3-3"></path>
                            <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
                        </svg>
                    </button>
                    <button class="tool-btn" data-tool="eraser" title="Eraser">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l6 6c.8.8.8 2 0 2.8L15 19"></path>
                            <path d="M6 11l6 6"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="toolbar-divider"></div>
                
                <div class="toolbar-section colors">
                    ${colors.map(color => `
                        <button class="color-btn ${color === '#000000' ? 'active' : ''}" 
                                data-color="${color}" 
                                style="background-color: ${color}; ${color === '#FFFFFF' ? 'border: 1px solid #ddd;' : ''}"
                                title="${color}">
                        </button>
                    `).join('')}
                </div>
                
                <div class="toolbar-divider"></div>
                
                <div class="toolbar-section sizes">
                    ${brushSizes.map((size, i) => `
                        <button class="size-btn ${i === 1 ? 'active' : ''}" data-size="${size}" title="Size ${size}">
                            <span class="size-dot" style="width: ${size + 4}px; height: ${size + 4}px;"></span>
                        </button>
                    `).join('')}
                </div>
                
                <div class="toolbar-divider"></div>
                
                <div class="toolbar-section actions">
                    <button class="action-btn" onclick="Whiteboard.undo()" title="Undo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 7v6h6"></path>
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="Whiteboard.redo()" title="Redo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 7v6h-6"></path>
                            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="Whiteboard.download()" title="Save as image">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        const mainArea = document.querySelector('.main-area') || document.querySelector('.meeting-content');
        if (mainArea) {
            mainArea.parentNode.insertBefore(panel, mainArea.nextSibling);
        } else {
            document.body.appendChild(panel);
        }
    }

    // ============================================
    // Initialize Canvas
    // ============================================
    function initCanvas() {
        const canvasEl = document.getElementById('whiteboardCanvas');
        if (!canvasEl) return;

        const container = canvasEl.parentElement;
        const rect = container.getBoundingClientRect();

        canvasEl.width = rect.width || 600;
        canvasEl.height = rect.height || 400;

        canvas = new fabric.Canvas('whiteboardCanvas', {
            isDrawingMode: true,
            backgroundColor: '#ffffff',
            selection: false,
        });

        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = currentColor;
        canvas.freeDrawingBrush.width = currentWidth;

        window.addEventListener('resize', handleResize);

        // Handle path creation
        canvas.on('path:created', handlePathCreated);

        // Save initial state
        saveState();
    }

    // ============================================
    // Event Binding
    // ============================================
    function bindEvents() {
        document.querySelectorAll('#whiteboardPanel .tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('#whiteboardPanel .tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setTool(btn.dataset.tool);
            });
        });

        document.querySelectorAll('#whiteboardPanel .color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('#whiteboardPanel .color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setColor(btn.dataset.color);
            });
        });

        document.querySelectorAll('#whiteboardPanel .size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('#whiteboardPanel .size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setSize(parseInt(btn.dataset.size));
            });
        });
    }

    // ============================================
    // Tools
    // ============================================
    function setTool(tool) {
        currentTool = tool;
        if (!canvas) return;

        switch (tool) {
            case 'pen':
                canvas.isDrawingMode = true;
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
                canvas.freeDrawingBrush.color = currentColor;
                canvas.freeDrawingBrush.width = currentWidth;
                break;

            case 'highlighter':
                canvas.isDrawingMode = true;
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
                canvas.freeDrawingBrush.color = hexToRgba(currentColor, 0.4);
                canvas.freeDrawingBrush.width = currentWidth * 3;
                break;

            case 'eraser':
                canvas.isDrawingMode = true;
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
                canvas.freeDrawingBrush.color = '#FFFFFF';
                canvas.freeDrawingBrush.width = currentWidth * 4;
                break;
        }
    }

    function setColor(color) {
        currentColor = color;
        if (canvas && canvas.freeDrawingBrush && currentTool !== 'eraser') {
            if (currentTool === 'highlighter') {
                canvas.freeDrawingBrush.color = hexToRgba(color, 0.4);
            } else {
                canvas.freeDrawingBrush.color = color;
            }
        }
    }

    function setSize(size) {
        currentWidth = size;
        if (canvas && canvas.freeDrawingBrush) {
            if (currentTool === 'highlighter') {
                canvas.freeDrawingBrush.width = size * 3;
            } else if (currentTool === 'eraser') {
                canvas.freeDrawingBrush.width = size * 4;
            } else {
                canvas.freeDrawingBrush.width = size;
            }
        }
    }

    // ============================================
    // History (Undo/Redo)
    // ============================================
    function saveState() {
        if (!canvas) return;

        const state = JSON.stringify(canvas.toJSON());

        // Remove states after current index
        history = history.slice(0, historyIndex + 1);
        history.push(state);
        historyIndex = history.length - 1;

        // Limit history
        if (history.length > 50) {
            history.shift();
            historyIndex--;
        }
    }

    function loadState(state) {
        if (!canvas || !state) return;
        canvas.loadFromJSON(state, () => {
            canvas.renderAll();
        });
    }

    function undo() {
        if (!canvas || historyIndex <= 0) return;
        historyIndex--;
        loadState(history[historyIndex]);

        // Sync to popout and participants
        sendToPopout('undo', { index: historyIndex, state: history[historyIndex] });
        broadcastAction('undo', { index: historyIndex });
    }

    function redo() {
        if (!canvas || historyIndex >= history.length - 1) return;
        historyIndex++;
        loadState(history[historyIndex]);

        // Sync to popout and participants
        sendToPopout('redo', { index: historyIndex, state: history[historyIndex] });
        broadcastAction('redo', { index: historyIndex });
    }

    function clear() {
        if (!canvas) return;
        if (!confirm('Clear the entire whiteboard?')) return;

        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
        saveState();

        // Sync to popout and participants
        sendToPopout('clear', {});
        broadcastAction('clear', {});
    }

    function download() {
        if (!canvas) return;

        const dataURL = canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 2
        });

        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    }

    // ============================================
    // Drawing & Broadcasting
    // ============================================
    function handlePathCreated(e) {
        if (!canDraw) return;

        const pathData = e.path.toJSON();

        // Sync to popout window
        sendToPopout('draw', { path: pathData });

        // Sync to other participants
        broadcastAction('draw', { path: pathData });

        saveState();
    }

    function broadcastAction(action, data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({
            type: 'whiteboard',
            action: action,
            data: data
        }));
    }

    // Handle actions from other participants (via WebSocket)
    function handleRemoteAction(message) {
        if (!canvas) return;

        const { action, data } = message;

        switch (action) {
            case 'draw':
                if (data.path) {
                    fabric.util.enlivenObjects([data.path], (objects) => {
                        objects.forEach(obj => canvas.add(obj));
                        canvas.renderAll();
                        saveState();
                    });
                    // Also sync to popout
                    sendToPopout('draw', { path: data.path });
                }
                break;

            case 'clear':
                canvas.clear();
                canvas.backgroundColor = '#ffffff';
                canvas.renderAll();
                saveState();
                sendToPopout('clear', {});
                break;

            case 'undo':
                if (data.index >= 0 && data.index < history.length) {
                    historyIndex = data.index;
                    loadState(history[historyIndex]);
                    sendToPopout('undo', { index: historyIndex, state: history[historyIndex] });
                }
                break;

            case 'redo':
                if (data.index >= 0 && data.index < history.length) {
                    historyIndex = data.index;
                    loadState(history[historyIndex]);
                    sendToPopout('redo', { index: historyIndex, state: history[historyIndex] });
                }
                break;

            case 'fullState':
                if (data.state) {
                    loadState(data.state);
                    history = data.history || [data.state];
                    historyIndex = history.length - 1;
                    sendToPopout('fullState', data);
                }
                break;

            case 'requestState':
                sendFullState(message.user_id);
                break;
        }
    }

    function requestFullState() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'whiteboard',
                action: 'requestState'
            }));
        }
    }

    function sendFullState(targetUserId) {
        if (!canvas || !isHost) return;

        const state = JSON.stringify(canvas.toJSON());

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'whiteboard',
                action: 'fullState',
                targetUser: targetUserId,
                data: {
                    state: state,
                    history: history
                }
            }));
        }
    }

    // ============================================
    // Panel Controls
    // ============================================
    function open() {
        const panel = document.getElementById('whiteboardPanel');
        if (!panel) return;

        panel.classList.add('open');
        isOpen = true;

        const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.classList.add('whiteboard-open');
        }

        setTimeout(handleResize, 350);

        if (!isHost) {
            requestFullState();
        }

        console.log('📋 Whiteboard opened');
    }

    function close() {
        const panel = document.getElementById('whiteboardPanel');
        if (!panel) return;

        panel.classList.remove('open');
        isOpen = false;

        const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.classList.remove('whiteboard-open');
        }

        console.log('📋 Whiteboard closed');
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    // ============================================
    // Pop-out Window (Interactive!)
    // ============================================
    function popOut() {
        // Focus existing window if open
        if (popoutWindow && !popoutWindow.closed) {
            popoutWindow.focus();
            return;
        }

        const popupWidth = 900;
        const popupHeight = 700;
        const left = (screen.width - popupWidth) / 2;
        const top = (screen.height - popupHeight) / 2;

        popoutWindow = window.open('', 'mamnoon-whiteboard',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes`);

        if (!popoutWindow) {
            alert('Please allow popups to detach the whiteboard');
            return;
        }

        // Get current state
        const currentState = canvas ? JSON.stringify(canvas.toJSON()) : '{}';
        const originUrl = window.location.origin;

        popoutWindow.document.write(getPopoutHTML(currentState, originUrl));
        popoutWindow.document.close();

        console.log('📋 Whiteboard detached to new window');
    }

    function getPopoutHTML(initialState, originUrl) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Mamnoon Whiteboard</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5; 
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .whiteboard-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0;
        }
        
        .whiteboard-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 15px;
            color: #333;
        }
        
        .sync-status {
            font-size: 12px;
            color: #10b981;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .sync-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .whiteboard-header-actions {
            display: flex;
            gap: 8px;
        }
        
        .wb-header-btn {
            background: #f3f4f6;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            font-size: 13px;
            transition: all 0.2s;
        }
        
        .wb-header-btn:hover {
            background: #e5e7eb;
            color: #333;
        }
        
        .wb-header-btn.danger:hover {
            background: #fee2e2;
            color: #dc2626;
        }
        
        .whiteboard-canvas-container {
            flex: 1;
            background: #e5e7eb;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            min-height: 0;
        }
        
        .whiteboard-canvas-container canvas {
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .whiteboard-toolbar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #ffffff;
            border-top: 1px solid #e5e7eb;
            flex-wrap: wrap;
            flex-shrink: 0;
        }
        
        .toolbar-section {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .toolbar-divider {
            width: 1px;
            height: 28px;
            background: #e5e7eb;
            margin: 0 4px;
        }
        
        .tool-btn, .action-btn {
            width: 40px;
            height: 40px;
            border: none;
            background: #f3f4f6;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #555;
            transition: all 0.2s;
        }
        
        .tool-btn:hover, .action-btn:hover {
            background: #e5e7eb;
            color: #333;
        }
        
        .tool-btn.active {
            background: #6366f1;
            color: white;
        }
        
        .color-btn {
            width: 28px;
            height: 28px;
            border: 2px solid transparent;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.2s, border-color 0.2s;
        }
        
        .color-btn:hover {
            transform: scale(1.15);
        }
        
        .color-btn.active {
            border-color: #6366f1;
            transform: scale(1.15);
        }
        
        .size-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: #f3f4f6;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .size-btn:hover {
            background: #e5e7eb;
        }
        
        .size-btn.active {
            background: #e0e7ff;
            border: 1px solid #6366f1;
        }
        
        .size-dot {
            background: #333;
            border-radius: 50%;
        }
    </style>
</head>
<body>
    <div class="whiteboard-header">
        <div class="whiteboard-title">
            <span>📋</span>
            <span>Whiteboard</span>
            <div class="sync-status">
                <span class="sync-dot"></span>
                <span>Synced</span>
            </div>
        </div>
        <div class="whiteboard-header-actions">
            <button class="wb-header-btn danger" onclick="clearCanvas()">Clear</button>
        </div>
    </div>
    
    <div class="whiteboard-canvas-container">
        <canvas id="whiteboardCanvas"></canvas>
    </div>
    
    <div class="whiteboard-toolbar">
        <div class="toolbar-section tools">
            <button class="tool-btn active" data-tool="pen" title="Pen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                </svg>
            </button>
            <button class="tool-btn" data-tool="highlighter" title="Highlighter">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l-6 6v3h9l3-3"></path>
                    <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
                </svg>
            </button>
            <button class="tool-btn" data-tool="eraser" title="Eraser">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8l10-10c.8-.8 2-.8 2.8 0l6 6c.8.8.8 2 0 2.8L15 19"></path>
                </svg>
            </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-section colors">
            <button class="color-btn active" data-color="#000000" style="background:#000000"></button>
            <button class="color-btn" data-color="#FFFFFF" style="background:#FFFFFF;border:1px solid #ddd"></button>
            <button class="color-btn" data-color="#EF4444" style="background:#EF4444"></button>
            <button class="color-btn" data-color="#F59E0B" style="background:#F59E0B"></button>
            <button class="color-btn" data-color="#10B981" style="background:#10B981"></button>
            <button class="color-btn" data-color="#3B82F6" style="background:#3B82F6"></button>
            <button class="color-btn" data-color="#8B5CF6" style="background:#8B5CF6"></button>
            <button class="color-btn" data-color="#EC4899" style="background:#EC4899"></button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-section sizes">
            <button class="size-btn" data-size="2"><span class="size-dot" style="width:6px;height:6px"></span></button>
            <button class="size-btn active" data-size="4"><span class="size-dot" style="width:8px;height:8px"></span></button>
            <button class="size-btn" data-size="8"><span class="size-dot" style="width:12px;height:12px"></span></button>
            <button class="size-btn" data-size="12"><span class="size-dot" style="width:16px;height:16px"></span></button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-section actions">
            <button class="action-btn" onclick="undo()" title="Undo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7v6h6"></path>
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                </svg>
            </button>
            <button class="action-btn" onclick="redo()" title="Redo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 7v6h-6"></path>
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
                </svg>
            </button>
            <button class="action-btn" onclick="download()" title="Save as image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
        </div>
    </div>
    
    <script>
        // Popout Whiteboard Script
        const ORIGIN = '${originUrl}';
        let canvas = null;
        let currentTool = 'pen';
        let currentColor = '#000000';
        let currentWidth = 4;
        let history = [];
        let historyIndex = -1;
        let ignoreNextPathCreated = false;
        
        // Initialize
        function init() {
            initCanvas();
            bindEvents();
            setupMessageListener();
            
            // Load initial state
            const initialState = ${initialState};
            if (initialState && Object.keys(initialState).length > 0) {
                setTimeout(() => {
                    canvas.loadFromJSON(initialState, () => {
                        canvas.renderAll();
                        saveState();
                    });
                }, 100);
            }
            
            // Request latest state from main window
            setTimeout(() => sendToMain('requestState', {}), 300);
            
            // Notify main window when closing
            window.addEventListener('beforeunload', () => {
                sendToMain('popoutClosed', {});
            });
        }
        
        function initCanvas() {
            const container = document.querySelector('.whiteboard-canvas-container');
            const canvasEl = document.getElementById('whiteboardCanvas');
            
            const width = container.clientWidth - 32;
            const height = container.clientHeight - 32;
            
            canvasEl.width = width;
            canvasEl.height = height;
            
            canvas = new fabric.Canvas('whiteboardCanvas', {
                isDrawingMode: true,
                backgroundColor: '#ffffff',
                selection: false,
            });
            
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = currentColor;
            canvas.freeDrawingBrush.width = currentWidth;
            
            canvas.on('path:created', handlePathCreated);
            
            window.addEventListener('resize', handleResize);
            
            saveState();
        }
        
        function handleResize() {
            const container = document.querySelector('.whiteboard-canvas-container');
            const width = container.clientWidth - 32;
            const height = container.clientHeight - 32;
            canvas.setWidth(width);
            canvas.setHeight(height);
            canvas.renderAll();
        }
        
        function bindEvents() {
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    setTool(btn.dataset.tool);
                });
            });
            
            document.querySelectorAll('.color-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    setColor(btn.dataset.color);
                });
            });
            
            document.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    setSize(parseInt(btn.dataset.size));
                });
            });
        }
        
        // Communication with main window
        function sendToMain(action, data) {
            if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                    type: 'whiteboard-popout',
                    action: action,
                    data: data
                }, ORIGIN);
            }
        }
        
        function setupMessageListener() {
            window.addEventListener('message', (event) => {
                if (event.origin !== ORIGIN) return;
                
                const { type, action, data } = event.data || {};
                if (type !== 'whiteboard-main') return;
                
                console.log('📋 Popout received:', action);
                handleMainMessage(action, data);
            });
        }
        
        function handleMainMessage(action, data) {
            if (!canvas) return;
            
            switch (action) {
                case 'draw':
                    if (data.path) {
                        ignoreNextPathCreated = true;
                        fabric.util.enlivenObjects([data.path], (objects) => {
                            objects.forEach(obj => canvas.add(obj));
                            canvas.renderAll();
                            saveState();
                            ignoreNextPathCreated = false;
                        });
                    }
                    break;
                    
                case 'clear':
                    canvas.clear();
                    canvas.backgroundColor = '#ffffff';
                    canvas.renderAll();
                    saveState();
                    break;
                    
                case 'undo':
                case 'redo':
                    if (data.state) {
                        canvas.loadFromJSON(data.state, () => canvas.renderAll());
                        if (typeof data.index === 'number') {
                            historyIndex = data.index;
                        }
                    }
                    break;
                    
                case 'fullState':
                    if (data.state) {
                        canvas.loadFromJSON(data.state, () => {
                            canvas.renderAll();
                            if (data.history) {
                                history = data.history;
                                historyIndex = data.historyIndex || history.length - 1;
                            }
                        });
                    }
                    break;
            }
        }
        
        // Tools
        function setTool(tool) {
            currentTool = tool;
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            
            if (tool === 'pen') {
                canvas.freeDrawingBrush.color = currentColor;
                canvas.freeDrawingBrush.width = currentWidth;
            } else if (tool === 'highlighter') {
                canvas.freeDrawingBrush.color = hexToRgba(currentColor, 0.4);
                canvas.freeDrawingBrush.width = currentWidth * 3;
            } else if (tool === 'eraser') {
                canvas.freeDrawingBrush.color = '#FFFFFF';
                canvas.freeDrawingBrush.width = currentWidth * 4;
            }
        }
        
        function setColor(color) {
            currentColor = color;
            if (canvas.freeDrawingBrush && currentTool !== 'eraser') {
                if (currentTool === 'highlighter') {
                    canvas.freeDrawingBrush.color = hexToRgba(color, 0.4);
                } else {
                    canvas.freeDrawingBrush.color = color;
                }
            }
        }
        
        function setSize(size) {
            currentWidth = size;
            if (canvas.freeDrawingBrush) {
                if (currentTool === 'highlighter') {
                    canvas.freeDrawingBrush.width = size * 3;
                } else if (currentTool === 'eraser') {
                    canvas.freeDrawingBrush.width = size * 4;
                } else {
                    canvas.freeDrawingBrush.width = size;
                }
            }
        }
        
        function hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
        }
        
        // Drawing
        function handlePathCreated(e) {
            if (ignoreNextPathCreated) return;
            
            const pathData = e.path.toJSON();
            sendToMain('draw', { path: pathData });
            saveState();
        }
        
        // History
        function saveState() {
            const state = JSON.stringify(canvas.toJSON());
            history = history.slice(0, historyIndex + 1);
            history.push(state);
            historyIndex = history.length - 1;
            if (history.length > 50) {
                history.shift();
                historyIndex--;
            }
        }
        
        function undo() {
            if (historyIndex <= 0) return;
            historyIndex--;
            canvas.loadFromJSON(history[historyIndex], () => canvas.renderAll());
            sendToMain('undo', {});
        }
        
        function redo() {
            if (historyIndex >= history.length - 1) return;
            historyIndex++;
            canvas.loadFromJSON(history[historyIndex], () => canvas.renderAll());
            sendToMain('redo', {});
        }
        
        function clearCanvas() {
            if (!confirm('Clear the entire whiteboard?')) return;
            canvas.clear();
            canvas.backgroundColor = '#ffffff';
            canvas.renderAll();
            saveState();
            sendToMain('clear', {});
        }
        
        function download() {
            const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
            const link = document.createElement('a');
            link.download = 'whiteboard-' + Date.now() + '.png';
            link.href = dataURL;
            link.click();
        }
        
        // Start
        init();
    <\/script>
</body>
</html>`;
    }

    // ============================================
    // Utilities
    // ============================================
    function handleResize() {
        if (!canvas) return;

        const container = document.querySelector('.whiteboard-canvas-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        canvas.setWidth(rect.width);
        canvas.setHeight(rect.height);
        canvas.renderAll();
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function setCollaborativeMode(enabled) {
        collaborativeMode = enabled;
        canDraw = collaborativeMode || isHost;

        const toolbar = document.querySelector('.whiteboard-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('locked', !canDraw);
        }
    }

    function cleanup() {
        if (popoutWindow && !popoutWindow.closed) {
            popoutWindow.close();
        }
        popoutWindow = null;
    }

    // ============================================
    // Public API
    // ============================================
    return {
        init,
        open,
        close,
        toggle,
        popOut,
        undo,
        redo,
        clear,
        download,
        handleRemoteAction,
        sendFullState,
        setCollaborativeMode,
        cleanup,
        isOpen: () => isOpen
    };
})();

// Make globally available
window.Whiteboard = Whiteboard;