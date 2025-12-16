**Project Feature Scenarios**

This document lists the main features discovered with concise descriptions and references to key implementation files.

**Authentication**: Centralized passcode-based login issuing JWT access tokens; rate-limited endpoints and role-based access enforcement. See [hurshbintech-backend/app/api/endpoints/auth.py](hurshbintech-backend/app/api/endpoints/auth.py) and `create_access_token` usages in backend security modules.

**User Roles & Management**: Multi-role users (`admin`, `head`, `trainer`, `consultant`, `learner`) with role-specific CRUD and profile views. Admin/head can create and manage subordinate users. See [hurshbintech-backend/app/api/endpoints/admin.py](hurshbintech-backend/app/api/endpoints/admin.py) and [hurshbintech-backend/app/api/endpoints/head.py](hurshbintech-backend/app/api/endpoints/head.py).

**Reveal Passcode (Admin/Head)**: Controlled endpoints to decrypt and reveal user passcodes for authorized admin/head users (audited). See [hurshbintech-backend/app/api/endpoints/admin.py](hurshbintech-backend/app/api/endpoints/admin.py) and [hurshbintech-backend/app/api/endpoints/head.py](hurshbintech-backend/app/api/endpoints/head.py).

**Learning Content Management**: Upload, store, serve and manage learning materials (images, video, audio, documents). Supports S3 (via `S3Manager`) and local fallback; auto-thumbnailing and Nginx proxy public URLs. See [hurshbintech-backend/app/api/endpoints/learning_content.py](hurshbintech-backend/app/api/endpoints/learning_content.py) and [hurshbintech-backend/app/utils/s3_utils.py](hurshbintech-backend/app/utils/s3_utils.py).

**Learning Goals & Programs**: Create, update, list and delete learning goals; role-scoped endpoints for admin and head. See [hurshbintech-backend/app/api/endpoints/learning_goals.py](hurshbintech-backend/app/api/endpoints/learning_goals.py).

**Vlogs (Video Content)**: Upload, update, list and delete video vlogs with S3/local storage, thumbnail handling and size/type validation. See [hurshbintech-backend/app/api/endpoints/vlogs.py](hurshbintech-backend/app/api/endpoints/vlogs.py).

**Training Sessions**: Schedule/create sessions (Heads), start/end sessions (Trainers), join sessions (Learners), update/delete scheduled sessions, attach learning contents/goals, and persistent session metadata. See [hurshbintech-backend/app/api/endpoints/sessions.py](hurshbintech-backend/app/api/endpoints/sessions.py).

**Real-time WebSocket Communication**: WebSocket endpoint for session real-time messages (broadcast, join/leave events). See WebSocket handler in [hurshbintech-backend/app/api/endpoints/sessions.py](hurshbintech-backend/app/api/endpoints/sessions.py).

**Session Notes (Auto-save)**: Auto-save and update notes during sessions; trainer draft/finalized workflow; head access to notes by internal session id. See [hurshbintech-backend/app/api/endpoints/session_notes.py](hurshbintech-backend/app/api/endpoints/session_notes.py).

**Session Reports & Analytics**: Trainers create session reports; heads can view per-learner summaries, grouped program sessions, statistics for charts and PDF data export support. See [hurshbintech-backend/app/api/endpoints/session_reports.py](hurshbintech-backend/app/api/endpoints/session_reports.py).

**Profile Endpoints**: Single endpoint to fetch the current user profile for any role. See [hurshbintech-backend/app/api/endpoints/profile.py](hurshbintech-backend/app/api/endpoints/profile.py).

**Frontend: Role-based UI & Routing**: Role selection and passcode login, protected routes, and dashboard redirection per role. See [hurshbintech-frontend/src/pages/auth/Login.jsx](hurshbintech-frontend/src/pages/auth/Login.jsx), [hurshbintech-frontend/src/context/AuthContext.jsx](hurshbintech-frontend/src/context/AuthContext.jsx), and `ProtectedRoute.jsx` under [hurshbintech-frontend/src/components](hurshbintech-frontend/src/components).

