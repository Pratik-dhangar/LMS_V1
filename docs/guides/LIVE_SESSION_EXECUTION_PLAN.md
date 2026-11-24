# Standalone Live Session Execution Plan

This is the implementation specification for extracting the existing trainer/learner
conference into an independent project. Read this file first. Use
`LIVE_SESSION_EXTRACTION_MANIFEST.json` for exact source files, hashes and versions.
Use `LIVE_SESSION_EXTRACTION_MAP.md` only for additional source explanations.
`LIVE_SESSION_BACKEND_VERSIONS.json` records selected installed backend versions.

The task is to BUILD the separate project and verify it. A new drawing demo, static
mockup, frontend-only prototype, or another plan is not completion. This document
does not claim that the implementation already exists.

## 1. Fixed scope and defaults

| Decision | Required implementation |
| --- | --- |
| Source | The repository containing this document. Resolve paths relative to that root; do not hardcode the developer's absolute Windows path. |
| Destination | `<source-root>/live-session-studio/`, unless the user supplies another location. It must have its own frontend/backend configuration and no runtime imports from the source LMS. |
| Source protection | Read and copy source files; do not edit LMS application files, original environment files, original databases or original startup scripts. Never reset unrelated work. |
| Stack | Existing React/Vite/Tailwind frontend, FastAPI async backend, PostgreSQL JSONB board persistence, local material/recording storage, one backend worker. |
| Ports | Frontend `5174`, backend `8002`, both loopback by default. Do not stop the source LMS on `3000/8000`. Fail clearly if destination ports are occupied. |
| Local operation | Native Windows. Reuse installed executables where possible. Docker, Redis, S3, Google OAuth, Brevo and Twilio are not prerequisites. |
| Database | New database `live_session_studio` and a dedicated new database role/credentials. Never migrate or seed the LMS database. If using a separate native PostgreSQL cluster, keep its data and keys under the destination, with a separately selected port. |
| Identity | Passwordless role + named demo-profile selection. Seed one Trainer and two Learners, so invitation targeting can actually be tested. |
| Session pairing | Trainer selects a learner before Start Session. No general room discovery. |
| Invitation updates | Poll the selected learner's own invitations every 3 seconds while home is visible; refresh immediately on login/focus/visibility return. Cancel timers on unmount/logout. |
| Concurrent sessions | One active room per trainer and one active room per learner. A trainer must end the current room before choosing another learner. |
| Initial file layout | Preserve original relative paths under destination `frontend/src/`; do not reorganize the canvas and shared components during extraction. |
| Existing session UI | Preserve tools, media, notes, recording, comments, messaging and learner permission behavior. Remove the Learning Program panel and its data-dependent controls. |

Create a fresh small app shell; do not copy the LMS `App.jsx`, `main.py`, backend
`app/models/__init__.py`, authentication dependencies, or all 97 migrations into the
new runtime. They import the rest of the LMS. Use them as references only.

## 2. Required user journey

1. Login shows role, profile selector, and Login. Roles are exactly Trainer/Learner;
   profiles are filtered by role. No password, passcode, registration or OTP.
2. Trainer home shows learner selection, Start Session, a resumable active room if
   one exists, and Add Learning Material/library controls.
3. Start sends only the selected learner ID. Backend derives trainer identity from
   the login token, creates the active paired room and invitation atomically, and
   returns room details. Trainer enters the copied session page.
4. Selected Learner home shows that trainer's invitation and Join Session. Learner 2
   must not see Learner 1's invitation, including by guessing the room URL.
5. Join requests entry; learner waits. Trainer receives the existing admission modal.
6. Trainer clicks Admit: backend authorizes admission first; then the existing
   `admitParticipant()` creates the offer. Offer/answer/ICE establishes A/V. The
   copied learner page clears its waiting gate as it currently does.
7. Reject/removal retains the existing waiting-message UI and cleanup semantics.
8. End Session ends the room, notifies the learner, closes the active invitation,
   closes both room channels, and removes the learner home card by the next poll.

Keep the session header's Dashboard action functional against the new home routes.
For this prototype it navigates in the same tab without ending the room; Home offers
Resume Session. Do not retain a `window.open(..., 'noopener')` flow that depends on
localStorage auth being shared with a fresh tab.

