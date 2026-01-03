**UI Interaction Flow Checklist**

This checklist covers trainer and learner interaction flows for live sessions, intended for developers and docs authors to implement or validate UI behavior.

**Session Entry**
- **Auth & Redirect**: Ensure `access_token` + `user_data` exist in localStorage and redirect to the correct dashboard on login. See [hurshbintech-frontend/src/context/AuthContext.jsx](hurshbintech-frontend/src/context/AuthContext.jsx).
- **Open Session**: Validate route param `sessionId` and call `getSessionDetails` to fetch session meta and permissions. See [hurshbintech-frontend/src/api/services/sessionService.js](hurshbintech-frontend/src/api/services/sessionService.js).
- **Join/Start**: Trainer calls `/sessions/{session_id}/start`; learner calls `/sessions/{session_id}/join`. Confirm server response and UI state transitions.

**Real-time Communication**
- **WebRTC Init**: Request media, create peer connection with `RTC_CONFIG`, attach tracks, and handle offer/answer/ICE flows. See [hurshbintech-frontend/src/api/services/videoConferenceService.js](hurshbintech-frontend/src/api/services/videoConferenceService.js).
- **Signaling WS**: Open signaling WebSocket for session messages and handle `message`, `prompt_meter`, `reinforcement_meter`, `ping/pong`. End-to-end send/receive must be tested. See session WS in [hurshbintech-backend/app/api/endpoints/sessions.py](hurshbintech-backend/app/api/endpoints/sessions.py).
- **Fallbacks & Reconnect**: Implement audio-only fallback, queued ICE candidates, ICE restart on failure and exponential WS reconnect attempts.

**Whiteboard & Collaborative Tools**
- **Initialize Whiteboard WS**: Connect to `/ws/whiteboard/{sessionId}` and register `onDraw`, `onClear`, `onItemUpdate`, `onToolAccess`, `onStopwatchSync`, etc. See [hurshbintech-frontend/src/api/services/whiteboardService.js](hurshbintech-frontend/src/api/services/whiteboardService.js).
- **Trainer Draw Flow**: Trainer draws → `sendDrawData` → backend broadcasts → learners render. Validate stroke smoothing, ordering, and latency handling.
- **Select/Drag Permissions**: Trainer toggles `tool_access` messages; learners must enable/disable UI affordances accordingly. Check `tool_access` handlers in `LearnerSession.jsx` and `TrainerSession.jsx`.
- **Item Selection & Updates**: Selecting an item triggers `item_selected`/`item_update` messages; ensure selection highlight and ownership restrictions are enforced.

**Media & Content Sync**
- **Open/Play Media**: Trainer `sendMediaControl` (open/play/pause/seek/close) → learners sync player state. Validate seeking accuracy and buffering behavior. See `learning_content` endpoints and `whiteboardService.sendMediaControl`.
- **Thumbnail & File URLs**: Validate S3 vs local URL conversion to public proxy via backend utilities. See [hurshbintech-backend/app/utils/s3_utils.py](hurshbintech-backend/app/utils/s3_utils.py) and `learning_content.py`.

**Timers, Stopwatches & Sounds**
- **Start/Sync Stopwatch**: Trainer starts stopwatch → send `stopwatch_sync` messages (throttled) → learners update display and play tick/celebration sounds. Verify throttle (100ms) and final celebration conditions.
- **Timer Expiry**: When timer expires, show alert/toast and allow trainer to end session; learner receives celebration sound and UI update.

**Prompts, Meters & Feedback**
- **Prompt Send**: Trainer mutes/uses voice input → `prompt_update` → whiteboard shows prompt; ensure text sanitization and visibility toggles.
- **Prompt/Reinforcement Meters**: Trainer updates meters via `videoConferenceService.sendPromptMeter/sendReinforcementMeter`; learners display meters and values get stored in session reports.
- **Floating Feedback**: Trainer triggers `floating_animations`; learners animate and can `animation_popped` back. Validate event broadcast and sound playback.

**Chat & Messages**
- **Data Channel / WS Chat**: Messages sent via WebRTC data channel or WS signaling should appear in chat pane and optionally on the whiteboard. Validate ordering and persistence (if applicable).

**Interactive Exercises**
- **Learner Answer Flow**: Learner types (virtual keyboard) → `text_added`/`item_update` → trainer sees responses; ensure permissions gating on keyboard access.