**Frontend: Video Conferencing UI**: Trainer and Learner video conference components with local/remote streams, mic/camera controls, and connection status UI. See [hurshbintech-frontend/src/components/videoConference/TrainerVideoConference.jsx](hurshbintech-frontend/src/components/videoConference/TrainerVideoConference.jsx) and related components.

**PWA Support**: Service worker registration and update hooks for offline/PWA behavior. See [hurshbintech-frontend/src/pwa/useServiceWorkerUpdate.js](hurshbintech-frontend/src/pwa/useServiceWorkerUpdate.js) and PWA config in frontend root files.

**File Storage & S3 Integration**: Backend utilities to upload/delete files, generate thumbnails, and produce Nginx-proxied public URLs. See [hurshbintech-backend/app/utils/s3_utils.py](hurshbintech-backend/app/utils/s3_utils.py) and `learning_content.py`, `vlogs.py`, `sessions.py` endpoints.

**Rate Limiting & Metrics**: Rate limiter on auth endpoints and metrics collection hooks in auth flows to monitor attempts. See [hurshbintech-backend/app/api/endpoints/auth.py](hurshbintech-backend/app/api/endpoints/auth.py) and `metrics_collector` usage in backend core.

**Security & Access Controls**: Role checks in endpoints via dependency injections (e.g., `get_current_admin`, `get_current_head`, `get_current_trainer`) and JWT-based guards. See dependency implementations under [hurshbintech-backend/app/core/deps.py](hurshbintech-backend/app/core/deps.py) and security helpers.



---
 
**Trainer Session Features**

This section lists features available to the `trainer` during a live training session (extracted from frontend and backend code) with short descriptions and implementation references.

- **Session Lifecycle Controls**: Start, end, update and view sessions; trainer can start a scheduled session and end it with optional notes. Backend endpoints: `hurshbintech-backend/app/api/endpoints/sessions.py` (`/sessions/{session_id}/start`, `/sessions/{session_id}/end`, `/sessions/{session_id}`); frontend usage in `hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx` and `hurshbintech-frontend/src/api/services/sessionService.js`.

- **Real-time Video Conferencing (WebRTC)**: Peer-to-peer audio/video between trainer and learner with STUN/TURN support, ICE candidate handling, offer/answer negotiation, reconnection and stats. Implemented in `hurshbintech-frontend/src/api/services/videoConferenceService.js` and used by `TrainerSession.jsx` and `TrainerVideoConference.jsx`.

- **Signaling & Session WebSocket (non-RTC)**: WebSocket messages for session-level events (broadcasts, session end notifications, chat, simple signaling). Backend: WebSocket in `hurshbintech-backend/app/api/endpoints/sessions.py` (`/ws/{session_id}/{user_id}`); frontend: `sessionService.initializeWebSocket` and WebSocket handlers in `TrainerSession.jsx`.

- **Collaborative Whiteboard**: Real-time canvas drawing, image insertion, item updates, selection, clearing, erase-pen, and item removal; supports tool access control and keyboard triggers. Backend whiteboard WS handlers and frontend `whiteboardService.js` and `hurshbintech-frontend/src/components/common/Whiteboard` + `TrainerSession.jsx` glue.

- **Media & Learning Content Sync**: Trainer can open/play/pause/seek media in-session; media state is synchronized to learner via whiteboard/media-control messages. Backend learning content endpoints in `learning_content.py`; frontend uses `learningContentService.js` and `whiteboardService.sendMediaControl` from `TrainerSession.jsx`.

- **Learning Content Attachment**: Attach learning content and goals to a session (IDs passed at create/update), serve content via S3 or local storage, and show thumbnails. See `app/schemas/session.py` fields `content_ids`/`goal_ids`, backend `learning_content.py`, and frontend `LearningContentSidebar.jsx` + `learningContentService.js`.

- **Learning Goals & Prompt/Reinforcement Meters**: Goals attached to session; trainer can set prompt and reinforcement meters which flow into session reports and UI meters in realtime (via signaling). Backend: `learning_goals.py`, `session_reports.py`; frontend: meter updates via `videoConferenceService.sendPromptMeter/sendReinforcementMeter` and `TrainerSession.jsx` handlers.