Keep these route paths so copied navigation remains predictable: `/login`,
`/trainer/dashboard`, `/learner/dashboard`, `/trainer/session/:sessionId`,
`/learner/session/:sessionId`, and the retained direct-chat route if its widget uses
one. Protect role routes with the new demo auth. Mount one BrowserRouter, the new
AuthProvider (compatible `useAuth` export), MediaControlProvider, room ChatProvider,
ToastContainer/CSS and ChatIconWidget. Do not nest a second router or omit providers
required by copied components. Replace obsolete navigation targets explicitly.

## 3. Identity and state contracts

Seed these profiles idempotently in the NEW database:

```json
[
  {"id": 1, "role": "trainer", "name": "Trainer Demo"},
  {"id": 2, "role": "learner", "name": "Learner One"},
  {"id": 3, "role": "learner", "name": "Learner Two"}
]
```

Role/profile login is intentionally a local demonstration, not verified real-world
identity. Backend still validates tokens, profile role, selected room membership
and trainer ownership; do not authorize a request from a caller-supplied `role` alone.
Use a generated local signing secret. Store `{user, access_token}` in sessionStorage
through one auth module, and replace copied reads of localStorage `user_data` and
`access_token`. Keep unrelated canvas preference keys separate.

Room model: integer `id`, unique string `session_id` (`session_<random>`), `trainer_id`,
`learner_id`, `status` (`active`/`ended`), `started_at`, `ended_at`, timestamps.
Invitation/membership: room ID, learner ID, state, timestamps. Board state retains
the current JSONB representation. Additional tables store material metadata, notes,
feedback, recording metadata and room chat. Use a new initial migration.

| Event | Membership result | Room result |
| --- | --- | --- |
| Start | `invited` | `active` |
| Learner Join | `join_requested` | Remains active |
| Trainer Admit | `admitted` | Remains active |
| Trainer Reject | `rejected` | Remains active |
| Admitted learner leaves | `left` | Remains active |
| Learner refreshes/rejoins | New join request; trainer approves again | Remains active |
| Trainer removes learner | `rejected`; stop that learner's relay access | Remains active |
| Trainer ends | `closed` | `ended` |

An invited/rejected/left selected learner may explicitly request to join again;
never automatically admit or reopen their channels after rejection. Explicit End is
terminal. Mark the learner card as unavailable while trainer is disconnected; retain
room state for trainer Resume. After backend restart, rooms remain resumable but
trainer presence starts offline. Presence is set by authenticated trainer connection,
not a stale database `active` status. Home offers Resume, not a duplicate Start.

Use transactions plus database locking/constraints for repeated concurrent Start:
same trainer + same learner -> return existing room (200); different learner while
trainer is active or already-busy learner -> 409; new pair -> 201. Seed and reruns
must not delete records, rotate existing encryption keys, or reset board state.

## 4. HTTP and socket boundaries

All routes below are on the NEW backend. Use bearer auth except profile listing,
demo login and a non-sensitive health response. `room_id` in public paths means
the string `session_id`; numeric `id` is reserved for recording compatibility.

| Method and path | Input and result | Access |
| --- | --- | --- |
| GET `/api/demo/profiles?role=trainer` or `learner` | Array of matching profile objects | Public local demo |
| POST `/api/demo/login` | `{role, profile_id}` -> `{access_token, user:{id,role,name}}` | Validate profile/role pairing |
| GET `/api/learners` | Array of learner profiles with busy flag | Trainer |
| POST `/api/rooms` | `{learner_id}` -> compatible RoomDetails below | Trainer |
| GET `/api/rooms/current` | Current user's active paired room or `null` | Authenticated participant |
| GET `/api/invitations/mine` | Array of own active-room invitations including room details, membership state and trainer presence | Selected learner only |
| GET `/api/rooms/{room_id}` | RoomDetails | Paired participant only |
| POST `/api/rooms/{room_id}/join` | Empty body; request entry, return membership state | Selected learner; room active, trainer present |
| POST `/api/rooms/{room_id}/admit` | Empty body; idempotently admit current pending request | Owning trainer |
| POST `/api/rooms/{room_id}/reject` | Empty body; reject request and send existing rejection signal | Owning trainer |
| POST `/api/rooms/{room_id}/remove` | Empty body; revoke learner access and send existing removal signal | Owning trainer |
| POST `/api/rooms/{room_id}/leave` | Empty body; mark learner left, preserve room | Selected learner |
| POST `/api/rooms/{room_id}/end` | Empty body; idempotent end plus notifications | Owning trainer |
| GET/POST `/api/materials` | List trainer's library / multipart upload with title and file | Trainer |
| GET `/api/uploads/{file_key:path}` | New project files; stable HTTP URLs, range support for seeking | Room/material access rules |

