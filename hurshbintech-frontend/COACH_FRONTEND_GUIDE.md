# Coach Frontend Implementation Guide

## Overview
This document outlines the coach-related frontend components and functionality that were created to match the backend coach API implementation.

## Directory Structure

```
hurshbintech-frontend/src/
├── pages/
│   └── coach/
│       └── Dashboard.jsx           # Main coach dashboard page
├── components/
│   └── coach/
│       ├── AppointmentsManager.jsx # Manage appointments CRUD
│       ├── SessionsManager.jsx     # Manage sessions & participants
│       └── AvailabilityManager.jsx # Manage coach availability status
├── api/
│   └── coach/
│       └── coachApi.js             # API calls for coach endpoints
└── styles/
    └── Coach.css                   # Coach-specific CSS
```

## Components

### 1. CoachDashboard (`pages/coach/Dashboard.jsx`)
Main dashboard page with tab-based navigation.

**Features:**
- Overview tab with stats and upcoming events
- Quick actions shortcuts
- Tab navigation between Overview, Appointments, Sessions, and Availability
- Consistent styling with existing dashboard pages
- Welcome message with user name

**Route:** `/coach/dashboard`

### 2. AppointmentsManager (`components/coach/AppointmentsManager.jsx`)
Manage coach appointments with users.

**Features:**
- List all appointments
- Create new appointments
- Edit existing appointments
- Delete appointments
- Date and time slot selection (10am, 1pm, 3pm, 5pm)
- Optional notes field
- Appointment status display

**API Calls:**
- `createAppointment()` - POST
- `getCoachAppointments()` - GET
- `updateAppointment()` - PATCH
- `deleteAppointment()` - DELETE

### 3. SessionsManager (`components/coach/SessionsManager.jsx`)
Manage group coaching sessions.

**Features:**
- List all sessions
- Create new sessions
- Edit existing sessions
- Delete sessions
- Expandable session details
- View and manage participants
- Session status tracking
- Description and notes fields

**API Calls:**
- `createSession()` - POST
- `getCoachSessions()` - GET
- `updateSession()` - PATCH
- `deleteSession()` - DELETE
- `removeSessionParticipant()` - DELETE

### 4. AvailabilityManager (`components/coach/AvailabilityManager.jsx`)
Manage coach availability status for scheduling.

**Features:**
- Toggle between available/unavailable status
- Set unavailability date range
- Select unavailability reason (On Leave, Fully Booked, Personal, etc.)
- Visual status indicators
- Display current availability schedule
- Real-time status updates

**API Calls:**
- `updateCoachAvailability()` - PATCH
- `getCoachAvailability()` - GET

## API Service

### File: `api/coach/coachApi.js`

**Availability Endpoints:**
```javascript
updateCoachAvailability(isAvailable, unavailableUntil, unavailableReason)
getCoachAvailability(coachId)
```

**Profile Picture:**
```javascript
uploadProfilePicture(file)
```

**Appointments:**
```javascript
createAppointment(appointmentData)
getCoachAppointments()
getAppointmentDetails(appointmentId)
updateAppointment(appointmentId, updateData)
deleteAppointment(appointmentId)
```

**Sessions:**
```javascript
createSession(sessionData)
getCoachSessions()
getSessionDetails(sessionId)
updateSession(sessionId, updateData)
deleteSession(sessionId)
```

**Session Participants:**
```javascript
addSessionParticipant(sessionId, participantData)
updateParticipantStatus(sessionId, userId, status)
removeSessionParticipant(sessionId, userId)
```

## Styling

### CSS Classes
All styling uses the existing dashboard CSS patterns with coach-specific additions in `Coach.css`.

**Key Styles:**
- `.coach-tabs` - Tab navigation styling
- `.coach-tab` - Individual tab styling
- `.coach-form-section` - Form container styling
- `.coach-btn-*` - Button variants (primary, success, danger, secondary)
- `.coach-status-badge` - Status indicator badges
- `.coach-event-item` - Appointment/session item styling
- `.coach-availability-card` - Availability status card

### Responsive Design
- Mobile-first approach
- Tablet adjustments for medium screens
- Desktop optimizations
- Same breakpoints as existing application

### Color Scheme
Matches existing application:
- Primary Blue: `#2563eb`
- Success Green: `#22c55e`
- Danger Red: `#ef4444`
- Gray palette for text and borders
- Background colors from design system

## Form Data Structure

### Appointment Form
```javascript
{
  coach_id: number,
  scheduled_date: "YYYY-MM-DD",
  scheduled_time: string, // "10am", "1pm", "3pm", "5pm"
  notes: string (optional)
}
```

### Session Form
```javascript
{
  coach_id: number,
  session_date: "YYYY-MM-DD",
  session_time: string, // "10am", "1pm", "3pm", "5pm"
  session_title: string,
  description: string,
  notes: string (optional)
}
```

### Availability Form
```javascript
{
  is_available: boolean,
  unavailable_until: "YYYY-MM-DD" (optional, if not available),
  unavailable_reason: string (optional)
}
```

## Authentication

All API calls require JWT token in localStorage:
```javascript
Authorization: Bearer {token}
```

Token is automatically included via `getAuthConfig()` helper function.

## Error Handling

- Error messages displayed in red error boxes
- Success messages shown in green success boxes
- Loading states with spinner text
- Form validation on submit
- User confirmation for delete operations

## Integration with App.jsx

### Routes
```jsx
<Route
  path="/coach/dashboard"
  element={
    <ProtectedRoute allowedRoles={['coach']}>
      <CoachDashboard />
    </ProtectedRoute>
  }
/>
```

### Dashboard Routing
Added to `getDashboardPath()` function:
```javascript
coach: '/coach/dashboard'
```

## Usage

### For Coaches
1. Login with coach credentials
2. Navigate to Coach Dashboard (if role is "coach")
3. Use tabs to navigate between sections
4. Create/edit/delete appointments and sessions
5. Manage availability status

### Development
1. Ensure backend is running on `localhost:8000` (or set `REACT_APP_API_URL`)
2. Run frontend: `npm run dev`
3. Test coach flows with a coach user token
4. Check browser console for API errors

## Future Enhancements

1. **Profile Picture Upload**
   - Component ready in backend
   - Frontend form can be added to profile settings

2. **Session Recording**
   - Integration with video conference component
   - Recording status tracking

3. **Analytics Dashboard**
   - Session completion rates
   - Participant attendance tracking
   - Performance metrics

4. **Notifications**
   - Appointment reminders
   - Participant status changes
   - Availability change alerts

5. **Calendar View**
   - Visual calendar for appointments/sessions
   - Drag-and-drop rescheduling
   - Conflict detection

## Consistency with Existing UI

✅ **Matching Elements:**
- Same spacing and margins
- Same color scheme
- Same font sizes and weights
- Same border radius and shadows
- Same button styles
- Same form input styling
- Same card layouts
- Same responsive breakpoints

The coach frontend follows the exact same design patterns as the consultant, trainer, and learner dashboards to maintain visual consistency across the application.
