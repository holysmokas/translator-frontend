// ============================================
// Whiteboard Module for Mamnoon.ai
// Real-time collaborative whiteboard
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
    let currentWidth = 3;
    let isDrawing = false;
    let ws = null;
    let isHost = false;
    let collaborativeMode = true; // If false, only host can draw
    let canDraw = true;

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

    // ============================================
    // Initialize
    // ============================================
    function init(websocket, hostStatus) {
        ws = websocket;
        isHost = hostStatus;
        canDraw = collaborativeMode || isHost;

        createWhiteboardPanel();
        initCanvas();
        bindEvents();

        console.log('📋 Whiteboard initialized', { isHost, canDraw });
    }

    // ============================================
    // Create Whiteboard Panel HTML
    // ============================================
    function createWhiteboardPanel() {
        // Check if already exists
        if (document.getElementById('whiteboardPanel')) {
            return;
        }

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

        // Insert into meeting layout
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

        // Set canvas size
        canvasEl.width = rect.width || 600;
        canvasEl.height = rect.height || 400;

        // Initialize Fabric.js canvas
        canvas = new fabric.Canvas('whiteboardCanvas', {
            isDrawingMode: true,
            backgroundColor: '#ffffff',
            selection: false,
        });

        // Set initial brush
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = currentColor;
        canvas.freeDrawingBrush.width = currentWidth;

        // Handle resize
        window.addEventListener('resize', handleResize);

        // Handle drawing events for sync
        canvas.on('path:created', handlePathCreated);
        canvas.on('object:modified', handleObjectModified);
    }

    // ============================================
    // Event Binding
    // ============================================
    function bindEvents() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setTool(btn.dataset.tool);
            });
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setColor(btn.dataset.color);
            });
        });

        // Size buttons
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!canDraw) return;
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
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
                // Semi-transparent version of current color
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
    // Actions
    // ============================================
    let history = [];
    let historyIndex = -1;

    function undo() {
        if (!canvas || historyIndex <= 0) return;
        historyIndex--;
        loadState(history[historyIndex]);
        broadcastAction('undo', { index: historyIndex });
    }

    function redo() {
        if (!canvas || historyIndex >= history.length - 1) return;
        historyIndex++;
        loadState(history[historyIndex]);
        broadcastAction('redo', { index: historyIndex });
    }

    function clear() {
        if (!canvas) return;

        if (confirm('Clear the entire whiteboard?')) {
            canvas.clear();
            canvas.backgroundColor = '#ffffff';
            canvas.renderAll();
            saveState();
            broadcastAction('clear', {});
        }
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

    function saveState() {
        if (!canvas) return;

        const state = JSON.stringify(canvas.toJSON());

        // Remove any redo states
        history = history.slice(0, historyIndex + 1);
        history.push(state);
        historyIndex = history.length - 1;

        // Limit history size
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

    // ============================================
    // WebSocket Sync
    // ============================================
    function handlePathCreated(e) {
        if (!ws || !canDraw) return;

        const pathData = e.path.toJSON();
        broadcastAction('draw', { path: pathData });
        saveState();
    }

    function handleObjectModified(e) {
        if (!ws || !canDraw) return;

        const objData = e.target.toJSON();
        broadcastAction('modify', { object: objData });
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

    function handleRemoteAction(message) {
        if (!canvas) return;

        const { action, data } = message;

        switch (action) {
            case 'draw':
                if (data.path) {
                    fabric.util.enlivenObjects([data.path], (objects) => {
                        objects.forEach(obj => {
                            canvas.add(obj);
                        });
                        canvas.renderAll();
                        saveState();
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
                if (data.index >= 0 && data.index < history.length) {
                    historyIndex = data.index;
                    loadState(history[historyIndex]);
                }
                break;

            case 'redo':
                if (data.index >= 0 && data.index < history.length) {
                    historyIndex = data.index;
                    loadState(history[historyIndex]);
                }
                break;

            case 'fullState':
                // Load complete state from host
                if (data.state) {
                    loadState(data.state);
                    history = data.history || [data.state];
                    historyIndex = history.length - 1;
                }
                break;
        }
    }

    // Request full state when joining
    function requestFullState() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'whiteboard',
                action: 'requestState'
            }));
        }
    }

    // Send full state (host only)
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

        // Adjust main area
        const mainArea = document.querySelector('.main-area');
        if (mainArea) {
            mainArea.classList.add('whiteboard-open');
        }

        // Resize canvas after animation
        setTimeout(handleResize, 350);

        // Request state if joining existing session
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

        // Restore main area
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

    function popOut() {
        if (!canvas) return;

        const state = JSON.stringify(canvas.toJSON());
        const popup = window.open('', 'whiteboard', 'width=900,height=700');

        popup.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Mamnoon Whiteboard</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
                <style>
                    body { margin: 0; padding: 20px; background: #f5f5f5; font-family: system-ui; }
                    h1 { margin: 0 0 20px; font-size: 18px; color: #333; }
                    canvas { border: 1px solid #ddd; border-radius: 8px; }
                </style>
            </head>
            <body>
                <h1>📋 Whiteboard (View Only)</h1>
                <canvas id="popupCanvas" width="850" height="550"></canvas>
                <script>
                    const canvas = new fabric.Canvas('popupCanvas', { backgroundColor: '#fff' });
                    canvas.loadFromJSON(${state}, () => canvas.renderAll());
                </script>
            </body>
            </html>
        `);
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

        // Update UI to show locked state
        const toolbar = document.querySelector('.whiteboard-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('locked', !canDraw);
        }
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
        isOpen: () => isOpen
    };
})();

// Make globally available
window.Whiteboard = Whiteboard;