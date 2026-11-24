# Live Session Extraction Map

Source audit: 24 November 2026. This is an extraction plan for a separate project;
the LMS application has not been extracted or modified by this audit.

For implementation, start with `LIVE_SESSION_EXECUTION_PLAN.md`, which fixes the
destination, ports, identity, lifecycle, API contracts, file actions and phased
acceptance gates. `LIVE_SESSION_HANDOFF_PROMPT.txt` is the copyable task prompt.
This map explains the source; the execution plan is the implementation specification.

The current session experience can be separated by retaining the existing canvas,
tool callbacks, normalized drawing data, media components, and two WebSocket
protocols while replacing the LMS entry flow with trainer-selected learner invitations
and a small room lifecycle service. The agreed approach preserves explicit trainer and
learner pairing; learners do not discover or browse general live rooms.
Copying `Whiteboard.jsx` by itself will not preserve the current behavior.

The companion `LIVE_SESSION_EXTRACTION_MANIFEST.json` contains source paths, SHA-256
hashes, file sizes, locked dependency versions, and incoming message types. Regenerate
it with `python scripts/extraction/map_live_session.py`. Its session-page graph has
55 files; that count excludes the separately inventoried global messaging graph,
global styles/configuration, runtime public assets, and backend adaptations. Static
import reachability includes helpers that will be replaced; it is not a copy list.

## Agreed standalone flow

1. A passwordless login form offers Trainer and Learner, a named demo profile for
   the selected role, and Login. The profile supplies a stable participant ID. With
   only one profile for a role, select it automatically. Role selection alone does
   not identify which learner should receive an invitation.
2. Trainer home offers a learner selector, Start Session, and Add Learning Material.
   Populate the selector from the standalone learner profiles; no LMS preparation
   or Head-created assignment is needed.
3. Trainer selects a learner and clicks Start Session. The backend creates the
   paired live room and its invitation together, then opens the current trainer
   session layout. Keep explicit `trainer_id` and `learner_id`. No Head, ILP,
   subscription, date, duration, learning goal, or program is required.
4. Only the selected learner's home shows that active session invitation, with the
   trainer's name and Join Session. Use a targeted invitations API with simple
   polling initially. Join opens the existing learner waiting/admission experience;
   an invitation does not automatically admit the learner.
5. The trainer receives the existing admission dialog. Admit starts offer/answer/ICE
   negotiation; Reject returns the learner to the existing rejected/waiting flow.
6. Retain the session canvas, toolbars, content sidebar, audio/video controls,
   media viewers, recording, notes, comments, feedback, and session end behavior.
7. Remove the entire left Learning Program panel and let the canvas use its space.
   That component also owns prompt/reinforcement controls and voice-to-prompt UI;
   removing the entire panel removes those visible controls. Do not remove canvas
   text boxes or unrelated toolbar functions as a side effect.
   The shared left container also renders remote video: preserve that video/ref
   in a video-only area rather than deleting the whole container blindly.
8. Learner interactions retain the existing trainer-controlled permissions. Preserve
   Select, Drag, Draw, PDF drawing, exercise responses, calculator access, animation
   interactions, and all relevant synchronization callbacks. This does not mean
   giving the learner every trainer-only control.

Start with seeded, named demo profiles: one trainer and one or more selectable
learners. Allow one live room per trainer and one selected learner per room. Repeated
Start clicks return the existing room/invitation rather than creating duplicates.
The trainer ends the current room before starting one for a different learner.
Multiple concurrent pairs are a later scope decision; current WebSocket registries
have only one socket per role per room.

The agreed sequence is:

```text
Select role and demo profile -> Login
Trainer selects learner -> Start Session -> Paired room and invitation created
Selected learner home -> Join Session -> Waiting for trainer approval
Trainer session -> Admit -> Existing whiteboard and audio/video experience
Trainer ends session -> Room ends and invitation disappears from learner home
```

Other learners receive no invitation and cannot fetch, join, or attach session
WebSockets to that room. The server checks the selected participant IDs. If the
learner is offline when invited, their home loads the invitation after login.

## Current path through the LMS

The current flow is Head-created learner/trainer records and subscription eligibility,
then Schedule ILP, then Trainer session entry, then Learner session entry and admission.

- `src/App.jsx` mounts `/trainer/session/:sessionId` and
  `/learner/session/:sessionId` inside `MediaControlProvider` and role protection.