Use 401 for missing/invalid auth, 403 for a known but unassigned participant,
404 for an unknown room, 409 for ended/unavailable/invalid lifecycle transitions,
and 422 for invalid inputs. Register fixed room paths before `/{room_id}`.

RoomDetails compatibility example:

```json
{
  "id": 17, "session_id": "session_example", "title": "Live Session",
  "trainer_id": 1, "learner_id": 2,
  "trainer_name": "Trainer Demo", "learner_name": "Learner One",
  "status": "active", "started_at": "2026-11-24T10:00:00Z", "ended_at": null,
  "duration": null, "learning_contents": [], "learning_goals": [],
  "program": null, "mode_of_expression": []
}
```

The example IDs/timestamp are illustrative, not seed data. No scheduled date or
duration gate is required. Audit copied callers and include any additional fields
they actually read; do not fake subscriptions or programs to satisfy old code.
Retain public method names on the copied frontend `sessionService` where useful:
`getSessionDetails`, `joinSession`, `endSession`, `submitFeedback`. Map them to new
routes. Its legacy `startSession` call must return the already-active room, not
create another. Remove unused Head/admin operations rather than leaving failing calls.

Notes: retain the methods of copied `sessionNotesService`, including force-save
and clear. Back them with real room-note storage. Feedback retains rating 1..5,
remark and participant identity on real room records. Notes and record upload must
remain available during end/finalization; do not revoke the trainer before pending
saves finish. No mock success/no-op responses for retained features.

Recording: preserve current `uploadRecordingChunk`, `finalizeRecording`,
`getRecordingStatus`, playback contracts. The existing recorder sends multipart
`chunk`, numeric `session_id`, `chunk_number`, `recording_id`; finalize sends
`recording_id`, `session_id`, `chunk_count`, `total_chunks_uploaded`,
`uploaded_chunks`, `failed_chunks`, `duration`. Port these handlers with new room
ownership, local storage and real FFmpeg merging. Keep MIME/range/playback behavior.

Messaging: preserve the widget and used `chatApi` methods with a room-only adapter;
read its current response fields before implementing. Users/contact lists contain
only the paired participants, and the conversation belongs to their room. Preserve
text/file messages, read indicators, typing and online events that its UI uses.
Remove unsupported group-management routes/UI; retain the direct one-to-one chat.
Whiteboard comments remain a separate existing feature.

Sockets remain `/ws/rtc/{room_id}` and `/ws/whiteboard/{room_id}`. Extend their initial
`join` message with the demo token, validate it before room registration and derive
role/participant from it. Compare any claimed role with the token. Keep existing
event names/payloads from the manifest and source; do not invent a replacement
whiteboard protocol. A separate authenticated chat socket can retain its adapter path.

## 5. Admission integration without a deadlock

Selected pending learners may open both sockets for admission control/signaling.
Before admission they may receive connection/heartbeat/waiting/rejection signals;
they must not receive board restore, board updates, room chat content or media offers.
Reject sockets from unselected learners before adding them to room registries.

1. `/join` persists `join_requested`. Repeat requests are idempotent while pending.
2. When both RTC peers register, send existing `peer_ready` to the trainer. Handle
   either connection order. The copied trainer callback opens one admission modal.
3. Trainer Admit handler awaits `/admit`, then calls the existing
   `videoService.admitParticipant()` to send the SDP offer. Never offer first.
4. After admission commits, send initial board/media state to that learner through
   the existing restoration path. `WhiteboardService` already buffers restoration
   until its callback is installed; preserve that mechanism.
5. Forward SDP/ICE and board data only for the admitted pair. Trainer may prepare
   the board before admission; those changes must be stored and restored afterward.
