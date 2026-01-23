# Chat System Implementation Guide

## Overview

A WhatsApp-like real-time chat system integrated into the HurshBinTech application with the following features:

### ✅ Features Implemented

1. **User Visibility**: All users visible to all users automatically
2. **Message Types**: Text, images, videos, audio, documents (max 60MB)
3. **Group Chats**: ADMIN, HEAD, TRAINER, COACH can create groups
4. **Automatic User Management**: Users removed from chat when deleted from system (CASCADE DELETE)
5. **Real-time Features**:
   - Online/offline status
   - Typing indicators
   - Read receipts
   - Offline message delivery
6. **Message Persistence**: Messages stored in database for offline users

---

## Backend Architecture

### 📁 File Structure

```
hurshbintech-backend/
├── app/
│   ├── models/
│   │   └── chat_model.py              # Database models
│   ├── schemas/
│   │   └── chat_schema.py             # Pydantic schemas
│   ├── crud/
│   │   └── chat_crud.py               # Database operations
│   ├── services/
│   │   ├── chat_connection_manager.py # WebSocket manager
│   │   └── chat_service.py            # Business logic & file handling
│   └── api/endpoints/
│       └── chat.py                    # REST & WebSocket endpoints
└── alembic/versions/
    └── 20260121_chat_system.py        # Database migration
```

### 🗄️ Database Schema

#### Tables Created:
1. **conversations** - Stores chat conversations (direct & group)
2. **conversation_members** - Tracks conversation membership
3. **messages** - Stores all messages
4. **read_receipts** - Tracks message read status

#### Cascade Delete:
When a user is deleted from `users` table, all related chat data is automatically cleaned up:
- Conversation memberships → `CASCADE DELETE`
- Messages sender → `SET NULL` (preserves message history)
- Read receipts → `CASCADE DELETE`

---

## Setup Instructions

### 1. Install Dependencies (if needed)

No additional dependencies required - uses existing FastAPI WebSocket support.

### 2. Run Database Migration

```bash
cd hurshbintech-backend

# Create migration (already created: 20260121_chat_system.py)
# Update the 'down_revision' in the migration file to your latest revision

# Run migration
alembic upgrade head
```

### 3. Verify Setup

Check that the following tables were created:
- `conversations`
- `conversation_members`
- `messages`
- `read_receipts`

---

## API Endpoints

### REST Endpoints (All under `/api/chat`)

#### User Management
- `GET /api/chat/users` - Get all active users
- `GET /api/chat/online-users` - Get currently online users

#### Conversations
- `GET /api/chat/conversations` - Get user's conversations
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations/{id}` - Get conversation details
- `POST /api/chat/conversations/{id}/members` - Add members to group
- `DELETE /api/chat/conversations/{id}/members` - Remove member from group

#### Messages
- `GET /api/chat/conversations/{id}/messages` - Get messages (paginated)
- `POST /api/chat/messages` - Send text message
- `POST /api/chat/messages/upload` - Send message with file
- `POST /api/chat/messages/read` - Mark messages as read

### WebSocket Endpoint

- `WS /api/chat/ws` - Real-time chat WebSocket

---

## WebSocket Protocol

### Client → Server Messages

#### 1. Join (Connect)
```json
{
  "type": "join",
  "user_id": 123,
  "token": "jwt_token_here"
}
```

#### 2. Typing Indicator
```json
{
  "type": "typing",
  "conversation_id": 456,
  "is_typing": true
}
```

#### 3. Heartbeat Response
```json
{
  "type": "pong"
}
```

### Server → Client Messages

#### 1. Connection Confirmation
```json
{
  "type": "connected",
  "user_id": 123,
  "message": "Connected to chat successfully"
}
```

#### 2. New Message
```json
{
  "type": "new_message",
  "conversation_id": 456,
  "message": {
    "id": 789,
    "sender_id": 100,
    "sender_name": "John Doe",
    "content": "Hello!",
    "message_type": "TEXT",
    "created_at": "2026-01-21T10:00:00"
  }
}
```

#### 3. User Online Status
```json
{
  "type": "user_online",
  "user_id": 123,
  "is_online": true,
  "timestamp": "2026-01-21T10:00:00"
}
```

#### 4. Typing Indicator
```json
{
  "type": "user_typing",
  "conversation_id": 456,
  "user_id": 123,
  "user_name": "John Doe",
  "is_typing": true
}
```

#### 5. Message Read Receipt
```json
{
  "type": "message_read",
  "conversation_id": 456,
  "message_id": 789,
  "user_id": 123,
  "user_name": "John Doe",
  "read_at": "2026-01-21T10:00:00"
}
```

#### 6. Conversation Update
```json
{
  "type": "conversation_update",
  "conversation_id": 456,
  "update_type": "member_added",
  "data": {
    "added_by": 100,
    "added_members": [123, 124]
  }
}
```

#### 7. Heartbeat (Ping)
```json
{
  "type": "ping",
  "timestamp": "2026-01-21T10:00:00"
}
```

---

## Usage Examples

### 1. Start Direct Conversation

```bash
POST /api/chat/conversations
{
  "type": "DIRECT",
  "member_ids": [456]  # Other user's ID
}
```

### 2. Create Group Chat (ADMIN/HEAD/TRAINER/COACH only)

```bash
POST /api/chat/conversations
{
  "type": "GROUP",
  "name": "Training Team",
  "member_ids": [123, 456, 789]
}
```

### 3. Send Text Message

```bash
POST /api/chat/messages
{
  "conversation_id": 1,
  "content": "Hello everyone!",
  "message_type": "TEXT"
}
```

### 4. Send Message with File

```bash
POST /api/chat/messages/upload
Content-Type: multipart/form-data