- `src/pages/trainer/TrainerSession.jsx` is the active trainer entry point.
  It uses `useInstructorSessionState`, `useInstructorHandlers`,
  `useInstructorEffects`, and `InstructorSessionLayout`.
- `initializeInstructorSession` in `InstructorSessionLayout.jsx` fetches session
  details, checks trainer identity and ended state, uses the local activity guard,
  auto-starts the session, and initializes services. These entry checks must be
  adapted to rooms rather than bypassed by manufacturing LMS records.
- `LearnerSession.jsx` fetches session details, calls `joinSession`, initializes
  services, and displays admission waiting state. It also handles reconnect,
  rejection, removal, session ending, and feedback.
- Backend `sessions.py` checks LMS roles, trainer/head relationships, learner
  activity and remaining subscription sessions. Replace those business gates with
  demo identity, trainer ownership and selected-learner membership checks. Retain
  the existing explicit trainer-to-learner pairing.

All frontend paths below are relative to `hurshbintech-frontend/`; backend paths
are relative to `hurshbintech-backend/`.

## Frontend units that must move together

| Unit | Current sources | Extraction treatment |
| --- | --- | --- |
| Trainer page | `src/pages/trainer/TrainerSession.jsx` | Retain handlers and admission/recording flow; replace room entry, identity, navigation, and left panel slot. |
| Learner page | `src/pages/learner/LearnerSession.jsx` | Retain waiting/admission UI, callbacks, tool permissions, media, reconnect, and exit; replace LMS session and identity adapters. |
| Shared instructor layout and tool UI | `src/components/session/InstructorSessionLayout.jsx` | Retain the current renderer and toolbar functions. Isolate role validation, content lookup, room initialization and notes endpoints behind adapters. |
| Shared learner layout | `src/components/session/AttendeeSessionLayout.jsx` | Retain canvas/video layout, waiting modal, animations and metrics presentation that remain relevant. Remove empty LMS labels instead of redesigning the page. |
| Instructor state and effects | `src/hooks/useInstructorSessionState.js`, `useInstructorHandlers.js`, `useInstructorEffects.js` | Preserve canvas/tool state and event effects. Remove program reports and LMS lookups; retain notes, media, stopwatch and content search behavior. |
| Canvas engine | `src/components/common/Whiteboard.jsx`, `src/utils/drawingSync.js` | Lift as the baseline. Preserve IDs, normalized coordinates, stroke widths, drag/resize math, touch gestures, drawing/erasing and restore behavior. |
| Tool transport | `src/api/services/whiteboardService.js`, `WhiteboardToolsService.js` | Preserve message payloads, callbacks, reconnection, heartbeats and restoration buffering. Make endpoint/identity configuration local to the new project. |
| Video/audio | `src/api/services/videoConferenceService.js`, `src/components/videoConference/LearnerVideoConference.jsx`, `MoveableVideoFeed.jsx` | Preserve negotiation, ICE queueing, reconnect, freeze, camera/mic controls and moveable video behavior. Configure TURN/STUN outside source literals. |
| Synchronized media | `src/context/MediaControlContext.jsx`, `src/components/common/MediaPopup.jsx`, `LivePdfViewer.jsx`, `YouTubePopup.jsx` | Retain play/pause/seek/page/fullscreen/close and PDF annotations. Preserve the PDF.js worker import. |
| Activities | `src/components/session/Exercise.jsx`, `src/components/common/Calculator.jsx`, `StopwatchDisplay.jsx` | Retain instructor creation/control, learner responses/permission, state synchronization, timing and sounds. |
| Supporting hooks | `useStopwatch.js`, `useComments.js`, `useAutoHideNavbar.js`, `utils/attendeeSession.js` | Retain active functionality. Remove only obsolete LMS links or panel-related effects after checking callers. |
| Content sidebar | `src/pages/trainer/LearningContentSidebar.jsx` | Keep drag/touch payloads, search, previews and return-to-sidebar behavior. Populate from standalone uploads rather than assigned ILP content. |
| Recording | `src/api/services/janusServiceOptimized.js` | Keep chunking, retry and recording UI. The implementation uses browser MediaRecorder despite its name; it is not evidence of a required Janus server. |
| Left sidebar | `src/pages/trainer/LearningProgramSidebar.jsx` | Remove from `LeftSidebarComponent`. Remove its dead report/goal wiring after baseline parity, not by deleting shared tool helpers. |
| Legacy-named utilities | `src/utils/instructorSession.js` | Do not delete based on its migration comments: `useInstructorEffects` actively imports `autoSaveSessionNotes` from it. Extract the used helper. |

