# Coach Implementation Documentation

## Overview
The Coach feature enables specialized coaching services within the Hurshbin Tech platform. Coaches can manage appointments, conduct group sessions, and set their availability. Users (Heads, Trainers, Learners) can book appointments with coaches for consultation sessions.

---

## Backend Implementation

### 1. Database Models

#### **CoachProfile Model**
Location: `hurshbintech-backend/app/models/user_model.py` (Lines 217-275)

```python
class CoachProfile(Base):
    __tablename__ = "coach_profiles"
    
    # Primary Fields
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Personal Information
    age = Column(Integer)
    address = Column(Text)
    contact_no = Column(String(20))
    qualification = Column(Text)
    experience = Column(Text)
    date_of_joining = Column(Date)
    
    # Coach-Specific Fields
    availability_days = Column(String(50))  # e.g., "Monday,Wednesday,Friday"
    time_slots = Column(String(100))  # e.g., "10am,1pm,3pm,5pm"
    specialization = Column(Text)
    profile_picture_url = Column(String(500))
    
    # Availability Status
    is_available = Column(Boolean, default=True)
    unavailable_until = Column(DateTime, nullable=True)
    unavailable_reason = Column(String(255))
    
    # Additional Profile Fields
    experience_with_hurshbin = Column(Text)
    interest = Column(Text)
    self_description = Column(Text)
    future_vision = Column(Text)
    number_of_sessions_done = Column(Integer, default=0)
```

**Key Features:**
- **Availability Management**: Coaches can set available days and time slots
- **Profile Picture**: Stored in `/uploads/profile_pictures/`
- **Temporary Unavailability**: Can mark unavailable until specific date/time
- **Specialization**: Coaches can specify their expertise areas

#### **Appointment Model**
Location: `hurshbintech-backend/app/models/user_model.py` (Lines 438-470)

```python
class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Relationships
    coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_role = Column(String(20), nullable=False)  # TRAINER, LEARNER, HEAD
    
    # Appointment Details
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String(20), nullable=False)  # "10am", "1pm", etc.
    status = Column(String(20), default="scheduled")  # scheduled, confirmed, cancelled, completed
    
    # Additional Information
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

**Fields:**
- `coach_id`: Links to CoachProfile
- `user_id`: User booking the appointment (can be Head, Trainer, or Learner)
- `user_role`: Role of the user booking (for authorization)
- `scheduled_date`: Date of appointment
- `scheduled_time`: Time slot (e.g., "10am", "1pm", "3pm", "5pm")
- `status`: Current appointment status
- `notes`: Contains session type and additional notes

**Note**: Payment screenshot URL is stored in `notes` field (consideration: may need dedicated field)

#### **CoachSession Model**
Location: `hurshbintech-backend/app/models/user_model.py` (Lines 472-505)

```python
class CoachSession(Base):
    __tablename__ = "coach_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False)
    
    # Session Details
    session_date = Column(Date, nullable=False)
    session_time = Column(String(20), nullable=False)
    session_title = Column(String(255))
    learning_content_id = Column(Integer, ForeignKey("learning_contents.id"), nullable=True)
    description = Column(Text)
    status = Column(String(20), default="scheduled")
    notes = Column(Text)
    
    # Relationships
    coach = relationship("CoachProfile")
    participants = relationship("CoachSessionParticipant", cascade="all, delete-orphan")