- **Session Notes (Auto-save & Finalize)**: Trainer auto-saves draft notes during session and can update/ finalize notes. Backend endpoints in `session_notes.py`; frontend uses `sessionNotesService.js` and the auto-save/sendBeacon on unmount in `TrainerSession.jsx`.

- **Session Reports Creation**: Trainers create detailed session reports (goal-level prompt/reinforcement values, notes, program mapping) after sessions; reports power leaderboards/analytics. Backend: `session_reports.py`; frontend: `sessionReportService.js` and session report UI hooks in `TrainerSession.jsx`.

- **Timers & Stopwatches**: Per-session stopwatch/timers displayed on whiteboard and synced to learner (throttled updates) for timing exercises. Implementation in `TrainerSession.jsx` using `useStopwatch` and `whiteboardService.send('stopwatch_sync', ...)`.

- **Voice Input / Speech Recognition**: Trainer can use speech-to-text to send prompts to learner; integration with `useVoiceInput` hook triggers `prompt_update` messages to the whiteboard. Frontend: `TrainerSession.jsx` + `useSpeechRecognition.js`; server receives only saved text via WS.

- **Chat / Messages & Floating Feedback**: Real-time text chat between trainer and learner; ability to send floating feedback animations (bubbles, emojis, stars). Frontend: `useMessages` hook, `TrainerSession.jsx`; whiteboard WS messages `floating_animations` and `feedback_message`.

- **Fill-in-the-Blanks & Exercise Creator**: Trainer can create interactive exercises (Fill Blanks) and push them to learner; UI in `FillBlanksCreator` and templates in `utils/fillInBlanksTemplates`.

- **Moveable Video Feed & Layout Controls**: Trainer can move/resize the remote video feed and toggle mic/camera; components: `MoveableVideoFeed.jsx`, `TrainerVideoConference.jsx`, and layout state in `TrainerSession.jsx`.

- **Media Controls & Auto-stopwatch**: When content ends, the trainer UI can auto-open the stopwatch; media visibility controlled by `mediaControl` context in frontend.

- **Permission/Tool Access Control**: Trainer grants or revokes learner permissions (select, drag, keyboard, fillBlanks) through whiteboard `tool_access` messages.

- **File Uploads / S3 Handling for Session Media**: Upload and serve large media assets via S3 manager or local storage with thumbnail generation. Backend: `learning_content.py`, `vlogs.py`, `s3_utils.py`; frontend uses `learningContentService.js` and S3 proxied URLs.

- **Session Polling / Time-left UI & Alerts**: Trainer UI polls session status periodically and shows countdown; on expiry trainer is notified to end session. Implemented in `TrainerSession.jsx` using `sessionService.getSessionDetails`.

- **Session PDF Data Export**: Aggregates session/report/program data for PDF generation (backend endpoint `/session-reports/learner/{learner_id}/pdf-data`); frontend `sessionReportService.getPdfData` fetches this data.

- **Resilience & Reconnect Strategies**: WebSocket reconnection, ICE restart, audio-only fallback, queuing ICE candidates, and graceful close/cleanup. Implemented across `videoConferenceService.js`, `whiteboardService.js`, and backend WS handlers.

- **Audit & Logging Hooks**: Session events, passcode reveals, and important actions are logged/audited server-side (see `admin.py`, `head.py`, `sessions.py`).



**Learner Session Features**

This section summarizes features available to the `learner` during a live session, with short descriptions and implementation references.

- **Join & Participate in Sessions**: Learners can join active sessions, view session details, and fetch their scheduled/active sessions. Backend endpoints: `hurshbintech-backend/app/api/endpoints/sessions.py` (`/sessions/{session_id}/join`, `/sessions/learner/sessions`, `/sessions/{session_id}`); frontend: `hurshbintech-frontend/src/pages/learner/LearnerSession.jsx` and `hurshbintech-frontend/src/api/services/sessionService.js`.

