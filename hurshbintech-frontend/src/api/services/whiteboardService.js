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
        this.onItemRemove = null; // New callback for item removal
        this.onErasePen = null; // New callback for erasing pen strokes
        this.onClearCanvas = null; // New callback for clearing entire canvas
        this.onStopwatchSync = null; // New callback for stopwatch synchronization
        this.onFeedbackMessage = null; // New callback for feedback messages
        this.onWaitingMessage = null; // New callback for waiting messages
        this.onFloatingAnimations = null; // New callback for floating animations (bubbles, smileys, balloons, stars)
        this.onAnimationPopped = null; // New callback for animation pop events
        this.onTextBoxAdded = null; // New callback for text box added
        this.onTextBoxUpdate = null; // New callback for text box updates
        this.onTextBoxRemoved = null; // New callback for text box removed
        this.onSessionEnded = null; // New callback for session ended by coach/trainer
        this.onYoutubePopupCreated = null; // New callback for YouTube popup created
        this.onYoutubePopupClosed = null; // New callback for YouTube popup closed
    }

    initialize() {
        const wsUrl = this.wsUrl.replace('http', 'ws');
        const fullWsUrl = `${wsUrl}/ws/whiteboard/${this.sessionId}`;

        try {
            this.ws = new WebSocket(fullWsUrl);
            this.setupWebSocket();
        } catch (error) {
            console.error('[WhiteboardService] Error creating WebSocket:', error);
        }
    }

    setupWebSocket() {
        this.ws.onopen = () => {
            const joinMessage = {
                type: 'join',
                sessionId: this.sessionId,
                role: this.role
            };
            this.ws.send(JSON.stringify(joinMessage));
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case 'draw':
                    if (this.onDraw) {
                        this.onDraw(message.data);
                    }
                    break;

                case 'clear':
                    if (this.onClear) {
                        this.onClear();
                    }
                    break;

                case 'image':
                    if (this.onImage) {
                        this.onImage(message.data);
                    }
                    break;

                case 'item_update':
                    if (this.onItemUpdate) {
                        this.onItemUpdate(message.data);
                    }
                    break;

                case 'tool_access':
                    if (this.onToolAccess) {
                        this.onToolAccess(message.data);
                    }
                    break;

                case 'trigger_keyboard':
                    if (this.onTriggerKeyboard) {
                        this.onTriggerKeyboard(message.data);
                    }
                    break;

                case 'item_selected':
                    if (this.onItemSelected) {
                        this.onItemSelected(message.data);
                    }
                    break;

                case 'prompt_update':
                    if (this.onPromptUpdate) {
                        this.onPromptUpdate(message.data);
                    }
                    break;

                case 'text_added':
                    if (this.onTextAdded) {
                        this.onTextAdded(message.data);
                    }
                    break;

                case 'bucket_added':
                    if (this.onBucketAdded) {
                        this.onBucketAdded(message.data);
                    }
                    break;

                case 'bucket_update':
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
                    if (this.onVideoStateUpdate) {
                        this.onVideoStateUpdate(message.data);
                    }
                    break;

                case 'media_control':
                    if (this.onMediaControl) {
                        this.onMediaControl(message.data);
                    }
                    break;

                case 'item_remove':
                    if (this.onItemRemove) {
                        this.onItemRemove(message.data);
                    }
                    break;

                case 'erase_pen':
                    if (this.onErasePen) {
                        this.onErasePen(message.data);
                    }
                    break;

                case 'clear_canvas':
                    if (this.onClearCanvas) {
                        this.onClearCanvas(message.data);
                    }
                    break;

                case 'stopwatch_sync':
                    if (this.onStopwatchSync) {
                        this.onStopwatchSync(message.data);
                    }
                    break;

                case 'feedback_message':
                    if (this.onFeedbackMessage) {
                        this.onFeedbackMessage(message.data);
                    }
                    break;

                case 'waiting_message':
                    if (this.onWaitingMessage) {
                        this.onWaitingMessage(message.data);
                    }
                    break;

                case 'floating_animations':
                    if (this.onFloatingAnimations) {
                        this.onFloatingAnimations(message.data);
                    }
                    break;

                case 'animation_popped':
                    if (this.onAnimationPopped) {
                        this.onAnimationPopped(message.data);
                    }
                    break;

                case 'text_box_added':
                    if (this.onTextBoxAdded) {
                        this.onTextBoxAdded(message.data);
                    }
                    break;

                case 'text_box_update':
                    if (this.onTextBoxUpdate) {
                        this.onTextBoxUpdate(message.data);
                    }
                    break;

                case 'text_box_removed':
                    if (this.onTextBoxRemoved) {
                        this.onTextBoxRemoved(message.data);
                    }
                    break;

                case 'session_ended':
                    if (this.onSessionEnded) {
                        this.onSessionEnded(message.data);
                    }
                    break;

                case 'youtube_popup_created':
                    if (this.onYoutubePopupCreated) {
                        this.onYoutubePopupCreated(message.data);
                    }
                    break;

                case 'youtube_popup_closed':
                    if (this.onYoutubePopupClosed) {
                        this.onYoutubePopupClosed(message.data);
                    }
                    break;

                case 'ping':
                    // Respond to server heartbeat ping with pong
                    this.ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    console.debug('[WhiteboardService] Responded to ping with pong');
                    break;

                default:
                    // Unknown message type — silently ignore
                    break;
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

    // Send bucket added event
    sendBucketAdded(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WhiteboardService] Sending bucket_added:', data);
            this.ws.send(JSON.stringify({
                type: 'bucket_added',
                data: data
            }));
        } else {
            console.warn('[WhiteboardService] Cannot send bucket_added - WebSocket not ready');
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