```

**Purpose**: Group coaching sessions with multiple participants (learners, trainers, heads)

#### **CoachSessionParticipant Model**
Location: `hurshbintech-backend/app/models/user_model.py` (Lines 507-534)

```python
class CoachSessionParticipant(Base):
    __tablename__ = "coach_session_participants"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("coach_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    participant_role = Column(String(20), nullable=False)  # trainer, learner, head
    status = Column(String(20), default="invited")  # invited, accepted, declined, attended
```

**Purpose**: Many-to-many relationship between sessions and participants

---

### 2. API Endpoints

#### **Booking Endpoints** (`/api/booking/`)
Location: `hurshbintech-backend/app/api/endpoints/booking.py`

**GET `/api/booking/available-coaches`**
- **Purpose**: List all available coaches
- **Access**: Any authenticated user (HEAD, TRAINER, LEARNER)
- **Response**: List of coaches with profiles
- **Example Response**:
```json
[
  {
    "id": 1,
    "user_id": 5,
    "name": "John Doe",
    "email": "john@example.com",
    "specialization": "Mental Health & Wellness",
    "profile_picture_url": "/uploads/profile_pictures/coach_5.jpg",
    "availability_days": "Monday,Wednesday,Friday",
    "time_slots": "10am,1pm,3pm,5pm",
    "is_available": true,
    "experience": "5 years of coaching experience"
  }
]
```

**POST `/api/booking/book-appointment`**
- **Purpose**: Book appointment with a coach
- **Access**: Any authenticated user
- **Request**: FormData
  - `coach_id`: int (required)
  - `scheduled_date`: date (required) - YYYY-MM-DD
  - `scheduled_time`: string (required) - e.g., "10am"
  - `session_type`: string (required) - "initial", "followup", "extended"
  - `notes`: string (optional)
  - `payment_screenshot`: file (optional) - JPG/PNG/GIF, max 5MB
- **Validations**:
  - Coach exists
  - Coach is available (`is_available = true`)
  - File type validation
  - File size validation (max 5MB)
- **Response**: Created appointment details

**GET `/api/booking/my-appointments`**
- **Purpose**: Get all appointments booked by current user
- **Access**: Any authenticated user
- **Response**: List of user's appointments

#### **Coach Endpoints** (`/api/coaches/`)
Location: `hurshbintech-backend/app/api/endpoints/coach.py`

**GET `/api/coaches/appointments`**
- **Purpose**: Get all appointments for logged-in coach
- **Access**: COACH role only
- **Response**: List of appointments with user details
- **Example Response**:
```json
[
  {
    "id": 1,
    "coach_id": 1,
    "user_id": 10,
    "user_name": "Jane Smith",
    "user_role": "LEARNER",
    "scheduled_date": "2024-01-15",
    "scheduled_time": "10am",
    "status": "scheduled",
    "session_type": "Initial Session",
    "payment_screenshot_url": "/uploads/payment_screenshots/abc123.jpg",
    "notes": "Looking for guidance on career development"
  }
]
```

**GET `/api/coaches/sessions`**
- **Purpose**: Get all sessions created by coach
- **Access**: COACH role only
- **Response**: List of coach sessions with participants

**POST `/api/coaches/sessions`**
- **Purpose**: Create a new group coaching session
- **Access**: COACH role only
- **Request**:
  - `session_date`: date
  - `session_time`: string
  - `session_title`: string
  - `learning_content_id`: int (optional)
  - `description`: text
  - `learner_ids`: array of int
  - `trainer_ids`: array of int
  - `head_ids`: array of int

**PUT `/api/coaches/availability`**
- **Purpose**: Update coach's availability status
- **Access**: COACH role only
- **Request**:
  - `is_available`: boolean
  - `unavailable_until`: datetime (optional)
  - `unavailable_reason`: string (optional)

---

### 3. CRUD Operations

Location: `hurshbintech-backend/app/crud/coach_crud.py`

#### **Appointment CRUD**

```python
async def create_appointment(db, appointment_data, user_id, user_role) -> Appointment
```
- Creates new appointment
- Sets default status to "scheduled"
- Returns created appointment

```python
async def get_appointments_by_coach(db, coach_id) -> list[Appointment]
```
- Fetches all appointments for specific coach
- Uses `joinedload` for relationships (coach, user)
- Orders by date and time

```python
async def get_appointments_by_user(db, user_id) -> list[Appointment]
```
- Fetches all appointments booked by specific user
- Returns with coach details

```python
async def update_appointment(db, appointment_id, appointment_update) -> Appointment
async def delete_appointment(db, appointment_id) -> bool
```

#### **Coach Session CRUD**

```python
async def create_coach_session(db, session_data, coach_id) -> CoachSession
```
- Creates session with participants
- Adds learners, trainers, and heads as participants
- Sets participant status to "invited"

```python
async def get_coach_sessions(db, coach_id) -> list[CoachSession]
async def get_user_coach_sessions(db, user_id) -> list[CoachSession]
async def update_coach_session(db, session_id, session_update) -> CoachSession
async def delete_coach_session(db, session_id) -> bool
```

---

### 4. File Storage

#### **Profile Pictures**
- **Location**: `uploads/profile_pictures/`
- **Uploaded by**: Admin when creating coach profile
- **Formats**: JPG, PNG, GIF
- **Access**: Public via `/uploads/profile_pictures/{filename}`

#### **Payment Screenshots**
- **Location**: `uploads/payment_screenshots/`
- **Uploaded by**: Users when booking appointments
- **Naming**: UUID-based unique filenames
- **Formats**: JPG, PNG, GIF
- **Size Limit**: 5MB
- **Access**: Viewable by coach and booking user

---

## Frontend Implementation

### 1. User Booking Flow

#### **BookAppointment Page**
Location: `hurshbintech-frontend/src/pages/common/BookAppointment.jsx`

**Features:**
- Displays all available coaches in 2-column grid
- Search functionality to filter coaches by name
- Shows coach profile picture, name, specialization, and session fee
- "Book Appointment" button navigates to booking form

**Layout:**
- Uses standard `page-container` → `page-main` → `page-content` structure
- Responsive grid layout
- Coach cards with avatar, name, specialization, star rating

#### **BookAppointmentForm Page**
Location: `hurshbintech-frontend/src/pages/common/BookAppointmentForm.jsx`

**Features:**
- Date picker for appointment date
- Time slot dropdown (populated from coach's `time_slots`)
- Session type selection:
  - **Initial Session**: ₹2,500
  - **Follow-up Session**: ₹2,000
  - **Extended Session**: ₹3,500
- Payment screenshot upload with preview
- Additional notes field

**Validation:**
- Required fields: date, time, session type
- File validation: type (JPG/PNG/GIF) and size (5MB)
- Payment screenshot optional

**Submission:**
- Creates FormData with appointment details and payment screenshot
- Calls `bookingService.bookAppointment(formData)`
- Shows success toast and redirects to bookings page

---

### 2. Coach Dashboard

Location: `hurshbintech-frontend/src/pages/coach/Dashboard.jsx`

**Tab Structure:**
1. **Overview Tab**
   - Stats cards: Total Appointments, Upcoming Sessions, Total Participants
   - Upcoming appointments list
   - Quick actions: Create Session, View Schedule

2. **Appointments Tab**
   - Read-only view of appointments booked by users
   - Uses `AppointmentsManager` component

3. **Sessions Tab**
   - Create and manage group coaching sessions
   - Uses `SessionsManager` component

4. **Availability Tab**
   - Set available days and time slots
   - Mark as available/unavailable
   - Uses `AvailabilityManager` component

---

### 3. Coach Components

#### **AppointmentsManager Component**
Location: `hurshbintech-frontend/src/components/coach/AppointmentsManager.jsx`

**Features:**
- **Appointment Cards**:
  - Date (formatted: "Monday, January 15, 2024")
  - Time slot (e.g., "10:00 AM")
  - User name with role badge (Learner/Trainer/Head)
  - "View Details" button

- **Appointment Details Modal**:
  - Client name
  - Full date and time
  - Session type (formatted from notes)
  - Payment screenshot viewer (opens in new tab)
  - Additional notes
  - Status badge

**Modal Structure:**
```jsx
<div className="modal-overlay">
  <div className="modal-content">
    <div className="modal-header">
      <h3>Appointment Details</h3>
      <button onClick={closeModal}>×</button>
    </div>
    <div className="modal-body">
      {/* Appointment details */}
      <button onClick={() => window.open(paymentUrl, '_blank')}>
        View Payment Screenshot
      </button>
    </div>
  </div>
</div>
```

**Styling:**
- Uses fixed modal styles from `Pages.css`
- Proper overlay with `z-index: 1000`
- White background, scrollable body
- Responsive design

#### **SessionsManager Component**
Location: `hurshbintech-frontend/src/components/coach/SessionsManager.jsx`

**Features:**
- **Create Session Form**:
  - Session date and time
  - Session title
  - Optional learning content selection
  - Description and notes
  - Participant selection with unified search:
    - Filter by role (All/Learner/Trainer/Head)
    - Search by name
    - Add/remove participants
    - Visual participant chips with role badges

- **Sessions List**:
  - Cards showing date, time, title
  - Participant count by role
  - Status badge
  - View details button

**API Integration:**
- Fetches available users: `coachService.getAvailableLearners()`, `getAvailableTrainers()`, `getAvailableHeads()`
- Fetches learning contents: `coachService.getLearningContents()`
- Creates session: `coachService.createSession(sessionData)`

#### **AvailabilityManager Component**
Location: `hurshbintech-frontend/src/components/coach/AvailabilityManager.jsx`

**Features:**
- **Toggle Availability**:
  - Available/Unavailable switch
  - Shows current status with color indicator

- **Set Unavailability**:
  - Date picker for "Unavailable Until"
  - Reason text field
  - Update button

**API Integration:**
- Fetches current availability: `getCoachAvailability(coachId)`
- Updates availability: `updateCoachAvailability(isAvailable, unavailableUntil, reason)`

---

### 4. API Services

#### **Booking Service**
Location: `hurshbintech-frontend/src/api/services/bookingService.js`

```javascript
export const bookingService = {
  // Get all available coaches
  getAvailableCoaches: async () => {
    const response = await api.get('/api/booking/available-coaches');
    return response.data;
  },

  // Book appointment with coach
  bookAppointment: async (formData) => {
    const response = await api.post('/api/booking/book-appointment', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Get user's appointments
  getMyAppointments: async () => {
    const response = await api.get('/api/booking/my-appointments');
    return response.data;
  }
};
```

#### **Coach Service**
Location: `hurshbintech-frontend/src/api/services/coachService.js`

```javascript
const coachService = {
  // Appointments
  getMyAppointments: async () => { /* ... */ },
  
  // Sessions
  getMySessions: async () => { /* ... */ },
  createSession: async (sessionData) => { /* ... */ },
  
  // Availability
  updateAvailability: async (isAvailable, unavailableUntil, reason) => { /* ... */ },
  
  // Participants
  getAvailableLearners: async () => { /* ... */ },
  getAvailableTrainers: async () => { /* ... */ },
  getAvailableHeads: async () => { /* ... */ },
  
  // Learning Contents
  getLearningContents: async () => { /* ... */ }
};
```

---

## Current Features Summary

### ✅ Completed Features

1. **Coach Profile Management**
   - Admin creates coach profiles with personal details
   - Profile pictures stored and displayed
   - Specialization and experience tracking
   - Availability days and time slots configuration

2. **Appointment Booking**
   - Users (Head, Trainer, Learner) can view available coaches
   - Book appointments with date/time selection
   - Session type selection with pricing
   - Payment screenshot upload and storage
   - Appointment creation with validation

3. **Coach Appointments View**
   - Coaches can view all their appointments
   - Appointment cards with date, time, user details
   - Modal with full appointment details
   - Payment screenshot viewing

4. **Group Coaching Sessions**
   - Coaches can create sessions with multiple participants
   - Link sessions to learning content
   - Invite learners, trainers, and heads
   - Track participant status

5. **Availability Management**
   - Coaches can toggle availability status
   - Set temporary unavailability with date and reason
   - Automatic availability reset when unavailability period expires

6. **Authentication & Authorization**
   - Role-based access control (ADMIN, HEAD, TRAINER, COACH, LEARNER)
   - Protected endpoints for coach-only operations
   - Public booking endpoints for all authenticated users

---

## Current Limitations & Missing Features

### ❌ Not Implemented

1. **Appointment Status Management**
   - No enum for appointment status (currently string)
   - Status workflow not defined (PENDING → CONFIRMED → COMPLETED)
   - Coaches cannot accept/reject appointment requests
   - No status change endpoints

2. **Availability Logic & Double-Booking Prevention**
   - ⚠️ **CRITICAL**: No check for existing appointments on same date/time
   - Users can book appointments even if slot already taken
   - No real-time availability checking in frontend
   - Time slot dropdown shows all coach's slots (not filtered by availability)
   - No calculation of available slots based on existing appointments

3. **Payment Verification**
   - Payment screenshots stored but not reviewed/verified
   - No payment status tracking
   - No admin approval workflow for appointments

4. **Notifications**
   - No email/SMS notifications for new appointments
   - No reminders for upcoming appointments
   - No alerts for appointment status changes

5. **Calendar Integration**
   - No calendar view for coach's schedule
   - No conflict detection UI
   - No visual availability calendar for users

6. **Appointment Management Features**
   - Cannot reschedule appointments
   - Cannot cancel appointments (from user or coach side)
   - No appointment history tracking
   - No completion marking

7. **Session Recording & Notes**
   - No post-session notes by coach
   - No session outcome tracking
   - No feedback mechanism

---

## Database Schema Relationships

```
User (users table)
  └─ One-to-One → CoachProfile (coach_profiles table)
       ├─ One-to-Many → Appointment (appointments table)
       ├─ One-to-Many → CoachSession (coach_sessions table)
       │    └─ One-to-Many → CoachSessionParticipant (coach_session_participants table)
       │         └─ Many-to-One → User (users table)
       └─ One-to-Many → CoachReferenceData (coach_reference_data table)

Appointment (appointments table)
  ├─ Many-to-One → CoachProfile (coach_profiles table)
  └─ Many-to-One → User (users table)

CoachSession (coach_sessions table)
  ├─ Many-to-One → CoachProfile (coach_profiles table)
  └─ Many-to-One → LearningContent (learning_contents table) [optional]
```

---

## File Structure

### Backend
```
hurshbintech-backend/
├── app/
│   ├── models/
│   │   └── user_model.py              # CoachProfile, Appointment, CoachSession models
│   ├── schemas/
│   │   └── user.py                    # Pydantic schemas for requests/responses
│   ├── crud/
│   │   └── coach_crud.py              # CRUD operations for coach features
│   ├── api/
│   │   └── endpoints/
│   │       ├── booking.py             # Public booking endpoints
│   │       └── coach.py               # Coach-only endpoints
│   └── core/
│       ├── deps.py                    # Dependency injection (auth)
│       └── security.py                # JWT authentication
└── uploads/
    ├── profile_pictures/              # Coach profile images
    └── payment_screenshots/           # Payment proof uploads
```

### Frontend
```
hurshbintech-frontend/
├── src/
│   ├── pages/
│   │   ├── coach/
│   │   │   └── Dashboard.jsx          # Coach dashboard with tabs
│   │   └── common/
│   │       ├── BookAppointment.jsx    # Coach listing page
│   │       └── BookAppointmentForm.jsx # Appointment booking form
│   ├── components/
│   │   └── coach/
│   │       ├── AppointmentsManager.jsx # View appointments
│   │       ├── SessionsManager.jsx     # Create/manage sessions
│   │       └── AvailabilityManager.jsx # Set availability
│   ├── api/
│   │   └── services/
│   │       ├── bookingService.js      # Booking API calls
│   │       └── coachService.js        # Coach-specific API calls
│   └── styles/
│       ├── Pages.css                  # Standard page layouts & modals
│       ├── Dashboards.css             # Dashboard styles
│       └── Coach.css                  # Coach-specific styles
```

---

## Key Design Decisions

1. **Time Slots**: Stored as comma-separated string (e.g., "10am,1pm,3pm,5pm")
   - Simple to manage and update
   - Easy to parse in frontend
   - Consideration: Could use JSON array for more flexibility

2. **Payment Screenshots**: Uploaded as files, stored in filesystem
   - Path stored in appointment notes (temporary solution)
   - Alternative: Add dedicated `payment_screenshot_url` field to Appointment model

3. **Appointment Status**: Currently string field
   - Recommendation: Convert to enum with defined workflow
   - Suggested values: PENDING, CONFIRMED, REJECTED, CANCELLED, COMPLETED, NO_SHOW

4. **User Roles**: Uppercase enum values (ADMIN, HEAD, TRAINER, COACH, LEARNER)
   - Consistent with initial database migration
   - Case-sensitive in PostgreSQL

5. **Modal Styling**: Global styles in Pages.css
   - z-index: 1000 (above navbar at 999)
   - Dark overlay: rgba(0, 0, 0, 0.6)
   - White content background with border-radius
   - Scrollable body with max-height

---

## Next Steps & Recommendations

### Priority 1: Availability Logic & Double-Booking Prevention
**Status**: ⚠️ CRITICAL - Production-blocking issue

**Required Changes**:
1. Add helper function to calculate available slots
2. Create endpoint to fetch available slots for specific coach and date
3. Add double-booking check in appointment creation
4. Update frontend to show only available time slots

### Priority 2: Appointment Status Workflow
**Status**: ⚠️ HIGH - Core feature missing

**Required Changes**:
1. Create `AppointmentStatus` enum
2. Update `Appointment.status` to use enum
3. Add endpoints for coach to accept/reject appointments
4. Add status change UI in coach dashboard
5. Create appointment request notification system

### Priority 3: Payment Verification
**Status**: 🔄 MEDIUM - Business requirement

**Required Changes**:
1. Add `payment_screenshot_url` field to Appointment model
2. Admin approval workflow for payment verification
3. Payment status tracking

### Priority 4: Enhanced Features
**Status**: 📋 LOW - Nice to have

**Potential Features**:
- Calendar view for coaches
- Appointment rescheduling
- Session notes and feedback
- Email/SMS notifications
- Appointment history and analytics

---

## Testing Recommendations

1. **Double-Booking Test**: Try booking same slot twice with different users
2. **Availability Toggle**: Test coach marking unavailable and booking attempts
3. **File Upload**: Test payment screenshot with various formats and sizes
4. **Role Authorization**: Verify only coaches can access coach endpoints
5. **Modal Display**: Test modals on various screen sizes
6. **Session Creation**: Test with multiple participants from different roles

---

## Conclusion

The coach implementation provides a solid foundation for coaching services with appointment booking, group sessions, and availability management. However, critical features like double-booking prevention and appointment status workflow are missing and should be prioritized for production deployment.