6. `/reject` and `/remove` send the existing `__ADMISSION_REJECTED__` and
   `__REMOVED_FROM_SESSION__` waiting signals respectively. Use one authoritative
   sending path so the old frontend handler does not send them a second time.
7. On ended room, block reconnect and all new offers; emit existing `session_ended`
   and clear current-room presence. On ordinary socket replacement, cleanup must
   compare the socket instance before deleting the role entry, so an old socket
   cannot delete the new connection.

`getLocalMedia` currently happens before RTC signaling. Preserve this behavior for
the first extraction; test media using real or browser-synthetic devices. A no-camera
whiteboard-only product mode is not part of this task. Missing hardware must not be
reported as a successful A/V test or used to justify deleting media functionality.

## 6. File actions and high-risk edits

`LIVE_SESSION_FILE_ACTIONS.json` assigns every inventoried source file an initial
action and destination. COPY_BASELINE means copy its bytes first and preserve its
behavior, not a ban on necessary documented integration fixes. ADAPT means copy or
extract the indicated feature and change its boundary. REPLACE means implement a
small new module at that destination. REFERENCE_ONLY means do not import it into
the new runtime. Every exception needs a reason in the destination change ledger.

Important integration anchors:

- `TrainerSession.jsx`: preserve state hooks, initialization of whiteboard/media,
  admission, recording and callbacks. Replace identity/entry/navigation. Remove
  `LearningProgramSidebar`, program report calls and dead panel props only.
- `LearnerSession.jsx`: preserve tool-access, media and whiteboard callbacks, waiting
  and cleanup. Replace identity/API calls and add selected-room membership checks.
- `InstructorSessionLayout.jsx`: adapt `validateUserSession` and
  `initializeInstructorSession`; do not rewrite its `WhiteboardTools` implementation.
  Remove inactive coach lookup/dynamic imports if their module is not copied.
- **The left DOM container also renders remote video.** Remove Learning Program
  panel instances in desktop and mobile layouts, its toggle and reserved empty
  column, but preserve the remote video/ref in a compact video-only area using the
  same video element/component. Do not delete it with the program panel. Confirm
  the enlarged canvas still receives the same normalized coordinate handling.
- `useInstructorEffects.js`: keep whiteboard callbacks, notes, timers, media and
  content search. Remove goal/program/coach-only database lookups. Empty arrays in
  RoomDetails are not permission to leave hidden LMS HTTP requests active.
- `useInstructorHandlers.js`: keep canvas handlers. Replace end/navigation/notes and
  remove dead LMS report operations. Stop/finalize recordings and flush notes before
  final teardown; errors must be surfaced and remain retryable.
- `Whiteboard.jsx` and `drawingSync.js`: copy first; preserve geometry, touch, drawing,
  item types and PDF handling. Prefer adapting services over editing this engine.
- `whiteboardService.js`: add token from the auth module to join; preserve reconnect,
  listener registration and restoration buffering. `videoConferenceService.js` also
  needs token and configurable ICE servers, with unchanged SDP/ICE mechanics.
- `sessionActivityTracker.js`: keep room/role/profile-specific duplicate guards;
  trainer and learner in separate tabs must not block each other.
- `AuthContext.jsx` and axios: replace LMS/device/passcode authentication with the
  sessionStorage demo identity. Remove production fallback URLs and LMS invalidation
  behavior. Do not replace an HTTP error with fake cached success.
- `utils/instructorSession.js`: extract the actively imported notes helper instead
  of retaining its obsolete state-hook variant or removing the used helper.
- Program/goal/report/coach-only services are reference-only. Remove their static
  AND dynamic imports from retained modules before build. Vite still resolves a
  dynamic import inside an inactive branch.

Material upload must be real trainer-authorized upload. Keep the current supported
types/100 MB validation from upload helpers, safe unique storage keys and thumbnail
behavior. Keep the content payload used by `createContentDragPayload`: type, URL,
title, dimensions and YouTube metadata as applicable. Use backend-served URLs usable
by both clients, never a trainer-only blob URL. Resolve `/api/uploads/...` correctly
with the new base URL; copied helpers sometimes remove `/api` themselves.

