class WhiteboardService {
    constructor(wsUrl, sessionId, role) {
        this.wsUrl = wsUrl;
        this.sessionId = sessionId;
        this.role = role;
        this.ws = null;
        this.onDraw = null;
        this.onClear = null;
        this.onImage = null;
        this.onItemUpdate = null;
        this.onToolAccess = null; // New callback for tool access messages
        this.onTriggerKeyboard = null; // New callback for keyboard trigger
        this.onItemSelected = null; // New callback for item selection
        this.onPromptUpdate = null; // New callback for prompt updates from voice input
        this.onTextAdded = null; // New callback for text added to whiteboard
        this.onBucketAdded = null; // New callback for bucket added
        this.onBucketUpdate = null; // New callback for bucket updates
        this.onVideoStateUpdate = null; // New callback for video state synchronization
        this.onMediaControl = null; // New callback for media control events (open/play/pause/seek/page_change/close)
        this.onSessionNotes = null; // New callback for session notes from trainer
        this.onItemRemove = null; // New callback for item removal
        this.onErasePen = null; // New callback for erasing pen strokes
        this.onClearCanvas = null; // New callback for clearing entire canvas
    }

    initialize() {
        console.log('[WhiteboardService] initialize() called');
        console.log('[WhiteboardService] wsUrl:', this.wsUrl);
        console.log('[WhiteboardService] sessionId:', this.sessionId);
        console.log('[WhiteboardService] role:', this.role);

        const wsUrl = this.wsUrl.replace('http', 'ws');
        const fullWsUrl = `${wsUrl}/ws/whiteboard/${this.sessionId}`;
        console.log('[WhiteboardService] Connecting to:', fullWsUrl);

        try {
            this.ws = new WebSocket(fullWsUrl);
            console.log('[WhiteboardService] WebSocket object created');
            this.setupWebSocket();
        } catch (error) {
            console.error('[WhiteboardService] Error creating WebSocket:', error);
        }
    }

    setupWebSocket() {
        console.log('[WhiteboardService] setupWebSocket() called');

        this.ws.onopen = () => {
            console.log('[WhiteboardService] Whiteboard WebSocket connected');
            const joinMessage = {
                type: 'join',
                sessionId: this.sessionId,
                role: this.role
            };
            console.log('[WhiteboardService] Sending join message:', joinMessage);
            this.ws.send(JSON.stringify(joinMessage));
        };

        this.ws.onmessage = (event) => {
            console.log('[WhiteboardService] Received message:', event.data);
            const message = JSON.parse(event.data);
            console.log('[WhiteboardService] Parsed message:', message);

            switch (message.type) {
                case 'draw':
                    console.log('[WhiteboardService] Processing draw event');
                    if (this.onDraw) {
                        this.onDraw(message.data);
                    }
                    break;

                case 'clear':
                    console.log('[WhiteboardService] Processing clear event');
                    if (this.onClear) {
                        this.onClear();
                    }
                    break;

                case 'image':
                    console.log('[WhiteboardService] Processing image event');
                    if (this.onImage) {
                        this.onImage(message.data);
                    }
                    break;

                case 'item_update':
                    console.log('[WhiteboardService] Processing item_update event');
                    if (this.onItemUpdate) {
                        this.onItemUpdate(message.data);
                    }
                    break;

                case 'tool_access':
                    console.log('[WhiteboardService] Processing tool_access event');
                    if (this.onToolAccess) {
                        this.onToolAccess(message.data);
                    }
                    break;

                case 'trigger_keyboard':
                    console.log('[WhiteboardService] Processing trigger_keyboard event');
                    if (this.onTriggerKeyboard) {
                        this.onTriggerKeyboard(message.data);
                    }
                    break;

                case 'item_selected':
                    console.log('[WhiteboardService] Processing item_selected event');
                    if (this.onItemSelected) {
                        this.onItemSelected(message.data);
                    }
                    break;

                case 'prompt_update':
                    console.log('[WhiteboardService] Processing prompt_update event');
                    if (this.onPromptUpdate) {
                        this.onPromptUpdate(message.data);
                    }
                    break;

                case 'text_added':
                    console.log('[WhiteboardService] Processing text_added event');
                    if (this.onTextAdded) {
                        this.onTextAdded(message.data);
                    }
                    break;

                case 'bucket_added':
                    console.log('[WhiteboardService] Processing bucket_added event');
                    if (this.onBucketAdded) {
                        this.onBucketAdded(message.data);
                    }
                    break;

                case 'bucket_update':
                    console.log('[WhiteboardService] Processing bucket_update event');
                    if (this.onBucketUpdate) {
                        // Handle bucket removal
                        if (message.data.removed) {
                            this.onBucketUpdate({ id: message.data.id, removed: true });
                        } else {
                            this.onBucketUpdate(message.data);
                        }
                    }
                    break;

                case 'video_state':
                    console.log('[WhiteboardService] Processing video_state event');
                    if (this.onVideoStateUpdate) {
                        this.onVideoStateUpdate(message.data);
                    }
                    break;

                case 'media_control':
                    console.log('[WhiteboardService] Processing media_control event:', message.data);
                    if (this.onMediaControl) {
                        this.onMediaControl(message.data);
                    }
                    break;

                case 'session_notes':
                    console.log('[WhiteboardService] Processing session_notes event:', message.data);
                    if (this.onSessionNotes) {
                        this.onSessionNotes(message.data);
                    }
                    break;

                case 'item_remove':
                    console.log('[WhiteboardService] Processing item_remove event:', message.data);
                    if (this.onItemRemove) {
                        this.onItemRemove(message.data);
                    }
                    break;

                case 'erase_pen':
                    console.log('[WhiteboardService] Processing erase_pen event');
                    if (this.onErasePen) {
                        this.onErasePen(message.data);
                    }
                    break;

                case 'clear_canvas':
                    console.log('[WhiteboardService] Processing clear_canvas event');
                    if (this.onClearCanvas) {
                        this.onClearCanvas(message.data);
                    }
                    break;

                default:
                    console.log('[WhiteboardService] Unknown message type:', message.type);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[WhiteboardService] Whiteboard WebSocket error:', error);
        };

        this.ws.onclose = (event) => {
            console.log('[WhiteboardService] Whiteboard WebSocket closed - Code:', event.code, 'Reason:', event.reason);
        };
    }

    sendDrawData(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'draw',
                data: data
            }));
        }
    }

    sendClear() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'clear'
            }));
        }
    }

    sendImage(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'image',
                data: data
            }));
        }
    }

    sendItemUpdate(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'item_update',
                data: data
            }));
        }
    }

    // Send video state synchronization
    sendVideoState(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WhiteboardService] Sending video state:', data);
            this.ws.send(JSON.stringify({
                type: 'video_state',
                data: data
            }));
        } else {
            console.warn('[WhiteboardService] Cannot send video state - WebSocket not ready');
        }
    }

    // Send media control event
    sendMediaControl(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log('[WhiteboardService] Sending media_control event:', data);
            this.ws.send(JSON.stringify({
                type: 'media_control',
                data: data
            }));
        } else {
            console.warn('[WhiteboardService] Cannot send media_control - WebSocket not ready');
        }
    }

    // Generic send method for custom message types
    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log(`[WhiteboardService] Sending ${type} message:`, data);
            this.ws.send(JSON.stringify({
                type: type,
                data: data
            }));
        } else {
            console.warn(`[WhiteboardService] Cannot send ${type} - WebSocket not ready`);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

export default WhiteboardService;
