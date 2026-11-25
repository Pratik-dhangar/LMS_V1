# Live Session Studio

A self-contained, standalone virtual classroom and live conference platform extracted from the LMS application. Built with **React 19 / Vite**, **FastAPI**, and **PostgreSQL**.

- **Frontend URL**: `http://localhost:5174`
- **Backend URL**: `http://localhost:8002` (API: `http://localhost:8002/api`)
- **WebSocket URL**: `ws://localhost:8002`
- **Database**: `live_session_studio` on port 5432 (User: `lss_user`)

---

## Key Features

1. **Passwordless Demo Authentication**:
   - Role-based login (Trainer / Learner) with named demo profiles.
   - Tab-isolated JWT storage using `sessionStorage` (`lss_access_token` and `lss_user`).
   - Multiple browser tabs can run simultaneously as Trainer, Learner One, and Learner Two without cross-tab session pollution.

2. **Targeted Room Pairing & Polling**:
   - Trainer selects a learner and creates an active paired room (`POST /api/rooms`).
   - Learner dashboard polls for incoming invitations on a 3-second interval (`GET /api/invitations/mine`).
   - Invitations are targeted exclusively to the selected learner; unselected learners see an empty list and cannot access or guess the room.
   - Idempotent: re-starting with the same learner returns the existing room.
   - Conflict-safe: starting with a second learner while a session is active returns HTTP 409.

3. **Admission Lifecycle & WebRTC Live Core**:
   - Learner clicks "Join" to request admission (`join_requested`).
   - Trainer receives an admission prompt and can **Admit**, **Reject**, or **Remove** the learner.
   - WebRTC offer/answer/ICE signaling and whiteboard state restoration wait until trainer admission is granted.
   - Full rejoin support if learner refreshes or disconnects.

4. **Synchronized Whiteboard & Classroom Tools**:
   - Multi-color pens, variable pen sizes (1–99), and eraser.
   - "Erase All" clears pen strokes while preserving items and background content; "Clear All" resets the full board.
   - Movable items, text boxes, and buckets with percentage-based coordinate normalization (1000x1000 grid).
   - Material upload and library (PDF documents, images, video, audio).
   - PDF viewer (`pdfjs-dist@4.10.38`) with page sync and per-page annotations.
   - Video and audio synchronization (play, pause, seek, open, close).
   - Embedded YouTube player popup.
   - Interactive exercises with real-time question/answer sync.
   - Synchronized stopwatch and calculator with trainer-controlled permission.
   - Background music player and synthesized sound feedback.
   - Floating reactions (bubbles, smileys, balloons, stars) and celebration confetti.
   - Direct room-scoped text and file chat messaging.

5. **Cleaned Layout**:
   - The entire legacy Learning Program panel has been removed from desktop and mobile views.
   - Remote video feed is cleanly retained in the left sidebar layout container with a 4:3 aspect ratio.

6. **Session Notes, Recording & Feedback**:
   - Auto-saved session notes (2s debounce) persisted directly to PostgreSQL.
   - In-browser chunked WebM video recording upload and FFmpeg concat demuxer merge into a ready video file.
   - 1–5 star learner feedback rating.

---

## Native Windows Quickstart

To run the entire standalone application on Windows:

1. Double-click or run:
   ```cmd
   setup-local.bat
   ```
   This script will:
   - Ensure the PostgreSQL database server is running.
   - Verify/create the `lss_user` user and `live_session_studio` database.
   - Activate the Python virtual environment and run database migrations (`alembic upgrade head`).
   - Install frontend npm dependencies if needed.
   - Launch the FastAPI backend on `http://localhost:8002` and the Vite dev server on `http://localhost:5174`.

2. Open two separate browser tabs or windows:
   - **Tab 1**: Navigate to `http://localhost:5174/login`, select **Trainer**, choose **Trainer Demo**, and log in.
   - **Tab 2**: Navigate to `http://localhost:5174/login`, select **Learner**, choose **Learner One**, and log in.

3. In Tab 1 (Trainer), select **Learner One** and click **Start Live Session**.
4. In Tab 2 (Learner), see the invitation card appear and click **Join Session**.
5. In Tab 1 (Trainer), accept the admission modal to bring the learner into the live classroom!

---

## Running Verification Tests

An automated verification test suite covers all acceptance criteria:

```powershell
.\live-session-studio\backend\.venv\Scripts\python.exe scripts\verify_live_session_parity.py
```

All 16 automated integration tests run against the live backend and verify:
- Backend health
- Passwordless demo authentication
- Trainer learner selection
- Paired room creation & idempotency
- Conflict gate (HTTP 409)
- Targeted invitation polling & isolation
- Cross-room 403 barriers
- Admission / reject / remove / rejoin lifecycle
- WebSocket token authentication & message relay
- Materials upload and file serving
- Session notes persistence
- 5-star feedback submission
- Direct chat messaging
- Recording chunk upload & FFmpeg finalization
- Room end & clean teardown

---

## Project Structure

```
live-session-studio/
├── backend/
│   ├── alembic/                  # Database migrations
│   ├── app/
│   │   ├── api/endpoints/        # demo, rooms, materials, uploads, notes, recordings, chat, websocket
│   │   ├── core/                 # config, deps
│   │   ├── crud/                 # whiteboard_crud
│   │   ├── db/                   # async session setup
│   │   ├── models/               # SQLAlchemy models
│   │   ├── services/             # recording_merge_service
│   │   └── utils/                # url_helpers
│   ├── main.py                   # FastAPI app entry point
│   └── requirements.txt          # Pinned backend dependencies
├── frontend/
│   ├── src/
│   │   ├── api/                  # axios, sessionService, whiteboardService, videoConferenceService, chatApi
│   │   ├── components/           # Whiteboard, Calculator, Stopwatch, MediaPopup, YouTubePopup, etc.
│   │   ├── context/              # AuthContext, ChatContext, MediaControlContext
│   │   ├── hooks/                # useInstructorSessionState, useInstructorEffects, useInstructorHandlers
│   │   ├── pages/                # LoginPage, TrainerDashboard, LearnerDashboard, TrainerSession, LearnerSession
│   │   ├── styles/               # session.css, index.css, Tailwind styles
│   │   └── utils/                # urlHelper, drawingSync, feedbackSounds, sessionActivityTracker
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── EXECUTION_STATUS.md       # Phase-by-phase status
│   └── PARITY_RESULTS.md         # 25-row evidence matrix
├── setup-local.bat               # Single-command Windows startup
└── README.md
```