Image/video tags and PDF loading do not automatically attach axios bearer headers.
Use short-lived signed viewer URLs minted only for the trainer or admitted paired
learner, scoped to the room/file; the file route validates the signature/scope and
room access. Pending/uninvited learners cannot obtain board-material grants; preserve
trainer access for recording finalization/playback after room end, and any intended
paired-participant history access through its dedicated endpoints. Persist canonical
file keys, not browser blobs or expiring
signatures; generate fresh viewer URLs when returning metadata/restoration. A
guessed filename or the wrong participant's token cannot mint file access. Signed
viewer URLs are read capabilities; never include the full demo login token in them.

Keep URL helpers explicit: frontend `VITE_API_BASE_URL=http://localhost:8002/api`,
`VITE_WS_URL=ws://localhost:8002`; do not append `/api` twice. Do not reuse hardcoded
production TURN credentials; accept ICE JSON configuration. Missing TURN must be
reported for cross-network tests, while same-PC fake-device tests can use local ICE.

## 7. Phased implementation with stop checks

Keep `live-session-studio/docs/EXECUTION_STATUS.md` updated with phase, changed files,
commands/results, blockers, and exact next step. Use PASS/FAIL/NOT RUN, not vague
"working" labels. Do not mark later phases done because the first screen renders.

| Phase | Work | Gate before proceeding |
| --- | --- | --- |
| P0 Baseline | Verify manifest hashes, record source commit/dirty files, copy permitted baseline files/assets, create destination exclusion rules for `.env`, uploads, venv, node_modules and DB data. Preserve source paths. | All selected copies match hashes before edits; source LMS untouched. |
| P1 Independent shell | Pin frontend runtime versions from manifest; add only necessary dev test packages. Create fresh Vite/Tailwind shell/providers and minimal backend/config/migrations. Generate destination secrets and idempotent profile seed. | Clean install/build; fresh new DB migrated; backend health; role/profile login survives refresh independently in two tabs. |
| P2 Pairing | Trainer learner selector/start/resume, paired transaction, own invitations polling, live/offline state, end and API ownership tests. | Learner One sees own invite; Learner Two sees none and gets 403 on guessed room; repeat/concurrent Start does not duplicate. |
| P3 Live core | Copy/adapt relay/persistence, wire existing pages and admission, remove only panel UI, configure media. | Two browser contexts with synthetic A/V request/admit/reject/rejoin; real draw/select/drag sync and learner permissions; remote video retained. |
| P4 All tools and content | Trainer material upload/library/drop; PDF/media/YouTube sync; complete every tool row in section 8; repair learner edit persistence if source role filter loses changes. | Both peers exercise each tool; late join and refresh retain required board/media behavior; no source LMS network calls. |
| P5 Supporting session features | Notes, room comments, direct messaging, recording upload/retry/finalize/playback, end feedback and cleanup. | Actual DB/files/messages exist and replay; no mocked endpoints; end removes invite and closes obsolete sockets/timers. |
| P6 Delivery | Native `setup-local.bat`, Start/Stop/Status/Logs, README, examples, automated tests and completed evidence checklist. Verify clean setup and rerun behavior. | Whole acceptance matrix addressed with evidence; source untouched; no old LMS process/DB needed; remaining device/provider proof identified. |

Do not copy the entire old frontend package.json as the final dependency list.
Pin relevant versions from the manifest. Do not upgrade React, Vite, PDF.js or
Tailwind during extraction. For backend versions, select required packages from
`LIVE_SESSION_BACKEND_VERSIONS.json`, pin those versions, and create a full lock
in the new environment. That snapshot is not itself a complete pip lockfile. Avoid importing
S3/OpenCV/admin business modules merely to serve local files. Local recording still
requires FFmpeg. Use source upload helpers selectively for formats that need processing.

Each phase may have temporary integration gaps in the private destination; resolve
them before its gate. Temporary placeholders cannot remain in the delivered project.
If a command is blocked by environment/network permissions, complete unaffected work,
record the exact failing check and do not claim it passed. Do not reset/delete an
existing destination or database to make a rerun pass; inspect and reuse safely.

## 8. Mandatory two-peer acceptance matrix

For every row, record trainer action, learner observation/action, status, and evidence
path or exact automated command in `docs/PARITY_RESULTS.md` in the destination.