conversation_id: 1
file: [image.jpg]
content: "Check this out!"  # Optional caption
```

### 5. Mark Messages as Read

```bash
POST /api/chat/messages/read
{
  "conversation_id": 1,
  "message_ids": [101, 102, 103]  # Empty array = mark all
}
```

---

## File Upload Support

### Allowed File Types:
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, OGG, QuickTime
- **Audio**: MP3, WAV, OGG, WebM
- **Documents**: PDF, Word, Excel, PowerPoint, Text, CSV
- **Archives**: ZIP, RAR, 7Z

### Maximum File Size: **60MB**

### Storage:
- **S3**: Files uploaded to `chat_files/{conversation_id}/` (if `USE_S3=true`)
- **Local**: Files uploaded to `uploads/chat_files/{conversation_id}/` (if `USE_S3=false`)

---

## Permission Matrix

| Action | ADMIN | HEAD | TRAINER | COACH | LEARNER |
|--------|-------|------|---------|-------|---------|
| View all users | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send messages | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create direct chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create group chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add group members | ✅ | ✅ | ✅ | ✅* | ❌ |
| Remove group members | ✅ | ✅ | ✅ | ✅* | ❌ |

*Group creator can manage members

---

## Real-time Features

### 1. Online Status
- Automatically tracked when user connects/disconnects via WebSocket
- Broadcast to all connected users
- Visible in user list and conversation UI

### 2. Typing Indicators
- Client sends typing status to server
- Server broadcasts to conversation members
- Auto-clears when user stops typing or sends message

### 3. Read Receipts
- Automatically created when user marks messages as read
- Visible to all conversation members
- Shows who read each message and when

### 4. Offline Message Delivery
- Messages stored in database
- Retrieved when offline user comes online
- Unread count tracked per conversation

---

## Testing the Chat System

### 1. Test WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/api/chat/ws');

ws.onopen = () => {
  // Join chat
  ws.send(JSON.stringify({
    type: 'join',
    user_id: 123,
    token: 'your_jwt_token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  // Respond to ping
  if (data.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
  }
};
```

### 2. Test REST Endpoints

```bash
# Get all users
curl -X GET "http://localhost:8000/api/chat/users" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create conversation
curl -X POST "http://localhost:8000/api/chat/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"DIRECT","member_ids":[2]}'

# Send message
curl -X POST "http://localhost:8000/api/chat/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":1,"content":"Hello!","message_type":"TEXT"}'
```

---

## Frontend Integration Guide

### Required Frontend Components:
1. **ChatUserList** - Display all users with online status
2. **ConversationList** - Show user's conversations with unread counts
3. **ChatWindow** - Message display and input
4. **TypingIndicator** - Show when other users are typing
5. **FileUpload** - Handle file attachments
6. **ReadReceipts** - Show message read status

### WebSocket State Management:
- Use React Context or Zustand for chat state
- Reconnect on disconnect
- Queue messages when offline
- Sync read receipts

---

## Troubleshooting

### Issue: WebSocket won't connect
**Solution**: Check CORS settings in main.py and ensure WebSocket URL is correct

### Issue: Files not uploading
**Solution**: Verify `UPLOAD_DIR` exists and has write permissions

### Issue: Messages not persisting
**Solution**: Check database connection and run migrations

### Issue: User deleted but chat data remains
**Solution**: Verify CASCADE DELETE in migration and re-run migration

---

## Next Steps for Frontend

1. Create React components for chat UI
2. Implement WebSocket connection hook
3. Add message input with file upload
4. Display online status and typing indicators
5. Show read receipts
6. Handle offline message sync

---

## Security Considerations

✅ **Implemented**:
- JWT authentication for WebSocket connections
- User can only access conversations they're a member of
- File type validation
- File size limits (60MB)
- Automatic cleanup on user deletion

🔒 **Recommended Additions**:
- Rate limiting for message sending
- Content moderation
- Report/block user functionality
- Message encryption (end-to-end)

---

## Performance Optimization

- **Pagination**: Messages loaded in batches (50 per page)
- **Indexing**: Database indexes on frequently queried fields
- **WebSocket Heartbeat**: Keeps connections alive (30s interval)
- **Lazy Loading**: Conversations and messages loaded on-demand

---

## Monitoring & Logging

All chat operations are logged with the following:
- User connections/disconnections
- Message sending/receiving
- File uploads
- Errors and exceptions

Check logs at: `hurshbintech-backend/logs/app.log`

---

## Support

For issues or questions, contact the development team.

**Last Updated**: January 21, 2026
