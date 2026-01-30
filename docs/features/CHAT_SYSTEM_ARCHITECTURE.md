# Chat System Architecture & Implementation Guide

## Executive Summary

The chat system implements **two complementary widgets** serving different purposes:

1. **MessagingWidget** – LinkedIn-style persistent popup for desktop (bottom-right corner)
2. **ChatIconWidget** – Mobile-first button with modal, desktop fallback to MessagingWidget

Additionally, there are **two full-page chat interfaces**:
- **UnifiedChatPage** – Split-view WhatsApp-like interface (conversations list + chat view)
- **ChatWindowPage** – Single conversation detail view (no conversation list)

This document explains **why this dual-widget architecture exists**, the architectural trade-offs, and complete system flows.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Hierarchy](#component-hierarchy)
3. [Why Two Chat Widgets?](#why-two-chat-widgets)
4. [Widget Comparison Matrix](#widget-comparison-matrix)
5. [Complete System Flow](#complete-system-flow)
6. [Technical Implementation](#technical-implementation)
7. [WebSocket Message Flows](#websocket-message-flows)
8. [API Integration](#api-integration)
9. [State Management](#state-management)
10. [Mobile vs Desktop Strategy](#mobile-vs-desktop-strategy)
11. [Performance Considerations](#performance-considerations)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                          App Root                            │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├─ <Router> (React Router v6+)
       │
       ├─ <AuthContext.Provider>
       │   └─ User authentication state
       │
       ├─ <ChatContext.Provider>
       │   ├─ Global chat state (conversations, messages, users)
       │   ├─ WebSocket connection management
       │   ├─ Real-time events (new messages, typing, online status)
       │   └─ API integration layer
       │
       └─ <ChatIconWidget /> ◄─── Entry point for ALL chat interactions
            │
            ├─ MOBILE (width ≤ 768px):
            │   ├─ Floating button with badge (unread count)
            │   └─ onClick → Modal with <UnifiedChatPage isModal={true} />
            │
            └─ DESKTOP (width > 768px):
                └─ <MessagingWidget /> (LinkedIn-style popup)
                    ├─ Collapsed state: avatar + "Messaging" text
                    ├─ List state: conversations, user search, new chat
                    └─ Chat state: conversation detail, messages, input

┌─────────────────────────────────────────────────────────────┐
│              Dedicated Chat Pages (via Routes)               │
├─────────────────────────────────────────────────────────────┤
│ /chat              → <UnifiedChatPage />                     │
│ /personal-chat     → <UnifiedChatPage />                     │
│ /chat/:id          → <ChatWindowPage />                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Context & State Management

```
ChatContext.jsx
├─ State: conversations[], messages{}, onlineUsers, unreadCounts{}
├─ WebSocket: connectChat() / disconnectChat()
├─ Actions: selectConversation(), sendMessage(), markAsRead()
├─ Events: handleNewMessage, handleTypingStatus, handleUserOnline
└─ Connection: /api/chat/ws (separate from WebRTC)

AuthContext.jsx
├─ user: { id, name, role, email, ... }
└─ isAuthenticated: boolean

Layout + Routing
├─ MainLayout → <ChatIconWidget />
├─ TrainerSession → <MessagingWidget /> (session-scoped chat)
├─ Route: /chat → <UnifiedChatPage />
└─ Route: /chat/:id → <ChatWindowPage />
```

---

## Component Hierarchy

```
ChatIconWidget (Orchestrator)
│
├─ Mobile Rendering (display: block on mobile)
│  ├─ Floating button with MessageCircle icon
│  ├─ Unread badge (99+ cap)
│  └─ Modal overlay (full-screen)
│      └─ <UnifiedChatPage isModal={true} />
│          ├─ Conversation list (top, sticky search)
│          ├─ Message input + send
│          ├─ Responsive: slides right on msg selection
│          └─ WhatsApp-like UX
│
└─ Desktop Rendering (display: none on mobile)
   └─ <MessagingWidget /> (LinkedIn-style popup)
       ├─ Collapsed view: Button to expand
       ├─ List view: 
       │  ├─ Conversations tab (existing)
       │  ├─ New chats tab (create new conversations)
       │  ├─ Search/filter conversations
       │  └─ Unread badges on items
       │
       └─ Chat view:
           ├─ Chat header (user/group name, online status)
           ├─ Message history (scrollable, auto-scroll to latest)
           ├─ Typing indicators
           ├─ Read receipts (checkmarks: ✓ sent, ✓✓ delivered)
           ├─ File previews (images, attachments)
           ├─ Message input + file upload + emoji picker
           └─ Details panel (members, group info)

Dedicated Pages
├─ UnifiedChatPage (both mobile & /chat route)
│  ├─ Conversation list (left side on desktop, full width on mobile)
│  ├─ Message area (right side on desktop)
│  ├─ Handles routing: /chat/:conversationId
│  └─ Full-screen, immersive experience
│
└─ ChatWindowPage
   ├─ Single conversation view (like email detail)
   ├─ No conversation list sidebar
   ├─ Routed as: /chat/:conversationId (fallback)
   └─ Simpler, focused interface
```

---

## Why Two Chat Widgets?

### Problem Statement

The application needs to support chat across multiple contexts:

1. **Persistent Chat Access** – Users expect chat available everywhere (except sessions)
2. **Responsive Design** – Mobile vs desktop have different spatial constraints
3. **Immersive Experience** – Users need full-screen chat on mobile (not a tiny popup)
4. **Desktop Productivity** – Desktop users prefer unobtrusive, always-visible widget
5. **Session Context** – During trainer/learner sessions, chat should be accessible but not intrusive

### Solution: Two-Tier Widget Strategy

```
User Journey:
├─ Mobile User:
│  ├─ Sees floating button (≈ 60px diameter) in bottom-right
│  ├─ Taps button → Full-screen modal chat interface
│  ├─ Conversations list, message input, all visible
│  ├─ Close button minimizes modal → Back to floating button
│  └─ User can multitask: app ↔ chat seamlessly
│
└─ Desktop User:
   ├─ Sees LinkedIn-style widget (350px × 500px) in bottom-right
   ├─ Widget states: collapsed → list → chat
   ├─ Can interact without leaving current page
   ├─ Persistent access while browsing other features
   └─ Or click /chat for full-page immersive view

Session Context (Trainer/Learner):
├─ Trainer session page includes <MessagingWidget />
├─ Allows trainer to chat during session without breaking focus
└─ Session chat may be pre-filtered to session participants
```

### Architectural Rationale

| Concern | Solution | Why |
|---------|----------|-----|
| **Mobile Responsiveness** | ChatIconWidget renders full-screen modal on mobile | Keyboard + limited viewport require maximized space |
| **Desktop UX** | MessagingWidget (persistent popup) + UnifiedChatPage (full page) | Desktop has space; persistent widget provides quick access |
| **Code Reuse** | Both use same ChatContext, ChatAPI, message components | Single source of truth for chat logic |
| **Separation of Concerns** | Widget = quick access, Page = immersive experience | Different interaction patterns |
| **Accessibility** | ChatIconWidget always hidden on session pages | Prevents distraction during active sessions |
| **Performance** | Widget doesn't connect to chat until expanded (mobile) | Reduces WebSocket connections for unused interfaces |

---

## Widget Comparison Matrix

### MessagingWidget (Desktop Popup)

**Purpose:** LinkedIn-style persistent chat popup for desktop  
**Trigger:** Auto-rendered in MainLayout on desktop (width > 768px)  
**UX Pattern:** Collapsible → expandable → chat view  

| Aspect | Details |
|--------|---------|
| **Display** | Fixed position bottom-right, 350px × 500px max |
| **States** | Collapsed, List, Chat |
| **Animations** | Smooth expand/collapse, slide-in transitions |
| **Always Visible** | Collapsed button always shows unless user minimizes |
| **Unread Badge** | Shows on collapsed button + conversation items |
| **Key Features** | Search, filter by group/direct, new chat creation, emoji picker, file upload |
| **Details Panel** | Slide-in right panel showing group members, chat info |
| **Performance** | Connects to WebSocket only when list/chat state (user expands) |

**Entry Point:**
```jsx
// In ChatIconWidget.jsx
<div className="messaging-widget-desktop-only">
  <MessagingWidget />
</div>

// CSS makes it visible only on desktop
@media (max-width: 768px) {
  .messaging-widget-desktop-only { display: none !important; }
}
```

---

### ChatIconWidget → Mobile Modal

**Purpose:** Mobile-first floating button + full-screen modal chat  
**Trigger:** Auto-rendered in App root, mobile-only  
**UX Pattern:** Button → tap → full-screen modal  

| Aspect | Details |
|--------|---------|
| **Display** | Floating button (60px) bottom-right on mobile, takes 100% viewport when tapped |
| **States** | Button visible, Modal overlay (when tapped) |
| **Animations** | Slide-up modal, fade overlay |
| **Always Visible** | Button always visible (unless hidden page list) |
| **Unread Badge** | Shows on button (99+ cap), also on conversations inside modal |
| **Key Features** | Same as UnifiedChatPage (conversations, messages, new chat) |
| **Modal Content** | `<UnifiedChatPage isModal={true} />` |
| **Performance** | Connects to WebSocket when modal opens (lazy connection) |

**Entry Point:**
```jsx
// In ChatIconWidget.jsx
<div className="chat-widget-container chat-widget-mobile-only">
  <button onClick={() => setShowChatModal(true)}>
    <MessageCircle size={30} />
    {totalUnread > 0 && <span>{totalUnread}</span>}
  </button>
</div>

{showChatModal && (
  <div className="chat-modal-overlay-fullscreen">
    <UnifiedChatPage isModal={true} />
  </div>
)}

// CSS makes it visible only on mobile
@media (max-width: 768px) {
  .chat-widget-mobile-only { display: block !important; }
  .messaging-widget-desktop-only { display: none !important; }
}
```

---

### Full-Page Chat Interfaces

#### UnifiedChatPage

**Purpose:** WhatsApp-like split-view interface or full-screen modal  
**Routes:** `/chat`, `/personal-chat`  
**Usage:** Standalone page OR as modal content in ChatIconWidget  

| Aspect | Details |
|--------|---------|
| **Desktop Layout** | Split-view: conversations left (300px), messages right |
| **Mobile Layout** | Single view: conversations list slides out on left, msg area on right |
| **Unread Handling** | Shows unread badge on conversation items |
| **New Chat** | "+" button opens creation modal |
| **Message Features** | Same as MessagingWidget |
| **Responsive** | Tablets adapt to desktop layout (split) |
| **Prop: isModal** | When true, hides nav bar, adjusts styling for modal context |

**Entry Point:**
```jsx
// In App.jsx routes
<Route path="/chat" element={<UnifiedChatPage />} />
<Route path="/personal-chat" element={<UnifiedChatPage />} />
<Route path="/chat/:conversationId" element={<UnifiedChatPage />} />

// Or as modal in ChatIconWidget
<UnifiedChatPage isModal={true} />
```

**Code Signature:**
```jsx
const UnifiedChatPage = ({ isModal = false }) => {
  // If isModal=true:
  // - Styles adjust to full viewport
  // - No page nav/layout wrapper
  // - Close modal handling delegated to parent
}
```

---

#### ChatWindowPage

**Purpose:** Single conversation detail view  
**Route:** `/chat/:conversationId` (fallback)  
**Usage:** When user is deep-linked to specific conversation  

| Aspect | Details |
|--------|---------|
| **Layout** | Full-width conversation (no list sidebar) |
| **Features** | Chat header with user/group info, message history, input |
| **Navigation** | Back arrow to return to /chat (list view) |
| **Responsive** | Adapts to mobile/tablet/desktop |
| **When Used** | Email-style deep link access to specific conversation |

---

## Complete System Flow

### Flow 1: Mobile User Opens Chat

```
User Action:
  Mobile user taps floating chat button
  ↓
ChatIconWidget detects mobile (width ≤ 768px)
  ├─ Renders floating button (MessageCircle icon)
  ├─ Shows unread count badge
  └─ Triggers setShowChatModal(true) on click
  ↓
Modal overlay appears (full-screen)
  ├─ Fade-in overlay background
  ├─ Slide-up modal window
  └─ Renders <UnifiedChatPage isModal={true} />
  ↓
UnifiedChatPage initializes
  ├─ Calls connectChat() in useEffect
  │   ├─ ChatContext establishes WebSocket → /api/chat/ws
  │   ├─ Sends JOIN message with JWT token
  │   ├─ Backend authenticates user, subscribes to channels
  │   └─ Heartbeat starts (30s ping/pong)
  │
  ├─ Fetches conversations via chatApi.getConversations()
  │   └─ Displays in left sidebar (mobile: full width)
  │
  └─ Loads unread count badges
      ├─ Maps unreadCounts{} to conversation items
      └─ Shows red dot + count for unread messages

User Interaction:
  Taps conversation → selectConversation(convId)
  ├─ Updates currentConversation state
  ├─ Calls loadMessages(convId) if not cached
  │   └─ Fetches paginated messages from chatApi.getMessages()
  ├─ UI transitions to message view (right side on tablet, full width on mobile)
  └─ User can see and reply to messages

Sending Message:
  ├─ User types in input, hits send
  ├─ Optimistic UI: message appears immediately with "sending" state
  ├─ sendMessage() called
  │   ├─ Calls chatApi.sendMessage({ conversation_id, content, message_type })
  │   ├─ Backend processes, broadcasts via WebSocket
  │   ├─ Sender excluded (to avoid race condition on frontend)
  │   └─ Message marked with sender_id === currentUser.id (optimistic)
  ├─ Backend broadcasts to other conversation members via WebSocket
  │   └─ ChatContext.handleNewMessage() triggers
  ├─ UI updates with "sent" then "delivered" checkmarks
  └─ User can continue chatting

User Exits:
  Taps modal close button
  ├─ setShowChatModal(false)
  ├─ Modal fades out
  ├─ disconnectChat() called in cleanup
  │   └─ WebSocket closes gracefully
  └─ Back to floating button (always visible)
```

**Timeline Diagram:**
```
Time    Event
────────────────────────────────────────────────────────────
T0      User taps button
T0.1    State change: showChatModal = true
T0.2    Modal rendered (CSS animation: 0.3s)
T0.5    Modal visible
T0.6    connectChat() executes
T1.0    WebSocket connected
T1.1    Conversations loaded (REST API + state update)
T1.5    UI displays conversation list
T2.0    User taps conversation
T2.1    Messages loaded (if not cached)
T2.5    Message history displayed
T3.0    User types message
T3.5    User hits send
T3.6    Message in local state (optimistic)
T4.0    API call completes
T4.1    WebSocket broadcast received by others
T4.5    Message marked as delivered (✓✓)
```

---

### Flow 2: Desktop User Interacts with MessagingWidget

```
Page Load:
  User navigates to app page (not chat, not session)
  ├─ MainLayout renders
  ├─ ChatIconWidget injected in layout
  ├─ Detects desktop (width > 768px)
  └─ MessagingWidget rendered (hidden initially as "collapsed")

MessagingWidget Visible:
  ├─ Fixed position: bottom: 0, right: 20px
  ├─ Shows collapsed view
  │   ├─ Avatar (user initial)
  │   ├─ "Messaging" text
  │   └─ Chevron-up icon (expand indicator)
  └─ Unread badge shows if messages pending

User Interaction 1: Expand Widget
  ├─ Clicks on collapsed button
  ├─ handleToggleWidget() called
  │   └─ widgetState: 'collapsed' → 'list'
  ├─ CSS animation: expand 350px × 500px (smooth 0.2s)
  ├─ connectChat() executes (if not already connected)
  └─ Widget now shows list view with conversations

List View:
  ├─ Header: "Messaging", settings icon, new chat button
  ├─ Search bar: real-time conversation filter
  ├─ Tabs: "Chats" (existing), "New Chats" (available users)
  │
  ├─ "Chats" tab active:
  │   ├─ Shows user's conversations sorted by recency
  │   ├─ Each item displays:
  │   │   ├─ Avatar (user/group icon)
  │   │   ├─ Name
  │   │   ├─ Last message preview (truncated)
  │   │   ├─ Timestamp
  │   │   └─ Unread badge (if applicable)
  │   └─ Hover effect: light background
  │
  └─ "New Chats" tab:
      ├─ Lists all available users not yet conversing with current user
      ├─ Search/filter works across users
      └─ Click user → Creates new DIRECT conversation automatically

User Interaction 2: Select Conversation
  ├─ Clicks on conversation item
  ├─ handleOpenConversation(conv) executes
  │   ├─ selectConversation(conv.id)
  │   ├─ loadMessages(conv.id)
  │   └─ setWidgetState('chat')
  ├─ Animation: list view slides left, chat view slides in from right
  └─ Chat view now displayed

Chat View:
  ├─ Header:
  │   ├─ Back arrow (return to list)
  │   ├─ Avatar + name (user or group)
  │   ├─ Online status indicator (green dot for DIRECT chats)
  │   ├─ Info icon (show details panel)
  │   └─ More options (menu)
  │
  ├─ Messages area:
  │   ├─ Scrollable container (flex-1, overflow-y auto)
  │   ├─ Messages grouped by date (sticky headers)
  │   ├─ Message bubbles:
  │   │   ├─ Sent (aligned right, green background)
  │   │   ├─ Received (aligned left, gray background)
  │   │   ├─ Shows sender name in group chats
  │   │   ├─ Timestamp on hover
  │   │   ├─ Read receipts (✓, ✓✓)
  │   │   └─ File previews (images inline, attachments as icons)
  │   │
  │   ├─ Typing indicators:
  │   │   ├─ "John is typing..." appears above input
  │   │   └─ Auto-hides after 3s of no activity
  │   │
  │   └─ Auto-scroll:
  │       ├─ Scrolls to latest message on new message
  │       ├─ User can scroll up to see history
  │       └─ Clicking input returns to latest

Input Area:
  ├─ Text input field (multi-line, grows with content)
  ├─ File attachment button (Paperclip icon)
  │   ├─ Uploads file via sendFileMessage()
  │   └─ Shows preview before send
  ├─ Emoji picker button (Smile icon)
  │   ├─ Opens emoji picker modal
  │   └─ Click emoji inserts into input
  ├─ Send button (Send icon, disabled if empty)
  │   ├─ Sends message on click or Ctrl+Enter
  │   └─ Disables while sending
  └─ Typing indicator broadcast:
      ├─ On first keystroke: sendTypingStatus(true)
      ├─ On input blur or 3s inactivity: sendTypingStatus(false)
      └─ WebSocket broadcasts to other participants

Details Panel (slide-in from right):
  ├─ Click info icon → setShowChatDetails(true)
  ├─ Panel animates in from right edge
  ├─ Displays:
  │   ├─ Large avatar
  │   ├─ Chat name and type (Group/Direct)
  │   ├─ Members list (with roles)
  │   └─ Mute/Archive/Leave options
  └─ Click X or click chat area → panel closes

User Interaction 3: Back to List
  ├─ Clicks back arrow OR clicks outside chat area
  ├─ handleBackToList() called
  │   ├─ setWidgetState('list')
  │   ├─ setSelectedConversation(null)
  │   └─ Chat view slides out, list slides back in
  ├─ User can select different conversation
  └─ Or create new conversation from "New Chats" tab

User Interaction 4: Collapse Widget
  ├─ Clicks chevron-down button in header
  ├─ handleToggleWidget() called
  │   └─ widgetState: 'list' → 'collapsed'
  ├─ CSS animation: collapse to 60px button (smooth 0.2s)
  └─ Widget back to collapsed state (always shows unread count)

User Interaction 5: Create New Group
  ├─ Clicks "+" (MessageSquarePlus) button in header
  ├─ setShowNewChatModal(true)
  ├─ Modal opens with:
  │   ├─ "Create Group" title
  │   ├─ Group name input
  │   ├─ Multi-select user picker
  │   ├─ "Create" button
  │   └─ "Cancel" button
  ├─ User selects users, enters name, clicks Create
  ├─ createConversation('GROUP', selectedUserIds, groupName) executes
  │   ├─ Calls chatApi.createConversation()
  │   ├─ Backend creates Conversation + ConversationMembers
  │   ├─ Returns new conversation object
  │   └─ Added to conversations[] state
  ├─ New group selected automatically
  ├─ setWidgetState('chat')
  └─ User can now message the group
```

**Timeline Diagram:**
```
Time    Event
────────────────────────────────────────────────────────────
T0      Page loads with chat widget visible
T0.5    MessagingWidget renders (collapsed state)
T1.0    User clicks collapsed button
T1.2    Animation: widget expands (350×500px)
T1.5    connectChat() executes (if needed)
T2.0    Conversations loaded + displayed in list
T2.5    User clicks conversation
T2.7    Message history fetched (if not cached)
T3.0    Chat view displayed
T3.5    User types message
T3.6    sendTypingStatus(true) sent
T3.7    Other users see "typing..." indicator
T4.0    User sends message
T4.1    Message in local state (optimistic)
T4.2    API call → Backend → WebSocket broadcast
T4.5    Broadcast received, other users' message state updated
T5.0    "Delivered" checkmark appears
T6.0    User clicks back arrow
T6.2    Animation: chat slides out, list slides back
```

---

### Flow 3: Message Received (WebSocket → UI Update)

```
Other User Sends Message in Conversation:
  ├─ User2 sends message via sendMessage()
  ├─ Backend processes, validates
  ├─ Message saved to DB
  ├─ Backend broadcasts via WebSocket:
  │   └─ Message event to all conversation members (except sender)
  │
  └─ Current User's Frontend:
      ├─ ChatContext WebSocket listener receives "message" event
      ├─ handleNewMessage() callback executes
      │   ├─ Validates message (not duplicate)
      │   ├─ setMessages(prev => {
      │   │   └─ Appends to messages[conversationId][]
      │   │ })
      │   ├─ Plays notification sound (if enabled)
      │   └─ Increments unreadCounts[conversationId]
      │
      ├─ UI re-renders:
      │   ├─ New message bubble appears in chat view
      │   ├─ Unread badge updated on conversation item
      │   └─ Auto-scroll to latest message (if user scrolled to bottom)
      │
      └─ Read Receipt Handling:
          ├─ If chat view is visible:
          │   ├─ Message marked as read immediately
          │   ├─ markAsRead(conversationId) called
          │   ├─ Backend updates ReadReceipt table
          │   └─ Sender sees ✓✓ checkmark
          │
          └─ If chat view is NOT visible:
              ├─ Message stays unread
              ├─ When user opens chat view:
              │   ├─ Messages auto-marked as read
              │   └─ Sender sees ✓✓ checkmark
              └─ Unread badge remains until chat opened
```

---

## Technical Implementation

### MessagingWidget Component Structure

```jsx
const MessagingWidget = () => {
  const { user } = useAuth();
  const {
    conversations,
    messages,
    onlineUsers,
    unreadCounts,
    sendMessage,
    sendFileMessage,
    markAsRead,
    loadMessages,
    selectConversation,
    sendTypingStatus,
    createConversation,
    currentConversation,
    connectChat,
    disconnectChat,
    allUsers,
  } = useChat();

  // Widget state machine
  const [widgetState, setWidgetState] = useState('collapsed');
  // 'collapsed' → 'list' → 'chat' (or back)

  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Connect/disconnect based on widget visibility
  useEffect(() => {
    if (widgetState !== 'collapsed') {
      connectChat();
      return () => disconnectChat();
    }
  }, [widgetState, connectChat, disconnectChat]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (widgetState === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConversation, widgetState]);

  // Mark messages as read
  useEffect(() => {
    if (widgetState === 'chat' && selectedConversation) {
      const unreadMessages = messages[selectedConversation.id]?.filter(
        msg => !msg.is_read && msg.sender_id !== user.id
      );
      if (unreadMessages?.length > 0) {
        markAsRead(selectedConversation.id);
      }
    }
  }, [selectedConversation, messages, markAsRead, user, widgetState]);

  // Render logic
  return (
    <div className={`messaging-widget ${widgetState}`}>
      {widgetState === 'collapsed' && <CollapsedView />}
      {widgetState === 'list' && <ListViewWith Tabs />}
      {widgetState === 'chat' && <ChatView />}
    </div>
  );
};
```

**Key Patterns:**
- State machine for view transitions
- Effect cleanup for WebSocket connection
- Lazy connection (only when expanded)
- Auto-scroll and read-receipt handling

---

### ChatIconWidget Component Structure

```jsx
const ChatIconWidget = () => {
  const location = useLocation();
  const { unreadCounts, connectChat, disconnectChat } = useChat();
  const [showChatModal, setShowChatModal] = useState(false);

  // Connect when modal opens (mobile)
  useEffect(() => {
    if (showChatModal) {
      connectChat();
      return () => disconnectChat();
    }
  }, [showChatModal, connectChat, disconnectChat]);

  // Hide on session/login pages
  const shouldHide = location.pathname.includes('/session/') || 
                     hiddenPages.includes(location.pathname);
  
  if (shouldHide) return null;

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* Mobile: Floating button + modal */}
      <div className="chat-widget-container chat-widget-mobile-only">
        <button onClick={() => setShowChatModal(true)}>
          <MessageCircle size={30} />
          {totalUnread > 0 && <span>{Math.min(totalUnread, 99)}+</span>}
        </button>
      </div>

      {showChatModal && (
        <div className="chat-modal-overlay-fullscreen">
          <UnifiedChatPage isModal={true} />
        </div>
      )}

      {/* Desktop: LinkedIn-style popup */}
      <div className="messaging-widget-desktop-only">
        <MessagingWidget />
      </div>
    </>
  );
};
```

**Key Patterns:**
- Responsive rendering (media query in CSS + className logic)
- Lazy connection (only when modal opens on mobile)
- Route-based hiding (session pages, login)
- Total unread count calculation

---

### ChatContext: State Management & WebSocket

```jsx
const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();

  // State
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({}); // { conversationId: [...messages] }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const activeConnectionsRef = useRef(0); // Prevents premature disconnect
  const heartbeatIntervalRef = useRef(null);

  // WebSocket Connection
  const connectChat = useCallback(async () => {
    if (activeConnectionsRef.current > 0) {
      console.log('Chat already connected');
      return; // Already connected
    }

    activeConnectionsRef.current++;

    // Retrieve JWT token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No auth token available');
      return;
    }

    // Establish WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/chat/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send JOIN message with token
        wsRef.current.send(JSON.stringify({
          type: 'join',
          user_id: user.id,
          token: token
        }));

        // Start heartbeat (30s ping/pong)
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'message':
            handleNewMessage(data);
            break;
          case 'typing':
            handleTypingStatus(data);
            break;
          case 'user_online':
            handleUserOnline(data);
            break;
          case 'user_offline':
            handleUserOffline(data);
            break;
          case 'message_read':
            handleMessageRead(data);
            break;
          case 'pong':
            // Heartbeat response
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        // Attempt reconnect with exponential backoff
        attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to establish WebSocket:', error);
      activeConnectionsRef.current--;
      attemptReconnect();
    }
  }, [user]);

  const disconnectChat = useCallback(() => {
    activeConnectionsRef.current--;

    if (activeConnectionsRef.current === 0) {
      // All widgets disconnected, close WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      setIsConnected(false);
    }
  }, []);

  const attemptReconnect = useCallback(() => {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;
    setTimeout(connectChat, delay);
  }, [connectChat]);

  // Message handlers
  const handleNewMessage = (data) => {
    const { conversation_id, message } = data;
    setMessages(prev => ({
      ...prev,
      [conversation_id]: [...(prev[conversation_id] || []), message]
    }));
    setUnreadCounts(prev => ({
      ...prev,
      [conversation_id]: (prev[conversation_id] || 0) + 1
    }));
  };

  const handleTypingStatus = (data) => {
    const { user_id, conversation_id, is_typing } = data;
    setTypingUsers(prev => {
      const key = `${conversation_id}:${user_id}`;
      const newState = { ...prev };
      if (is_typing) {
        newState[key] = true;
      } else {
        delete newState[key];
      }
      return newState;
    });
  };

  const handleUserOnline = (data) => {
    const { user_id } = data;
    setOnlineUsers(prev => new Set([...prev, user_id]));
  };

  const handleUserOffline = (data) => {
    const { user_id } = data;
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(user_id);
      return newSet;
    });
  };

  const handleMessageRead = (data) => {
    const { conversation_id, message_ids } = data;
    setMessages(prev => ({
      ...prev,
      [conversation_id]: prev[conversation_id]?.map(msg =>
        message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg
      )
    }));
  };

  // API calls
  const loadMessages = async (conversationId, offset = 0, limit = 50) => {
    try {
      const response = await chatApi.getMessages(conversationId, offset, limit);
      setMessages(prev => ({
        ...prev,
        [conversationId]: response.messages
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async (conversationId, content, messageType = 'TEXT') => {
    try {
      const response = await chatApi.sendMessage({
        conversation_id: conversationId,
        content,
        message_type: messageType
      });
      // Backend excludes sender, so add locally
      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), response]
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const sendFileMessage = async (conversationId, file, caption = '') => {
    try {
      const response = await chatApi.sendMessageWithFile(conversationId, file, caption);
      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), response]
      }));
    } catch (error) {
      console.error('Failed to send file:', error);
      throw error;
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      const unreadMessages = messages[conversationId]?.filter(m => !m.is_read) || [];
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(m => m.id);
        await chatApi.markMessagesAsRead(conversationId, messageIds);
        setUnreadCounts(prev => ({
          ...prev,
          [conversationId]: 0
        }));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const createConversation = async (type, memberIds, name = null) => {
    try {
      const response = await chatApi.createConversation({
        type,
        member_ids: memberIds,
        name
      });
      setConversations(prev => [response, ...prev]);
      return response;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  };

  // Provider value
  const value = {
    conversations,
    messages,
    onlineUsers,
    unreadCounts,
    currentConversation,
    isConnected,
    connectChat,
    disconnectChat,
    loadMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    selectConversation,
    createConversation,
    // ... other exports
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
```

**Key Patterns:**
- Connection reference counting (prevent premature disconnect)
- Exponential backoff reconnection
- Heartbeat/ping-pong keepalive
- Message deduplication via refs
- Lazy-load messages with pagination

---

## WebSocket Message Flows

### Message Type: "join" (User Connects)

```
Frontend → Backend:
{
  "type": "join",
  "user_id": 123,
  "token": "eyJhbGc..."
}

Backend Processing:
1. Validates JWT token
2. Authenticates user
3. Subscribes user to personal channel + all conversation channels
4. Broadcasts user online status to all connected users
5. Sends back conversation list + online users

Backend → Frontend:
{
  "type": "user_joined",
  "user_id": 123,
  "user_name": "John Doe",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Message Type: "message" (New Chat Message)

**Sender Flow:**

```
Frontend sends:
await chatApi.sendMessage({
  conversation_id: 45,
  content: "Hello!",
  message_type: "TEXT"
})

HTTP POST /chat/messages:
{
  "conversation_id": 45,
  "content": "Hello!",
  "message_type": "TEXT"
}

Backend Processing:
1. Validates conversation membership
2. Creates Message record in database
3. Broadcasts to all conversation members (EXCEPT sender)
4. Returns message object with ID, timestamp

HTTP Response:
{
  "id": 1234,
  "conversation_id": 45,
  "sender_id": 123,
  "sender_name": "John",
  "content": "Hello!",
  "message_type": "TEXT",
  "created_at": "2024-01-15T10:30:00Z",
  "is_read": false,
  "read_receipts": []
}

Frontend processes response:
- Message added to local state (messages[45])
- Marked as optimistic (sent)
```

**Recipient Flow:**

```
Backend broadcasts via WebSocket to recipients:
{
  "type": "message",
  "conversation_id": 45,
  "message": {
    "id": 1234,
    "sender_id": 123,
    "sender_name": "John",
    "content": "Hello!",
    "message_type": "TEXT",
    "created_at": "2024-01-15T10:30:00Z",
    "is_read": false
  }
}

Frontend receives → ChatContext.handleNewMessage():
1. Add message to messages[45][]
2. Increment unreadCounts[45]
3. If conversation open: auto-mark as read
4. Update UI (new bubble appears)
5. Auto-scroll to latest
```

---

### Message Type: "typing" (Typing Indicator)

```
Frontend sends (on first keystroke):
wsRef.current.send(JSON.stringify({
  type: "typing",
  conversation_id": 45,
  is_typing": true
}))

Backend broadcasts to other participants:
{
  "type": "typing",
  "conversation_id": 45,
  "user_id": 123,
  "user_name": "John",
  "is_typing": true
}

Frontend receives → ChatContext.handleTypingStatus():
1. Update typingUsers set
2. Display "John is typing..." above input
3. Auto-hide after 3s inactivity

Frontend sends (on blur/inactivity):
{
  "type": "typing",
  "conversation_id": 45,
  "is_typing": false
}

Backend broadcasts:
{
  "type": "typing",
  "conversation_id": 45,
  "user_id": 123,
  "is_typing": false
}

Frontend removes from typingUsers, "typing..." disappears
```

---

### Message Type: "message_read" (Read Receipt)

```
Frontend sends (from ChatContext.markAsRead()):
await chatApi.markMessagesAsRead(conversationId, [1234, 1235, ...])

HTTP POST /chat/mark-as-read:
{
  "conversation_id": 45,
  "message_ids": [1234, 1235]
}

Backend Processing:
1. Creates ReadReceipt records for each message
2. Broadcasts to all conversation members:

{
  "type": "message_read",
  "conversation_id": 45,
  "user_id": 123,
  "message_ids": [1234, 1235],
  "timestamp": "2024-01-15T10:30:05Z"
}

All clients receive:
ChatContext.handleMessageRead():
1. Update messages[45] messages with is_read: true
2. Sender sees ✓✓ checkmarks on messages
3. Other recipients see message marked as read
```

---

### Message Type: "user_online" / "user_offline"

```
When any user connects/disconnects:
{
  "type": "user_online",
  "user_id": 123,
  "user_name": "John"
}

OR

{
  "type": "user_offline",
  "user_id": 123
}

Frontend receives:
ChatContext.handleUserOnline() / handleUserOffline():
1. Update onlineUsers set
2. UI updates: green dot on DIRECT conversations with that user
3. Message view: online status changes
```

---

### Message Type: "ping" / "pong" (Heartbeat)

```
Every 30 seconds, frontend sends:
{
  "type": "ping"
}

Backend immediately responds:
{
  "type": "pong"
}

Purpose:
1. Keep connection alive (some firewalls/proxies close idle connections)
2. Detect stale connections (if no pong received, reconnect)
3. Maintain WebSocket session on backend
```

---

## API Integration

### REST Endpoints (chatApi.js)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat/users` | GET | Get all available users |
| `/chat/users/online` | GET | Get currently online users |
| `/chat/conversations` | GET | Get user's conversations (paginated) |
| `/chat/conversations` | POST | Create new conversation |
| `/chat/conversations/:id/messages` | GET | Get messages in conversation |
| `/chat/messages` | POST | Send text message |
| `/chat/messages/file` | POST | Send file/image message (multipart) |
| `/chat/mark-as-read` | POST | Mark messages as read |

**Example: Send Message**

```javascript
// chatApi.sendMessage()
async sendMessage({ conversation_id, content, message_type = 'TEXT' }) {
  const response = await axiosInstance.post('/chat/messages', {
    conversation_id,
    content,
    message_type
  });
  return response.data; // Returns: { id, sender_id, created_at, ... }
}
```

**Example: Create Conversation**

```javascript
// chatApi.createConversation()
async createConversation({ type, member_ids, name = null }) {
  const response = await axiosInstance.post('/chat/conversations', {
    type, // 'DIRECT' or 'GROUP'
    member_ids,
    name
  });
  return response.data; // Returns: { id, type, name, members[], ... }
}
```

---

## State Management

### ChatContext State Structure

```javascript
{
  // Conversations list
  conversations: [
    {
      id: 45,
      type: 'DIRECT',
      name: 'John Doe',
      member_ids: [123, 456],
      members: [
        { user_id: 123, user_name: 'Me' },
        { user_id: 456, user_name: 'John Doe' }
      ],
      last_message: { content: '...', created_at: '...' },
      updated_at: '2024-01-15T10:30:00Z'
    },
    {
      id: 46,
      type: 'GROUP',
      name: 'Project Team',
      member_ids: [123, 456, 789],
      members: [...],
      last_message: { content: '...', created_at: '...' },
      updated_at: '2024-01-15T10:25:00Z'
    }
  ],

  // Messages by conversation (keyed for efficient lookup)
  messages: {
    45: [
      {
        id: 1234,
        conversation_id: 45,
        sender_id: 456,
        sender_name: 'John',
        content: 'Hello!',
        message_type: 'TEXT',
        created_at: '2024-01-15T10:30:00Z',
        is_read: true,
        read_receipts: [{ reader_id: 123, read_at: '...' }]
      },
      { id: 1235, sender_id: 123, content: 'Hi there!', ... }
    ],
    46: [ ... ]
  },

  // User online status
  onlineUsers: Set(123, 456, 789), // Set of online user IDs

  // Unread message counts
  unreadCounts: {
    45: 0, // No unread in this conversation
    46: 3  // 3 unread messages in group chat
  },

  // Users available for new conversations
  allUsers: [
    { id: 789, name: 'Jane Smith', role: 'trainer', ... },
    { id: 456, name: 'John Doe', role: 'learner', ... }
  ],

  // Currently selected conversation (for detail view)
  currentConversation: {
    id: 45,
    type: 'DIRECT',
    name: 'John Doe',
    // ... (same structure as above)
  },

  // WebSocket connection status
  isConnected: true,

  // Typing users
  typingUsers: {
    '45:456': true, // User 456 typing in conversation 45
    '46:789': true  // User 789 typing in conversation 46
  }
}
```

---

## Mobile vs Desktop Strategy

### Responsive Breakpoint: 768px

**Mobile (≤ 768px):**
- Floating button (60px) in bottom-right
- Tap button → Full-screen modal
- Modal has split view: conversations left, messages right
- On small phones, conversation list can slide aside
- Input area optimized for touch

**Desktop (> 768px):**
- LinkedIn-style popup (350px × 500px) always visible
- Fixed bottom-right position
- Can be collapsed to button
- Persistent access while browsing
- Input area has more space for emoji picker, attachments

**Tablet (≈ 768-1024px):**
- Depends on orientation
- Landscape: Desktop-like popup
- Portrait: Mobile-like modal

### CSS Media Queries

```css
/* Hide mobile-only elements on desktop */
@media (max-width: 768px) {
  .chat-widget-mobile-only {
    display: block !important;
  }
  .messaging-widget-desktop-only {
    display: none !important;
  }
}

/* Show desktop widget on larger screens */
@media (min-width: 769px) {
  .chat-widget-mobile-only {
    display: none !important;
  }
  .messaging-widget-desktop-only {
    display: block !important;
  }
}
```

---

## Performance Considerations

### Lazy Connection Strategy

**Issue:** WebSocket connections consume server resources. If app has 1000 users on homepage, that's 1000 WebSocket connections, even if they never open chat.

**Solution:**
- MessagingWidget: Connect only when user expands widget (list view)
- ChatIconWidget (mobile): Connect only when user opens modal
- Disconnect when widget is collapsed or modal closed

**Implementation:**
```jsx
useEffect(() => {
  if (widgetState !== 'collapsed') {
    connectChat();
    return () => disconnectChat();
  }
}, [widgetState, connectChat, disconnectChat]);
```

**Impact:**
- Reduces server WebSocket load by ~90%
- Users only pay for connections they use
- Faster page load (no WebSocket handshake overhead)

---

### Message Pagination

**Issue:** Loading all messages for a conversation is expensive (bandwidth, memory).

**Solution:**
- Load 50 messages initially
- Implement "Load more" button to fetch older messages
- Cache loaded messages in state (don't re-fetch)

```jsx
const loadMessages = async (conversationId, offset = 0, limit = 50) => {
  const response = await chatApi.getMessages(conversationId, offset, limit);
  setMessages(prev => ({
    ...prev,
    [conversationId]: response.messages
  }));
};

// User scrolls to top of messages
// onClick "Load more" or infinite scroll:
const handleLoadMore = () => {
  const currentCount = messages[conversationId].length;
  loadMessages(conversationId, currentCount, 50); // Load next batch
};
```

---

### Conversation List Virtualization (Future)

**Consideration:** If user has 1000+ conversations, rendering all at once is slow.

**Potential Solution:**
- Use `react-window` for virtual scrolling
- Render only visible items in list
- Dramatically improves performance for large conversation lists

---

### Unread Count Caching

**Strategy:** Cache unread counts per conversation in ChatContext, don't refetch from server constantly.

```jsx
// Backend tracks unread via ReadReceipt table
// Frontend caches unreadCounts{}

// Automatically updated via WebSocket events:
- New message received → unreadCounts[convId]++
- Messages marked as read → unreadCounts[convId] = 0
- User opens chat → markAsRead() → unreadCounts[convId] = 0
```

**No expensive queries needed** – state is authoritative.

---

### Optimistic UI

**Pattern:** Show message sent before API confirms, preventing perceived lag.

```jsx
// User sends message
const handleSendMessage = () => {
  const message = {
    id: 'temp-' + Date.now(), // Temporary ID
    content: messageInput,
    sender_id: currentUser.id,
    created_at: new Date(),
    is_read: false,
    state: 'sending' // Custom state for UI
  };

  // Optimistically add to state
  setMessages(prev => ({
    ...prev,
    [conversationId]: [...prev[conversationId], message]
  }));

  // Send to server
  sendMessage(conversationId, messageInput)
    .then(response => {
      // Replace temp message with confirmed message
      setMessages(prev => ({
        ...prev,
        [conversationId]: prev[conversationId].map(msg =>
          msg.id === message.id ? { ...response, state: 'sent' } : msg
        )
      }));
    })
    .catch(error => {
      // Remove message on failure
      setMessages(prev => ({
        ...prev,
        [conversationId]: prev[conversationId].filter(msg => msg.id !== message.id)
      }));
    });
};
```

---

## Summary: Why Dual Widgets?

| Aspect | Why Dual Widgets? |
|--------|------------------|
| **Mobile UX** | Full-screen modal required for touch, small screen. Floating button too cramped. |
| **Desktop UX** | Persistent popup maximizes productivity. Can chat while browsing. Desktop has space. |
| **Code Reuse** | Both use ChatContext, ChatAPI, shared components (EmojiPicker, ImageModal). DRY principle. |
| **Lazy Connection** | Don't maintain WebSocket unless user needs chat. Reduces server load. |
| **Accessibility** | Single entry point (ChatIconWidget) handles routing logic. Easy to hide on sessions. |
| **Responsive Design** | Same HTML/CSS, different visual presentation via media queries. |
| **Performance** | Lazy load, pagination, optimistic UI, connection pooling. |
| **Future Flexibility** | Can evolve mobile/desktop independently. E.g., add WebRTC calling to desktop only. |

---

## Integration Checklist

When working with the chat system:

- [ ] Import `useChat()` hook from ChatContext to access state/methods
- [ ] Call `connectChat()` when opening chat UI, `disconnectChat()` when closing
- [ ] Use `sendMessage()` for text, `sendFileMessage()` for uploads
- [ ] Call `markAsRead()` when showing conversation to user
- [ ] Listen to `unreadCounts{}` to display badges
- [ ] Handle `isConnected` state for connection status indicator
- [ ] Render `typingUsers` for "typing..." indicators
- [ ] Use `currentConversation` for detailed info (members, etc.)
- [ ] Implement pagination with `loadMessages(convId, offset, limit)`
- [ ] Test responsive behavior: desktop (350px widget) vs mobile (full-screen modal)
- [ ] Verify hidden pages list in ChatIconWidget (sessions, login, etc.)

---

## File Structure

```
src/
├─ components/chat/
│  ├─ ChatIconWidget.jsx           ◄─ Entry point (mobile + desktop routing)
│  ├─ MessagingWidget.jsx          ◄─ Desktop LinkedIn-style popup
│  ├─ EmojiPicker.jsx              ◄─ Shared emoji component
│  ├─ ImageModal.jsx               ◄─ Shared image preview
│  └─ ...other chat components
├─ context/chat/
│  ├─ ChatContext.jsx              ◄─ State management + WebSocket
│  └─ chatApi.js                   ◄─ REST API client
├─ pages/chat/
│  ├─ UnifiedChatPage.jsx          ◄─ WhatsApp-like split/modal view
│  ├─ ChatWindowPage.jsx           ◄─ Single conversation detail
│  └─ ...other chat pages
├─ styles/chats/
│  ├─ MessagingWidget.css          ◄─ Desktop widget styling
│  ├─ ChatWindowPage.css           ◄─ Detail page styling
│  ├─ UnifiedChatPage.css          ◄─ Split view styling
│  └─ ...other chat styles
└─ styles/components/chat/
   └─ chatWidget.css               ◄─ Responsive widget styles
```

---

## Deployment Notes

- **WebSocket Endpoint:** `/api/chat/ws` (keep separate from WebRTC `/ws/rtc/{sessionId}`)
- **CORS:** Ensure chat API endpoints allow cross-origin requests
- **SSL/TLS:** WebSocket requires matching protocol (wss:// for https://)
- **Load Balancing:** If using multiple backend servers, ensure sticky sessions or centralized message broker (Redis)
- **Rate Limiting:** Implement per-user/per-conversation rate limits for sendMessage, file uploads
- **Message Retention:** Define policy (keep all, last 30 days, last 1000 per conversation)

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2024  
**Maintainers:** [Your Name/Team]
