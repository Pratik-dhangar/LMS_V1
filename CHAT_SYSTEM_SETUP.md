# Chat System - Quick Setup Checklist

## ✅ Backend Setup Steps

### 1. Update Migration File
```bash
# Open: alembic/versions/20260121_chat_system.py
# Update line 15: down_revision = 'your_latest_revision_id'
# Find your latest revision: alembic current
```

### 2. Run Database Migration
```bash
cd hurshbintech-backend
alembic upgrade head
```

### 3. Verify Tables Created
```sql
-- Run in your PostgreSQL database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('conversations', 'conversation_members', 'messages', 'read_receipts');
```

### 4. Test Backend
```bash
# Start the server
python main.py

# Check if chat endpoints are registered
# Visit: http://localhost:8000/docs
# Look for /api/chat/* endpoints
```

---

## 📋 Files Created

### Models & Database
- ✅ `app/models/chat_model.py` - Database models
- ✅ `alembic/versions/20260121_chat_system.py` - Migration

### Schemas
- ✅ `app/schemas/chat_schema.py` - Pydantic schemas

### Business Logic
- ✅ `app/crud/chat_crud.py` - Database operations
- ✅ `app/services/chat_connection_manager.py` - WebSocket manager
- ✅ `app/services/chat_service.py` - File handling & permissions

### API
- ✅ `app/api/endpoints/chat.py` - REST & WebSocket endpoints

### Configuration
- ✅ `main.py` - Updated with chat router

### Documentation
- ✅ `docs/features/CHAT_SYSTEM_IMPLEMENTATION.md` - Full guide
- ✅ `CHAT_SYSTEM_SETUP.md` - This checklist

---

## 🧪 Quick Test Commands

### Test 1: Get All Users
```bash
curl -X GET "http://localhost:8000/api/chat/users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 2: Create Direct Conversation
```bash
curl -X POST "http://localhost:8000/api/chat/conversations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DIRECT",
    "member_ids": [2]
  }'
```

### Test 3: Send Message
```bash
curl -X POST "http://localhost:8000/api/chat/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": 1,
    "content": "Hello from API!",
    "message_type": "TEXT"
  }'
```

### Test 4: WebSocket Connection
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:8000/api/chat/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    user_id: 1,
    token: 'YOUR_JWT_TOKEN'
  }));
};

ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

---

## 🎯 Key Features Checklist

- ✅ All users visible to all users
- ✅ Text messages
- ✅ File uploads (images, videos, audio, documents - max 60MB)
- ✅ Group chat creation (ADMIN, HEAD, TRAINER, COACH only)
- ✅ Automatic user removal on delete (CASCADE DELETE)
- ✅ Online/offline status
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Offline message persistence
- ✅ Real-time message delivery via WebSocket

---

## 🚀 Next: Frontend Development

### Required Components:
1. **ChatLayout** - Main chat container
2. **UserList** - All users with online status
3. **ConversationList** - User's conversations
4. **ChatWindow** - Message display + input
5. **MessageBubble** - Individual message component
6. **FileUpload** - File attachment handling
7. **TypingIndicator** - Show typing users
8. **ReadReceipts** - Show read status

### WebSocket Hook Example:
```javascript
// hooks/useChat.js
import { useEffect, useState } from 'react';

export const useChat = (userId, token) => {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/api/chat/ws');
    
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'join',
        user_id: userId,
        token: token
      }));
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'new_message':
          setMessages(prev => [...prev, data.message]);
          break;
        case 'user_online':
          // Update online users
          break;
        case 'ping':
          socket.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    };
    
    setWs(socket);
    return () => socket.close();
  }, [userId, token]);
  
  return { ws, messages, onlineUsers };
};
```

---

## 📝 Environment Variables

No new environment variables needed! Uses existing:
- `USE_S3` - Enable S3 storage for files
- `S3_BUCKET_NAME` - S3 bucket name
- `UPLOAD_DIR` - Local upload directory

---

## 🔍 Troubleshooting

### Problem: Migration fails
```bash
# Check current revision
alembic current

# If needed, create new head
alembic revision --autogenerate -m "chat system"
```

### Problem: WebSocket 403 Forbidden
- Check CORS settings in main.py
- Verify JWT token is valid
- Ensure user exists in database

### Problem: Files not uploading
```bash
# Check permissions
ls -la uploads/chat_files/

# Create directory if needed
mkdir -p uploads/chat_files/
chmod 755 uploads/chat_files/
```

---

## 📊 Database Schema Quick Reference

```
users (existing)
  ↓
conversations
  ├── id (PK)
  ├── type (DIRECT/GROUP)
  ├── name (for groups)
  └── created_by → users.id
  
conversation_members
  ├── conversation_id → conversations.id (CASCADE)
  ├── user_id → users.id (CASCADE)
  ├── is_active
  └── last_read_at
  
messages
  ├── conversation_id → conversations.id (CASCADE)
  ├── sender_id → users.id (SET NULL)
  ├── message_type (TEXT/IMAGE/VIDEO/AUDIO/FILE)
  ├── content
  └── file_url
  
read_receipts
  ├── message_id → messages.id (CASCADE)
  ├── user_id → users.id (CASCADE)
  └── read_at
```

---

## ✨ Done!

Backend chat system is ready to use. Proceed with frontend development following the guide in `CHAT_SYSTEM_IMPLEMENTATION.md`.
