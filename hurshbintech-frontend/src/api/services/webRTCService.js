// const ICE_SERVERS = {
//     iceServers: [
//         { urls: 'stun:stun.l.google.com:19302' },
//         { urls: 'stun:stun1.l.google.com:19302' },
//     ],
// };

// class WebRTCService {
//     constructor(wsUrl, sessionId, role) {
//         this.wsUrl = wsUrl;
//         this.sessionId = sessionId;
//         this.role = role; // 'trainer' or 'learner'
//         this.peerConnection = null;
//         this.ws = null;
//         this.localStream = null;
//         this.onTrack = null;
//         this.onConnectionStateChange = null;
//         this.onSessionEnded = null;
//         this.onPromptMeter = null;
//         this.onReinforcementMeter = null;
//         this.onMessage = null;
//         this.pendingIceCandidates = [];
//     }

//     async initialize() {
//         try {
//             // Create WebSocket connection
//             const wsUrl = this.wsUrl.replace('http', 'ws');
//             this.ws = new WebSocket(`${wsUrl}/ws/rtc/${this.sessionId}`);
//             this.setupWebSocket();

//             // Create RTCPeerConnection
//             this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
//             this.setupPeerConnection();

//             // Get user media
//             const constraints = {
//                 audio: true,
//                 video: true
//             };

//             this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
//             this.localStream.getTracks().forEach(track => {
//                 this.peerConnection.addTrack(track, this.localStream);
//             });

//             return this.localStream;
//         } catch (error) {
//             console.error('WebRTC initialization error:', error);
//             throw error;
//         }
//     }

//     setupWebSocket() {
//         this.ws.onopen = () => {
//             console.log('[WebRTC] WebSocket connected');
//             this.ws.send(JSON.stringify({
//                 type: 'join',
//                 sessionId: this.sessionId,
//                 role: this.role
//             }));
//         };

//         this.ws.onmessage = async (event) => {
//             try {
//                 const message = JSON.parse(event.data);
//                 console.log('[WebRTC] Received message:', message.type);

//                 switch (message.type) {
//                     case 'peer_ready':
//                         await this.createAndSendOffer();
//                         break;

//                     case 'offer':
//                         await this.handleOffer(message.offer);
//                         break;

//                     case 'answer':
//                         if (this.peerConnection.signalingState === 'have-local-offer') {
//                             await this.peerConnection.setRemoteDescription(message.answer);
//                         } else {
//                             console.log('[WebRTC] Ignoring answer: not in have-local-offer state');
//                         }
//                         break;

//                     case 'ice-candidate':
//                         await this.handleIceCandidate(message.candidate);
//                         break;

//                     case 'session_ended':
//                         if (this.onSessionEnded) {
//                             this.onSessionEnded(message.payload);
//                         }
//                         break;

//                     case 'prompt_meter':
//                         if (this.onPromptMeter) {
//                             this.onPromptMeter(message.value);
//                         }
//                         break;

//                     case 'reinforcement_meter':
//                         if (this.onReinforcementMeter) {
//                             this.onReinforcementMeter(message.value);
//                         }
//                         break;

//                     case 'message':
//                         if (this.onMessage) {
//                             this.onMessage(message);
//                         }
//                         break;

//                     default:
//                         console.warn('[WebRTC] Unknown message type:', message.type);
//                 }
//             } catch (error) {
//                 console.error('[WebRTC] Error parsing message:', error);
//             }
//         };

//         this.ws.onerror = (error) => {
//             console.error('[WebRTC] WebSocket error:', error);
//         };

//         this.ws.onclose = (event) => {
//             console.log('[WebRTC] WebSocket closed');
//         };
//     }

//     setupPeerConnection() {
//         this.peerConnection.onicecandidate = (event) => {
//             if (event.candidate) {
//                 this.ws.send(JSON.stringify({
//                     type: 'ice-candidate',
//                     candidate: event.candidate
//                 }));
//             }
//         };

//         this.peerConnection.ontrack = (event) => {
//             if (this.onTrack) {
//                 this.onTrack(event.streams[0]);
//             }
//         };

//         this.peerConnection.onconnectionstatechange = () => {
//             if (this.onConnectionStateChange) {
//                 this.onConnectionStateChange(this.peerConnection.connectionState);
//             }
//         };
//     }

//     async createAndSendOffer() {
//         try {
//             const offer = await this.peerConnection.createOffer();
//             await this.peerConnection.setLocalDescription(offer);
//             this.ws.send(JSON.stringify({
//                 type: 'offer',
//                 offer: offer
//             }));
//         } catch (error) {
//             console.error('Error creating offer:', error);
//             throw error;
//         }
//     }

//     async handleOffer(offer) {
//         try {
//             if (this.peerConnection.signalingState === 'stable' || this.peerConnection.signalingState === 'have-local-offer') {
//                 await this.peerConnection.setRemoteDescription(offer);
//                 await this.flushPendingIceCandidates();
//                 const answer = await this.peerConnection.createAnswer();
//                 await this.peerConnection.setLocalDescription(answer);
//                 this.ws.send(JSON.stringify({
//                     type: 'answer',
//                     answer: answer
//                 }));
//             } else {
//                 console.log('[WebRTC] Ignoring offer: not in stable or have-local-offer state, current state:', this.peerConnection.signalingState);
//             }
//         } catch (error) {
//             console.error('Error handling offer:', error);
//             throw error;
//         }
//     }

//     async handleIceCandidate(candidate) {
//         try {
//             if (candidate) {
//                 if (this.peerConnection.remoteDescription) {
//                     await this.peerConnection.addIceCandidate(candidate);
//                 } else {
//                     this.pendingIceCandidates.push(candidate);
//                 }
//             }
//         } catch (error) {
//             console.error('Error handling ICE candidate:', error);
//             throw error;
//         }
//     }

//     async flushPendingIceCandidates() {
//         for (const candidate of this.pendingIceCandidates) {
//             try {
//                 await this.peerConnection.addIceCandidate(candidate);
//             } catch (error) {
//                 console.error('Error adding pending ICE candidate:', error);
//             }
//         }
//         this.pendingIceCandidates = [];
//     }

//     sendPromptMeter(value) {
//         if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//             this.ws.send(JSON.stringify({
//                 type: 'prompt_meter',
//                 value: value
//             }));
//         }
//     }

//     sendReinforcementMeter(value) {
//         if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//             this.ws.send(JSON.stringify({
//                 type: 'reinforcement_meter',
//                 value: value
//             }));
//         }
//     }

//     sendMessage(text, sender) {
//         if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//             this.ws.send(JSON.stringify({
//                 type: 'message',
//                 text: text,
//                 sender: sender
//             }));
//         }
//     }

//     closeConnection() {
//         if (this.localStream) {
//             this.localStream.getTracks().forEach(track => track.stop());
//         }
//         if (this.peerConnection) {
//             this.peerConnection.close();
//         }
//         if (this.ws) {
//             this.ws.close();
//         }
//     }
// }

// export default WebRTCService;