The current canvas is about 5,183 lines and the instructor layout about 4,112 lines.
These are the baseline implementation, not candidates for a simultaneous rewrite.

## Assets and styles outside the page imports

- Carry `public/music/` and `public/reactions/`; the current inventory contains
  23 files across those directories. These are runtime URLs, not module imports.
- Carry the imported sample image assets `src/assets/Red_Apple.jpg` and
  `src/assets/banana.jpeg`, or deliberately replace their use after parity.
- Carry the session, video conference, whiteboard, PDF/media popup, calculator,
  exercise, and header CSS listed in the manifest.
- Preserve necessary global CSS variables and utilities from `src/index.css`
  and relevant rules from `src/App.css`, with the existing Tailwind 3/PostCSS setup.
  The static page graph alone does not capture ancestor-provided global styling.
- Keep Emoji rendering and sound helpers. A screenshot of buttons alone does not
  establish that animation assets, sounds, PDF workers or drag payloads moved.
- Pin the resolved versions from the manifest initially, including React 19.2.0,
  Vite 7.2.6, PDF.js 4.10.38 and Tailwind 3.4.18. Package.json ranges are not a
  snapshot of the installed API versions.

## Messaging is a separate dependency

The bottom-right Messaging control in the screenshot is injected by `ChatIconWidget`
in `App.jsx`. It is not part of either session page's static imports.

To meet the request to retain everything except the left panel, preserve its UI with
`ChatIconWidget.jsx`, `MessagingWidget.jsx`, their subcomponents/styles, and a room
chat adapter. The manifest has a separate transitive messaging graph. Do not blindly
import the LMS AuthContext, global user directory, contact permissions and every
conversation just to keep this widget. Scope identities/messages to the two room
participants. Whiteboard comments and this messaging widget are separate features.

## Backend to retain and adapt

| Area | Existing implementation | Standalone boundary |
| --- | --- | --- |
| RTC relay | `app/api/endpoints/websocket.py`, `/ws/rtc/{session_id}` | Keep role-targeted SDP/ICE forwarding, heartbeat and reconnect semantics for trainer/learner. Remove coach/client/guest/observer branches from the new project after parity. |
| Whiteboard relay | Same file, `/ws/whiteboard/{session_id}` | Keep drawing/tools/media/calculator routing, participant notifications, media locks, and initial restoration. |
| Durable board state | `app/crud/whiteboard_crud.py`, `app/models/whiteboard_state_model.py` | Reuse PostgreSQL JSONB persistence and normalized data structures. `session_id` has no LMS session foreign key. |
| Room lifecycle and invitations | Adapt selected behavior from `sessions.py` and `session_crud.py` | Preserve trainer/learner IDs using standalone demo profiles. Replace LMS business joins with room ownership, selected-learner invitations, detail, join, leave and end semantics. |
| Upload and content library | `learning_content.py`, its CRUD/schema/model, local file helpers | Trainer-authorized upload and room/participant-scoped metadata. Serve files from the new backend with stable URLs. |
| Notes and feedback | `session_notes.py`, its storage/schema, `session_feedback_model.py`, feedback handlers in `sessions.py` | Preserve session-visible functions against room IDs and demo identities. Do not retain LMS reporting requirements. |
| Recording | Recording upload/chunk/finalize/status/playback portions of `sessions.py`, `recording_merge_service.py`, `recording_storage/` | Retain browser recording flow and local storage; adapt authorization and numeric room ID lookup. FFmpeg remains needed for merging. |
| Messaging | `app/api/endpoints/Chat/chat.py`, chat service/connection manager/models | Adapt for room participants and messages. Keep the widget contract without the LMS user-directory dependency. |

Keep FastAPI, the current async database pattern and PostgreSQL for the first extraction.
Changing database type would also require converting JSONB persistence, which adds an
unnecessary variable. Redis, S3, Brevo, Twilio and Google OAuth are not required for
the standalone local room flow. No LMS scheduler or subscription cleanup worker is needed.
Use a separate database and storage directory; do not reuse the working LMS database.

## Transport and admission contracts

There are two live channels, not one:

1. `/ws/rtc/{room_id}`: role `join`, `peer_ready`, SDP `offer`/`answer`,
   `ice-candidate`, heartbeats, disconnects and existing real-time controls.