**Session Notes & Reports**
- **Auto-save Notes**: Trainer auto-saves via `/session-notes/{sessionId}` periodically and on unmount (use `navigator.sendBeacon` fallback). See `sessionNotesService.js`.
- **Create Report**: Trainer submits session report via `/session-reports/` with goal-level meters and notes; validate payload format and success handling.

**Session End & Cleanup**
- **End Session (Trainer)**: Call `/sessions/{session_id}/end` with `notes`; broadcast session end to all via WS and close media/WS connections gracefully.
- **Client Cleanup**: Stop local tracks, close peerConnection, close WS, clear intervals, and save last notes (use sendBeacon). Ensure no memory leaks.

**Resilience, Observability & Security**
- **Error UI**: Show clear, actionable errors for media denial, WS disconnects, and server errors (toast + reconnection options).
- **Metrics & Logging**: Ensure auth attempts, passcode reveals, session events are logged server-side for audit.
- **Role-based Access**: UI should block actions not permitted by role (admin/head/trainer/learner). Use dependency checks from backend for enforcement.

**Developer References**
- **Trainer session code**: [hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx](hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx)
- **Learner session code**: [hurshbintech-frontend/src/pages/learner/LearnerSession.jsx](hurshbintech-frontend/src/pages/learner/LearnerSession.jsx)
- **Video service**: [hurshbintech-frontend/src/api/services/videoConferenceService.js](hurshbintech-frontend/src/api/services/videoConferenceService.js)
- **Whiteboard service**: [hurshbintech-frontend/src/api/services/whiteboardService.js](hurshbintech-frontend/src/api/services/whiteboardService.js)
- **Session APIs**: [hurshbintech-backend/app/api/endpoints/sessions.py](hurshbintech-backend/app/api/endpoints/sessions.py)

**Trainer Session (Step-by-step)**
- **1. Enter / Initialize**: Trainer opens session route → call `getSessionDetails(sessionId)` and verify trainer permissions.
- **2. Start Session**: Click `Start` → POST `/sessions/{sessionId}/start` → open signaling WS and whiteboard WS, request local media, call `videoConferenceService.createOffer()`.
- **3. Grant Tools**: Toggle tool permission UI → send `tool_access` via whiteboard WS (payload: { tool, enabled }) → clients enable/disable controls.
- **4. Share Prompt / Content**: Use prompt input or content panel → send `prompt_update` and/or `media_control` messages; also attach content IDs to session via session APIs if persistent.
- **5. Run Stopwatch / Timers**: Start stopwatch → send `stopwatch_sync` periodically → learners update UI and sounds; on finish optionally tag in report.
- **6. Feedback & Meters**: Adjust prompt/reinforcement meters → call `videoConferenceService.sendPromptMeter` / `sendReinforcementMeter` → learners display meters and server stores values.
- **7. Interactive Exercises**: Create or push interactive exercises → send `item_update` / `text_added` → learners render interactive fields; collect responses through WS and save to notes/report.
- **8. Auto-save Notes**: Notes auto-save periodically via `/session-notes/{sessionId}` and on cleanup use `navigator.sendBeacon`.
- **9. End Session**: Click `End` → POST `/sessions/{sessionId}/end` with summary → broadcast `session_end` over WS → close media/WS and finalize report creation.

**Learner Session (Step-by-step)**
- **1. Enter / Initialize**: Learner opens session route → call `getSessionDetails(sessionId)` and verify learner access.
- **2. Join Session**: Click `Join` → call `/sessions/{sessionId}/join` (if required) → open signaling WS and whiteboard WS, await remote offer, set remote description and add local tracks if allowed.
- **3. Media Reception**: On remote track event, attach trainer streams to video elements; handle layered video (moveable feed) and mute/unmute controls according to role permissions.
- **4. Receive Tool Access**: Handle `tool_access` messages to enable/disable learner UI (drawing, keyboard, media controls).
- **5. Respond to Prompts**: Display `prompt_update`; if keyboard access allowed, show virtual keyboard and send `text_added` events to trainer via WS.
- **6. Stopwatch & Sounds**: Update stopwatch via `stopwatch_sync`; play tick/celebration sounds per trainer commands and show time warnings.
- **7. Interactive Exercises**: Render interactive exercises upon `item_update`; submit answers via WS and show instructor feedback messages.
- **8. Local Notes & Cleanup**: Optionally save local notes; on session end close WS/peerConnection, stop tracks, and persist any final notes to the server.

---