- **Passive Video Experience (Trainer-first)**: Learners receive the trainer's remote video stream (trainer-focused UI). Learner UI hides the learner's own video to reduce distraction but supports audio as needed. Component: `hurshbintech-frontend/src/components/videoConference/LearnerVideoConference.jsx`; underlying logic: `videoConferenceService.js`.

- **Real-time Whiteboard Interaction (Controlled)**: Learners receive whiteboard updates (draw, images, items, timers) and can interact according to trainer-granted permissions (select, drag, keyboard input, fill-in-the-blanks). Service: `hurshbintech-frontend/src/api/services/whiteboardService.js`; UI: `hurshbintech-frontend/src/components/common/Whiteboard` and `LearnerSession.jsx`.

- **Tool Permission Model (Trainer-controlled)**: Learner actions are gated by trainer via `tool_access` messages — learners can be granted/revoked keyboard, select, drag, and exercise interactions in real time. Handlers in `LearnerSession.jsx` and `whiteboardService.js`.

- **Receive Prompts & Reinforcements**: Trainer prompts, prompt-meter, and reinforcement-meter updates are sent to learners in real time and displayed in the UI; these feed into session reports. Implementations: meters in `videoConferenceService.js`, `TrainerSession.jsx`, and learner display in `LearnerSession.jsx`.

- **Stopwatch / Timer Sync (Read-only)**: Learners receive stopwatch/timer sync updates from the trainer (throttled) and show countdown and tick/celebration sounds when timers finish. Implementation: `whiteboardService.onStopwatchSync` usage and `useStopwatch` in `LearnerSession.jsx`.

- **Chat & Text Messages**: Learners can send/receive chat messages during the session via the WebRTC/data-channel or WS signaling; messages appear on the whiteboard and chat panes. Hook: `useMessages` and related handlers in `LearnerSession.jsx` and `TrainerSession.jsx`.

- **Virtual Keyboard & Input**: When granted, learners can use a virtual keyboard to type into whiteboard exercises or text items; keyboard visibility and caret position are synchronized. Handled by `LearnerSession.jsx` and `whiteboardService` (`trigger_keyboard`, `text_added`).

- **Interactive Exercises (Fill-in-the-Blanks)**: Learners receive interactive exercises created by the trainer and can fill responses when permitted; trainer can push updates or evaluate. Frontend: `FillBlanksCreator` (trainer) and learner-side rendering in `Whiteboard` + `LearnerSession.jsx` handlers.

- **Floating Animations & Feedback**: Learners see floating feedback (bubbles, smileys, stars, balloons) and can pop them; popping events are broadcast and may include sounds. Handlers: `floating_animations`, `animation_popped` in `whiteboardService.js` and `LearnerSession.jsx`.

- **Media Playback Sync**: Learners' media players are synchronized to trainer actions (open/play/pause/seek/close) via `media_control` and `video_state` messages; media assets served via S3 or local URLs. See `learning_content.py`, `learningContentService.js`, and whiteboard media control handlers.

- **Session Notes Visibility**: Learners may view session notes or summaries if provided (backend provides endpoints); notes auto-save is trainer/trainer-report centric. See `session_notes.py` and `sessionNotesService.js` for saving/reading notes.

- **Session Reports & PDF Data (Read Access)**: Learners can access some session summary data or PDFs if exposed by the app; backend supports aggregated PDF data via session reports (`session_reports.py`) and frontend `sessionReportService.getPdfData`.

- **Moveable Video Feed & Simple Layout Controls**: Learners can move/resize the video feed UI elements (if allowed by design) using `MoveableVideoFeed.jsx` and layout state in `LearnerSession.jsx`.

- **Resilience & Reconnect Strategies for Learner**: Learner client uses same reconnection strategies as trainer: WebSocket reconnect, audio-only fallback, queued ICE candidates, and graceful cleanup. Implemented across `videoConferenceService.js`, `whiteboardService.js`, and session WS handlers.

- **Audio/Visual Accessibility & Sound Cues**: Learner UI plays tick and celebration sounds on timer events and supports audio-level indicators for trainer speech (audio feedback). Implemented in `LearnerSession.jsx` via Web Audio API helpers and sound utilities.