2. `/ws/whiteboard/{room_id}`: strokes, items, text, tool permissions, PDF drawing,
   buckets, media, YouTube state, exercises, comments, stopwatch, calculator,
   reactions, music, waiting messages and restoration. Exact current incoming
   message types are listed in the manifest.

Current admission sequence:

1. Learner calls the session join API and connects its services.
2. The RTC relay sees trainer and learner and sends `peer_ready` to the trainer.
3. `videoConferenceService.js` calls `onParticipantJoinRequest` and defers the offer.
4. Trainer's Admit calls `admitParticipant()`, which creates the SDP offer.
5. Learner answers; media arrival clears the learner waiting gate.
6. Reject sends whiteboard `waiting_message` with `__ADMISSION_REJECTED__`.
   Removal uses `__REMOVED_FROM_SESSION__`.

Retain this visible request/accept/reject experience. For the new room service,
track invited/join-requested/admitted/rejected/left membership server-side, separately
from the room's active/ended lifecycle. Only the invited learner can request entry.
The present UI
gate is not a complete server admission boundary: the whiteboard socket can connect
and receive restore data before video admission. Preserve the interaction while
binding relay/restoration access to the new room membership state.

## New shell and API responsibilities

Proposed frontend: RoleProfileLogin, TrainerHome with learner selection, LearnerHome
with targeted invitation cards, MaterialUpload, the copied trainer/learner session
pages and a small DemoAuth/Room adapter.

Proposed standalone API responsibilities:

- `GET /api/demo/profiles?role=trainer|learner`: named profiles for passwordless
  prototype login. The selected profile must belong to the selected role.
- `POST /api/demo/login`: accepts role and profile ID, validates their pairing and
  issues a room-project participant identity/token. No password or LMS preparation.
- `GET /api/learners`: trainer-authorized learner candidates for the home selector.
- `POST /api/rooms` with `learner_id`: trainer creates/starts the paired live room
  and invitation atomically and idempotently. Reject missing/invalid candidates;
  do not create a room visible to all learners.
- `GET /api/invitations/mine`: only the logged-in learner's current active-session
  invitations. It also loads invitations created while that learner was offline.
- `GET /api/rooms/{id}`: the session metadata required by the copied pages.
- `POST /api/rooms/{id}/join`, `/admit`, `/reject`, `/leave`, `/end`: room membership
  and lifecycle. Existing sessionService calls map to these through an adapter.
- `POST /api/materials` and `GET /api/materials`: trainer uploads/browses materials;
  responses retain file URL, type, title, thumbnail and YouTube fields expected by
  existing drag/media helpers. Reuse supported format and size validation.
- Room notes, feedback, recording and chat endpoints retain their UI-facing behavior.
- Learner home polls `GET /api/invitations/mine` while visible and refreshes on login
  and window focus. The backend derives results from the selected learner and current
  room status. Polling handles invitation creation, ending and removal; no general
  room-discovery list or room-directory stream is needed. A targeted WebSocket
  notification can replace polling later without changing the pairing model.
- End Session marks the room ended and closes its invitation. Reject/removal updates
  the learner membership and existing waiting UI; an ordinary disconnect remains a
  reconnect condition rather than implicit session completion.

Keep the existing string room/session identifier for socket paths and stable numeric
room primary key where recording helpers currently expect `sessionInfo.id`.
The adapter initially returns compatible trainer/learner identity, status, timestamps
and content fields. Participant IDs are the selected standalone profiles, not fabricated
LMS accounts. It returns no learning program/goals instead of querying LMS tables.

Role login must be tab-scoped. Current code reads `localStorage.user_data` and
`access_token`; two same-origin trainer/learner tabs would overwrite each other's
role. Introduce a sessionStorage-backed identity adapter and replace those reads
at active call sites. Passwordless role/profile selection is the agreed local
prototype identity, not verification of who a person is on a public service.

## Concrete extraction hazards

1. **Trainer upload is not currently equivalent to admin upload.** The shared
   `/api/content/learning-content/upload` endpoint uses `get_current_admin` even
   though trainer metadata creation exists. A new trainer upload endpoint is required.
2. **Media acquisition currently precedes RTC connection.** With no camera/mic,
   `getLocalMedia` fails before signaling/admission. For parity tests, use real or
   synthetic browser media. A whiteboard-only/no-device mode would be an explicit
   adaptation; successful TURN discovery alone is not a completed call.
