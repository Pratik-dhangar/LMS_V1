# HurshbinTech PWA - Features Implemented

**Document Version:** 1.0
**Last Updated:** December 11, 2025

---

## Project Overview

HurshbinTech is a **Progressive Web App (PWA) Learning Management System** designed for professional training and development. It enables real-time video conferencing, interactive whiteboard sessions, and comprehensive progress tracking for learners.

### Tech Stack
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL 16
- **Cloud Storage:** AWS S3
- **Infrastructure:** Docker Compose + Nginx

---

## 1. User Roles & Access Control

### Five User Roles Implemented

| Role | Dashboard | Capabilities |
|------|-----------|--------------|
| **Admin** | `/admin/dashboard` | Full system control, manages Heads, Learning Content, Vlogs |
| **Head** | `/head/dashboard` | Manages Learners, Trainers, Sessions, Program Assignments |
| **Trainer** | `/trainer/dashboard` | Conducts live sessions, uses whiteboard, provides feedback |
| **Learner** | `/learner/dashboard` | Participates in sessions, views assigned programs |
| **Consultant** | `/consultant/dashboard` | Advisory role, coaching capabilities |

### Role-Based Access Control (RBAC)
- Protected routes with `ProtectedRoute` component
- JWT token-based authentication (24-hour expiration)
- Passcode-based login system
- Encrypted credential storage (Fernet + bcrypt)

---

## 2. Authentication & Security

### Implemented Features
- Passcode-based login (not email/password)
- JWT (HS256) token authentication
- Encrypted passcode storage using Fernet symmetric encryption
- Password verification with bcrypt
- Admin can reveal user passcodes for resets
- Role-based dashboard redirection after login
- CORS protection with whitelist
- Rate limiting via SlowAPI
- Request logging with correlation IDs

---

## 3. User Profile Management

### Admin Features
- Create, edit, delete Head accounts
- View all Trainers, Learners, Consultants
- Manage system-wide learning content
- Access dashboard statistics

### Head Features
- Register and manage Learners (comprehensive 7-section form)
  - Personal details
  - Medical history
  - Learning history
  - Assessment behavior
  - Intervention history
  - Skill development
  - Delivery history
- Register and manage Trainers
- View learner progress reports

### Profile Data Stored
- **Head:** Organization name, address, contact info, qualifications
- **Trainer:** Specializations, experience level, certifications
- **Learner:** Age, gender, DOB, contact, medical history, learning history, assessments
- **Consultant:** Specialization areas, experience, availability

---

## 4. Session Management

### Session Lifecycle
1. **Scheduled** - Head creates session with Trainer/Learner assignment
2. **Active** - Session in progress (video call + whiteboard)
3. **Ended** - Session completed with duration tracked
4. **Cancelled** - Session cancelled by Head

### Session Features
- Schedule sessions between Trainer and Learner
- Assign learning goals to sessions
- Session timer/stopwatch with audio alerts
- Session duration automatic calculation
- Session notes creation and editing
- Clickable sessions in lists for details

---

## 5. Real-Time Video Conferencing

### WebRTC Implementation
- Peer-to-peer video/audio streaming
- STUN servers (Google) for NAT traversal
- TURN servers (OpenRelay) for fallback connectivity
- ICE candidate handling with proper queuing

### Video Features
- Trainer and Learner video feeds
- Moveable/resizable video windows
- Video on/off toggle for both participants
- Audio on/off toggle
- Trainer can control Learner's media visibility
- Connection state monitoring
- Automatic reconnection attempts
- Heartbeat mechanism (30-second ping, 60-second timeout)

---

## 6. Interactive Whiteboard

### Drawing Tools
- Pencil tool with adjustable brush size
- Eraser tool
- Shape tools (rectangles, circles)
- Line tool
- Text tool
- Color picker (full palette)
- Undo/Redo functionality

### Real-Time Synchronization
- WebSocket-based drawing sync
- All strokes visible to both Trainer and Learner
- Minimal latency for live collaboration

### Special Features
- **Floating Animations:** Emoji reactions, balloons, stars, smileys
- **Exercise Display:** Fill-in-the-blanks interactive quizzes
- **Message Display:** Text messages shown on canvas
- **Stopwatch Display:** Session timer on whiteboard
- **Feedback Display:** Reinforcement messages from Trainer

---

## 7. Learning Content Management

### Content Types Supported
- Images (JPG, PNG)
- Videos (MP4, WebM)
- PDFs
- Audio files (MP3, WAV)
- Documents (DOCX)

### Features
- File upload with S3 storage
- Automatic thumbnail generation
  - Images: PIL-based resizing
  - Videos: First-frame extraction via OpenCV
- Content assignment to learners
- Content display during sessions
- Media player with controls

---

## 8. Learning Goals & Programs

### Learning Goals
- Admin creates learning objectives
- Goals assignable to sessions
- Track progress per goal per session

### Learning Programs
- Programs combine multiple learning goals
- Assign programs to learners
- Program-level progress tracking
- View assigned programs in Learner dashboard

---

## 9. Session Reports & Progress Tracking

### Report Metrics
- **Prompt Meter:** Scale 1-10 + "I" (Independent)
- **Reinforcement Meter:** Full to 10% in decrements
- Per-program progress within each session
- Session notes attached to reports

