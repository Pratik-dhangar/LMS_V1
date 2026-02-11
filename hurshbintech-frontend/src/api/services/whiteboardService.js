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
        this.onBackgroundMusic = null; // New callback for background music control
        this.onBackgroundMusicVolume = null; // New callback for background music volume changes
        this.onExerciseUpdate = null; // New callback for exercise updates from trainer
        this.onExerciseAnswerUpdate = null; // New callback for real-time answer updates
        this.onExerciseResponse = null; // New callback for exercise submission from learner
        this.onExerciseClosed = null; // New callback for exercise closed by trainer
        this.onCommentUpdate = null; // New callback for comment updates
        this.onCommentsToggle = null; // New callback for comments tool toggle
    }

    initialize() {
        const wsUrl = this.wsUrl.replace('http', 'ws');
        const fullWsUrl = `${wsUrl}/ws/whiteboard/${this.sessionId}`;

        try {
            this.ws = new WebSocket(fullWsUrl);
            this.setupWebSocket();
        } catch (error) {
            // console.error('[WhiteboardService] Error creating WebSocket:', error);
        }
    }

    setupWebSocket() {
        this.ws.onopen = () => {
            // console.log('[WhiteboardService] WebSocket connected for role:', this.role, 'session:', this.sessionId);
            const joinMessage = {
                type: 'join',
                sessionId: this.sessionId,
                role: this.role
            };
            this.ws.send(JSON.stringify(joinMessage));
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // Log all incoming messages for debugging
            if (message.type !== 'ping' && message.type !== 'pong') {
                // console.log('[WhiteboardService] Received message type:', message.type, 'data:', message.data);
            }

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
                    // console.log('[WhiteboardService] Received bucket_update:', message.data);
                    if (this.onBucketUpdate) {
                        // console.log('[WhiteboardService] Calling onBucketUpdate callback');
                        try {
                            // Pass all data including items array for removal
                            this.onBucketUpdate(message.data);
                            // console.log('[WhiteboardService] ✓ onBucketUpdate callback executed successfully');
                        } catch (error) {
                            // console.error('[WhiteboardService] ❌ Error in onBucketUpdate callback:', error);
                        }
                    } else {
                        // console.log('[WhiteboardService] ❌ onBucketUpdate callback NOT set!');
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
                    // console.log('[WhiteboardService] 📩 Received erase_pen message:', message.data);
                    if (this.onErasePen) {
                        // console.log('[WhiteboardService] ✅ Calling onErasePen callback...');
                        this.onErasePen(message.data);
                    } else {
                        // console.warn('[WhiteboardService] ⚠️ WARNING: onErasePen callback is NOT registered!');
                    }
                    break;

                case 'clear_canvas':
                    // console.log('[WhiteboardService] 📩 Received clear_canvas message from trainer:', message.data);
                    if (this.onClearCanvas) {
                        // console.log('[WhiteboardService] ✅ Calling onClearCanvas callback...');
                        this.onClearCanvas(message.data);
                    } else {
                        // console.warn('[WhiteboardService] ⚠️ WARNING: onClearCanvas callback is NOT registered!');
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

                case 'background_music':
                    // console.log('[WhiteboardService] 🎵 Received background_music message:', message);
                    if (this.onBackgroundMusic) {
                        // console.log('[WhiteboardService] 🎵 Callback exists, calling onBackgroundMusic with data:', message.data);
                        this.onBackgroundMusic(message.data);
                    } else {
                        // console.warn('[WhiteboardService] ⚠️ No onBackgroundMusic callback registered!');
                    }
                    break;

                case 'background_music_volume':
                    // console.log('[WhiteboardService] 🔊 Received background_music_volume message:', message);
                    if (this.onBackgroundMusicVolume) {
                        // console.log('[WhiteboardService] 🔊 Callback exists, calling onBackgroundMusicVolume with data:', message.data);
                        this.onBackgroundMusicVolume(message.data);
                    } else {
                        // console.warn('[WhiteboardService] ⚠️ No onBackgroundMusicVolume callback registered!');
                    }
                    break;

                case 'exercise_update':
                    if (this.onExerciseUpdate) {
                        this.onExerciseUpdate(message.data);
                    }
                    break;

                case 'exercise_answer_update':
                    if (this.onExerciseAnswerUpdate) {
                        this.onExerciseAnswerUpdate(message.data);
                    }
                    break;

                case 'exercise_response':
                    if (this.onExerciseResponse) {
                        this.onExerciseResponse(message.data);
                    }
                    break;

                case 'exercise_closed':
                    if (this.onExerciseClosed) {
                        this.onExerciseClosed(message.data);
                    }
                    break;

                case 'comment_update':
                    if (this.onCommentUpdate) {
                        this.onCommentUpdate(message.data);
                    }
                    break;

                case 'comments_toggle':
                    if (this.onCommentsToggle) {
                        this.onCommentsToggle(message.data);
                    }
                    break;

                case 'ping':
                    // Respond to server heartbeat ping with pong
                    this.ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    // console.debug('[WhiteboardService] Responded to ping with pong');
                    break;

                default:
                    // Unknown message type — silently ignore
                    break;
            }
        };

        this.ws.onerror = (error) => {
            // console.error('[WhiteboardService] Whiteboard WebSocket error:', error);
        };

        this.ws.onclose = (event) => {
            // console.log('[WhiteboardService] Whiteboard WebSocket closed - Code:', event.code, 'Reason:', event.reason);
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
            // console.log('[WhiteboardService] Sending video state:', data);
            this.ws.send(JSON.stringify({
                type: 'video_state',
                data: data
            }));
        } else {
            // console.warn('[WhiteboardService] Cannot send video state - WebSocket not ready');
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
            // console.warn('[WhiteboardService] Cannot send media_control - WebSocket not ready');
        }
    }

    // Send bucket added event
    sendBucketAdded(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log('[WhiteboardService] Sending bucket_added:', data);
            this.ws.send(JSON.stringify({
                type: 'bucket_added',
                data: data
            }));
        } else {
            // console.warn('[WhiteboardService] Cannot send bucket_added - WebSocket not ready');
        }
    }

    // Send floating animations event
    sendFloatingAnimations(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log('[WhiteboardService] Sending floating_animations:', data);
            this.ws.send(JSON.stringify({
                type: 'floating_animations',
                data: { animations: data }
            }));
        } else {
            // console.warn('[WhiteboardService] Cannot send floating_animations - WebSocket not ready');
        }
    }

    // Generic send method for custom message types
    send(type, data) {
        // console.log(`[WhiteboardService.send] Called with type: ${type}`);
        // console.log(`[WhiteboardService.send] WebSocket exists: ${!!this.ws}, ReadyState: ${this.ws?.readyState}`);
        // console.log(`[WhiteboardService.send] WebSocket.OPEN constant: ${WebSocket.OPEN}`);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // console.log(`[WhiteboardService] Sending ${type} message:`, data);
            this.ws.send(JSON.stringify({
                type: type,
                data: data
            }));
        } else {
            // console.warn(`[WhiteboardService] Cannot send ${type} - WebSocket not ready (exists: ${!!this.ws}, readyState: ${this.ws?.readyState}, OPEN: ${WebSocket.OPEN})`);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

export default WhiteboardService;