| ID | Feature and required check |
| --- | --- |
| F01 | Login as trainer and learner in separate tabs/contexts. Profile role pairing is validated; refresh does not swap identities. |
| F02 | Select learner, start, receive only own invitation via polling, join after offline login. No global room list. |
| F03 | Wrong learner cannot get room details, join, connect either socket, read uploads/chat/recordings belonging only to another room. |
| F04 | Admit/Reject/Remove, either connection order, repeat clicks, rejoin after refresh, no bypass before admission. |
| F05 | Pen colors/sizes and eraser match both peers; permission off blocks learner and on enables it. |
| F06 | Erase All removes strokes without deleting objects; Clear All clears the actual full board and active media state. |
| F07 | Select/drag/resize, text boxes and bucket operations synchronize; verify mouse and touch plus different canvas sizes. |
| F08 | Trainer uploads and drops image; learner sees it; returning it to content sidebar and re-dropping works. |
| F09 | PDF worker loads; page sync, pen/eraser annotations, per-page clear, refresh and redraw work on both sides with current permissions. |
| F10 | Video/audio content open/play/pause/seek/end/close sync, including late join and correct served file ranges. |
| F11 | YouTube popup and split display open/control/close behavior is retained; external availability is separately identified. |
| F12 | Q&A creation, learner live answers/submission and trainer receipt are retained. |
| F13 | Music 1/2/3 start/stop/volume, feedback messages and their sounds work on both peers after browser gesture. |
| F14 | Good Job, Wow, Doing Well, Thank You, Loved It, Relax, Bubbles, Smileys, Balloons, Stars and Wait retain current behavior and pop interactions. |
| F15 | Stopwatch start/pause/reset/countdown sound behavior remains synchronized. |
| F16 | Calculator permission, operations/results/clear/history retain existing synchronization. |
| F17 | Existing whiteboard comments work independently of room messaging. |
| F18 | Messaging widget direct text/file messages, read/typing/online behavior are real and scoped to the pair. |
| F19 | Real notes save/autosave/reload/clear/force-save; end does not silently discard pending changes. |
| F20 | Real browser recording, chunk retry, finalize, status and playback work. Ending does not delete chunks before finalization. |
| F21 | Real/synthetic trainer and learner A/V, mic/camera controls, freeze, retained remote video and its move/resize behavior where present. |
| F22 | Trainer/learner refresh and network interruption do not create duplicate listeners or stale sockets; trainer and learner board edits restore. |
| F23 | End updates learner UI, removes invitation by next poll, and stops new offers/joins. New room has no previous board/media leak. |
| F24 | Only requested program panel removed on desktop/mobile; no empty program column, lost video, missing toolbar, or accidental learner access expansion. |
| F25 | Fresh independent setup and safe rerun succeed with original LMS stopped. Source files/DB remain unchanged. |

Automate HTTP/state/authorization tests and browser tests wherever practical. Use
Chromium fake-device/fake-UI media flags in isolated test contexts when the PC has no
devices. Do not use screenshots alone as evidence for cross-peer synchronization.
Native camera/mic, touch hardware and real cross-network TURN evidence may be NOT RUN
with an explicit reason; implement those features and test what the environment allows.
Product completion with remaining proof gaps must be distinguished from all-tests-pass.

## 9. Token-efficient working rules and delivery

- Read the manifest and action list with a script; do not paste the entire JSON or
  multi-thousand-line components into context. Read imports, named functions and
  relevant call sites with `rg` and bounded file reads.
- Finish one phase before pursuing refinements. Retain source event names/structures.
  Do not swap canvas libraries or recreate the page from the supplied screenshot.
- Record decisions and next steps in the destination status file before context ends;
  resume from that file without rescanning everything.
- Do not send source `.env` secrets, live credentials, upload data, or database backups
  into the new repository. Generated local credentials remain ignored.
- Final delivery gives destination path, native start command, demo login selection,
  implemented feature matrix, tests run with results, and specific remaining proof
  gaps. Do not publish, deploy, or alter production infrastructure.

Maintainer command before handing off: `python scripts/extraction/build_execution_actions.py`
verifies the existing manifest and regenerates the action list. If a source hash
differs, inspect the change before refreshing the baseline. Do not regenerate
`LIVE_SESSION_EXTRACTION_MANIFEST.json` merely to hide a mismatch.