### Analytics Features
- Bar charts showing prompt/reinforcement trends
- Line graphs for improvement over time
- **Time-based X-axis** showing session dates/times
- Interactive chart tooltips
- Click on chart bars to view session details
- Group reports by program
- Learner-specific statistics

---

## 10. Data Visualization (Graphs)

### Implemented Charts (Recharts Library)
- Progress bar charts
- Trend line graphs
- Time series with session dates on X-axis
- Interactive elements (click handlers)
- Responsive sizing
- Custom tooltips

### Report Card / PDF Export
- Generate downloadable progress reports
- jsPDF library for PDF creation
- html2canvas for screenshot capture

---

## 11. Training Vlogs

### Features
- Admin uploads training videos
- Automatic thumbnail extraction (first frame)
- Video metadata storage (title, description, file size)
- Vlog editing and deletion
- Role-based access to vlogs
- Head can view vlogs in their dashboard

---

## 12. Progressive Web App (PWA)

### PWA Features
- **Service Worker** for background sync and caching
- **Offline Support** with Workbox caching strategies
- **Installable** on mobile and desktop devices
- **Web App Manifest** with app metadata
- **App Icons** (8 sizes: 72x72 to 512x512)
- **Landscape Orientation** lock for sessions
- **Auto-update** detection and prompts

### Caching Strategy
- Cache API for static assets
- Network-first for API calls
- Fallback responses for offline scenarios

---

## 13. File Storage (AWS S3)

### Implementation
- Automatic file upload to S3 buckets
- Organized folder structure
- Permanent public HTTPS URLs via Nginx proxy
- Thumbnail generation and storage
- File deletion capability
- Fallback to local `/uploads` directory if S3 disabled

---

## 14. Voice Input & Speech Recognition

### Features
- Web Speech API integration
- Continuous speech recognition
- Interim results display
- Multi-language support (configurable)
- Error recovery with exponential backoff

---

## 15. UI/UX Features

### Design System
- Responsive design (mobile, tablet, desktop)
- Tailwind CSS utility-first styling
- Theme-aware components

### User Experience
- Toast notifications (React Toastify)
- Loading states and spinners
- Error boundaries for graceful failures
- Search and filter capabilities
- Pagination for large datasets
- Emoji support (twemoji for cross-platform)
- Custom logger for debugging

---

## 16. Backend API Endpoints

### Authentication
- `POST /api/auth/user/login` - Passcode login

### Admin
- CRUD operations for Heads
- List Trainers, Learners, Consultants
- Dashboard statistics
- Passcode reveal endpoint

### Head
- CRUD for Trainers and Learners
- Session management
- Program assignments

### Sessions
- Create, list, update, delete sessions
- End session endpoint
- Assign learning goals/content to sessions

### Session Reports
- Create reports with metrics
- Get reports by session or learner
- Grouped and statistical views

### Learning Content
- Upload with thumbnail generation
- CRUD operations

### WebSocket Endpoints
- `/ws/rtc/{session_id}/{role}` - WebRTC signaling
- `/ws/whiteboard/{session_id}/{role}` - Drawing sync

---

## 17. Testing Infrastructure

### Frontend Testing
- Vitest for unit tests
- React Testing Library for components
- Playwright for E2E tests
- Coverage reporting

### Backend Testing
- Pytest with async support
- Faker for test data
- pytest-cov for coverage

---

## 18. DevOps & Deployment

### Containerization
- Docker for frontend and backend
- Docker Compose orchestration
- Nginx reverse proxy configuration

### CI/CD
- Bitbucket Pipelines for automated deployment

### Production Setup
- AWS EC2 hosting
- HTTPS with SSL certificates
- Environment-based configuration

---

## Feature Summary by Role

### Admin Can:
- Manage all Heads (create, edit, delete)
- View all users in the system
- Create and manage Learning Goals
- Create and manage Learning Content
- Manage Training Vlogs
- View system-wide statistics
- Reveal user passcodes

### Head Can:
- Register and manage Learners
- Register and manage Trainers
- Schedule and manage training sessions
- Assign learning programs to learners
- Assign learning content to learners
- View learner progress reports with graphs
- View training vlogs

### Trainer Can:
- Conduct live video sessions with learners
- Use interactive whiteboard
- Control learner's media visibility (video on/off)
- Send floating animations and feedback
- Record session notes
- Track prompt/reinforcement metrics
- Select learning goals for sessions

### Learner Can:
- Join scheduled video sessions
- Interact with shared whiteboard
- View assigned learning programs
- Access assigned learning content
- View personal progress

### Consultant Can:
- Access consultant dashboard
- Provide coaching and consultation

---

## Recent Updates (Based on Commit History)

1. **Graph Time Axis** - X-axis now shows time/date for progress charts
2. **Video On/Off Toggle** - Trainer can control video visibility
3. **Clickable Sessions** - Sessions in lists are now clickable for details
4. **Report Generation** - PDF report export functionality
5. **Migration System** - Alembic database migrations

---

## Technical Highlights

- **50+ Routes** with role-based protection
- **Real-time WebSocket** communication
- **Peer-to-peer WebRTC** for scalable video
- **Async-first Backend** for high concurrency
- **Automatic Thumbnail** generation
- **Multi-device PWA** support
- **Comprehensive Logging** with correlation IDs
- **Production-ready** Docker deployment

---

*This document provides an overview of all features implemented in the HurshbinTech PWA Learning Management System.*
