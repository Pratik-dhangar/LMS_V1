# Webinar Platform Detection Implementation

## Overview
Enhanced the webinar feature with automatic platform detection and role-based meeting buttons. The system now identifies the meeting platform from the URL and shows appropriate "Start Meeting" (for hosts) or "Join Meeting" (for participants) buttons.

## Backend Changes

### 1. Platform Detection Utility
**File**: `app/utils/meeting_platform_detector.py`
- Detects meeting platform from URL (Zoom, Google Meet, Microsoft Teams, Webex, Skype, GoToMeeting, Jitsi, Whereby, BlueJeans)
- Returns platform identifier and display name
- Provides platform-specific colors for UI badges

**Supported Platforms**:
- ✅ Zoom (zoom.us, zoom.com)
- ✅ Google Meet (meet.google.com)
- ✅ Microsoft Teams (teams.microsoft.com, teams.live.com)
- ✅ Webex (webex.com, ciscospark.com)
- ✅ Skype (skype.com, lync.com)
- ✅ GoToMeeting (gotomeeting.com, gotomeet.me)
- ✅ Jitsi (meet.jit.si)
- ✅ Whereby (whereby.com)
- ✅ BlueJeans (bluejeans.com)
- ✅ Other (fallback for unknown platforms)

### 2. Schema Updates
**File**: `app/schemas/Communication/webinar.py`

Added to both `WebinarResponse` and `WebinarListResponse`:
```python
platform: Optional[str] = None  # Platform identifier (e.g., 'zoom', 'google_meet')
platform_display_name: Optional[str] = None  # User-friendly name (e.g., 'Zoom', 'Google Meet')
```

### 3. API Endpoint Updates
**File**: `app/api/endpoints/Communication/webinar.py`

**New Helper Functions**:
- `build_webinar_response(webinar)` - Builds WebinarResponse with platform detection
- `build_webinar_list_response(webinar)` - Builds WebinarListResponse with platform detection

**Updated Endpoints**:
- `POST /communication/webinars` - Create webinar (returns platform info)
- `GET /communication/webinars` - List all webinars (includes platform info)
- `GET /communication/webinars/my-webinars` - List my webinars (includes platform info)
- `GET /communication/webinars/{id}` - Get webinar details (includes platform info)
- `PATCH /communication/webinars/{id}` - Update webinar (returns platform info)

## Frontend Changes

### 1. Platform Utilities
**File**: `src/utils/platformUtils.js`

**Functions**:
- `getPlatformIcon(platform)` - Returns appropriate icon for platform
- `getPlatformColorClass(platform)` - Returns Tailwind classes for platform badge styling
- `getMeetingButtonText(isCreator)` - Returns "Start Meeting" or "Join Meeting"
- `getMeetingButtonIcon(isCreator)` - Returns PlayCircle or LogIn icon

### 2. WebinarPage Component
**File**: `src/pages/communication/webinar/WebinarPage.jsx`

**Enhancements**:
1. **Platform Badge Display**:
   - Shows colored badge with platform name (e.g., "Zoom", "Google Meet")
   - Different colors for each platform
   - Displayed below webinar description

2. **Dynamic Meeting Buttons**:
   - **Host (creator)**: Shows "Start Meeting" with PlayCircle icon
   - **Participants**: Shows "Join Meeting" with LogIn icon
   - Button styling adapts based on role (purple gradient for hosts, green for participants)

### 3. Styling Updates
**File**: `src/styles/common/communication.css`

**New Styles**:
```css
.btn-start {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  /* Purple gradient for host "Start Meeting" button */
}

.btn-start:hover {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);
}
```

## How It Works

### Platform Detection Flow
1. User creates webinar with meeting link (e.g., `https://zoom.us/j/123456789`)
2. Backend API receives the request
3. `detect_meeting_platform()` analyzes the URL domain
4. Platform identifier and display name added to response
5. Frontend displays platform badge and appropriate button

### Role-Based Button Display
1. Frontend compares `webinar.created_by_user_id` with `current_user.id`
2. If match: User is the **host** → Shows "Start Meeting" (purple gradient)
3. If no match: User is a **participant** → Shows "Join Meeting" (green)
4. Clicking either button opens meeting link in new tab

## Example API Response

```json
{
  "id": 1,
  "title": "Weekly Team Sync",
  "description": "Discuss project updates",
  "meeting_link": "https://zoom.us/j/123456789",
  "platform": "zoom",
  "platform_display_name": "Zoom",
  "scheduled_date": "2026-02-01",
  "scheduled_time": "14:00:00",
  "created_by_user_id": 5,
  "created_by_name": "John Doe",
  "created_by_role": "coach",
  "participant_count": 12
}
```

## UI Examples

### Webinar List View
```
┌─────────────────────────────────────────────────────────┐
│ Weekly Team Sync                                        │
│ Discuss project updates and milestones                 │
│ [Zoom] ← Platform badge                                │
│                                                         │
│ 📅 Feb 1, 2026  🕐 2:00 PM                             │
│ Host: John Doe [Coach]                                  │
│ 👥 12 participants                                      │
│                                                         │
│ [▶ Start Meeting] [✏️ Edit] [🗑️ Delete] ← Host view   │
│ [→ Join Meeting] ← Participant view                    │
└─────────────────────────────────────────────────────────┘
```

## Platform Badge Colors

| Platform | Badge Color |
|----------|-------------|
| Zoom | Blue |
| Google Meet | Teal |
| Microsoft Teams | Purple |
| Webex | Cyan |
| Skype | Sky Blue |
| GoToMeeting | Orange |
| Jitsi | Indigo |
| Whereby | Violet |
| BlueJeans | Blue |
| Other | Gray |

## Testing

### Backend Testing
```bash
# Start backend server
cd hurshbintech-backend
uvicorn main:app --reload

# Test platform detection
# Create webinar with different platform URLs:
# - https://zoom.us/j/123456789
# - https://meet.google.com/abc-defg-hij
# - https://teams.microsoft.com/l/meetup-join/...
```

### Frontend Testing
```bash
# Start frontend
cd hurshbintech-frontend
npm run dev

# Test scenarios:
# 1. Login as admin/coach/head
# 2. Create webinar with Zoom link
# 3. Verify "Zoom" badge appears
# 4. Verify "Start Meeting" button shows (as creator)
# 5. Login as different user
# 6. Verify "Join Meeting" button shows (as participant)
```

## Migration Required

⚠️ **Note**: The database migration for webinar tables still needs to be run:

```bash
cd hurshbintech-backend
alembic upgrade head
```

This will create the `webinars` and `webinar_participants` tables.

## Benefits

1. **User Clarity**: Users immediately know which platform the meeting is on
2. **Role Awareness**: Clear distinction between host and participant actions
3. **Visual Consistency**: Platform-specific colors provide quick visual recognition
4. **Flexibility**: Supports all major meeting platforms + fallback for unknown ones
5. **Automatic Detection**: No manual platform selection required - just paste the link

## Future Enhancements

Potential improvements for future iterations:
- [ ] Add platform-specific deep links (e.g., open Zoom app directly)
- [ ] Display estimated meeting duration
- [ ] Add "Add to Calendar" functionality
- [ ] Support for recurring webinars
- [ ] Platform-specific features (e.g., Zoom waiting room indicator)