3. **Current persistence filters events by role.** `persist_whiteboard_event` skips
   non-controller roles. Verify learner strokes/edits after reconnect rather than
   assuming every broadcast edit is durable. Fix any loss as a separately tested
   compatibility change in the new project.
4. **Connection state is in one Python process.** RTC/whiteboard maps, media state
   and media locks are in-memory. Use one backend worker initially. Multiple workers
   need a shared room transport strategy; adding Redis caching alone does not do that.
5. **Default URLs can point at the live LMS.** Replace production API fallbacks and
   hardcoded TURN settings in the new project. Both participants need backend-served
   upload URLs; browser blob URLs are not portable between participants.
6. **Disconnect is not necessarily end.** Keep refresh/reconnect behavior separate
   from explicit End Session. Selected-learner invitation cards must reflect server
   room lifecycle and trainer availability, including stale-room handling after
   process interruption. Other learners must never inherit that invitation.

## Suggested separate project layout

```text
live-session-studio/
  frontend/
    src/app/                 # role/profile login, learner selection, invites and room adapters
    src/session/             # existing trainer and learner pages/layouts/hooks
    src/components/          # existing Whiteboard, PDF, media and tool components
    src/api/                 # room, material, notes, recordings and chat adapters
    public/music/
    public/reactions/
  backend/
    app/rooms/               # paired room lifecycle, invitations and membership
    app/realtime/            # existing RTC/whiteboard relay behavior
    app/whiteboard/          # state model and persistence
    app/materials/           # upload/library and file serving
    app/recordings/
    app/notes/
    app/chat/
    app/demo_auth/
  storage/                   # independent local materials and recordings
  docs/parity-checklist.md
```

Preserving original relative paths for the first copy is safer than moving files
into this final organization immediately. First get the copied behavior working;
then reorganize behind stable imports in a separate change.
The execution plan requires preserved source-relative frontend paths for the first
extraction; the conceptual grouping above is not a request to reorganize during it.

## Implementation order and acceptance

1. Freeze the source commit plus the manifest hashes and capture both session views.
2. Create a separate project/database, pin baseline dependencies and copy the audited
   frontend graph/assets. Keep both session pages recognizable.
3. Seed standalone demo profiles and create passwordless role/profile login, trainer
   learner selection, paired room/invitation creation, targeted learner-home polling,
   and thin adapters. Remove Head preparation/subscription/date gates while retaining
   trainer/learner pairing. Remove only the requested left panel.
4. Port signaling, whiteboard restoration and selected-participant membership;
   verify select/start/invite/join/admit/reject with trainer and learner in separate
   tabs or browsers, including an uninvited learner profile.
5. Connect trainer uploads, content sidebar drag/drop, stable file serving and
   synchronized media. Retain notes, recording and room messaging adapters.
6. Run two-peer parity checks below before improving or replacing canvas code.

Acceptance checks must exercise both peers, not just render tool buttons:

- Passwordless role/profile login; the selected role/profile identifies the same
  participant across refreshes without overwriting a different tab's login.
- Trainer selects a learner before start; only that learner sees the invitation,
  including after being offline. Uninvited learners cannot fetch or join the room.
- Repeated Start creates no duplicate room/invitation; starting for another learner
  while the trainer has a live room does not silently change the existing pairing.
- Pending join, trainer Admit, Reject, rejoin, removal, explicit end and invitation
  removal. Receiving an invitation alone does not admit the learner.
- Pen/color/size, erasing, erase-all versus clear-all, item selection, drag, resize,
  text boxes, buckets and touch gestures; permission off/on on the learner.
- Images, PDF page sync and annotations, video/audio play/pause/seek, YouTube open/
  close/split, media return to sidebar and initial state for a late/rejoining learner.
- Q&A creation, learner answers, synchronized calculator permissions/results/history,
  stopwatch start/pause/reset, feedback reactions, pop animations and music volume.
- Room comments, messaging, session notes, recording chunk retry/finalize/playback
  and existing end feedback where exposed.
- Different canvas sizes, fullscreen/video move/resize, and mouse versus touch.
- Refresh/reconnect of either peer, no duplicated listeners/timers/ghost media,
  restored trainer and learner changes, and no old room state leaking into a new room.
- Connected or synthetic A/V for media parity; unavailable hardware reported separately.

Audit evidence is source-level and static-dependency-level. The current LMS's whole
feature set has not been re-proven end to end by this mapping. The standalone project
does not exist yet, and no claim of extraction parity is made before these checks.
