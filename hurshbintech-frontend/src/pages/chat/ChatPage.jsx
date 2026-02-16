/**
 * Chat Page - Conversations List
 * WhatsApp-like home page showing all conversations
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Users, MessageSquarePlus } from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import SearchBar from "../../components/common/SearchBar";
import { useAuth } from '../../context/AuthContext';
import '../../styles/ManageUsersLayout.css';
import '../../styles/chats/ChatPage.css';

const ChatPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations,
    onlineUsers,
    unreadCounts,
    allUsers,
    loading,
    createConversation,
    selectConversation,
    isConnected,
    connectChat,
    disconnectChat,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Connect to chat when component mounts
  useEffect(() => {
    connectChat();
    
    return () => {
      disconnectChat();
    };
  }, [connectChat, disconnectChat]);

  // Handle search function
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    const name = conv.name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query);
  });

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Handle conversation click
  const handleConversationClick = (conversation) => {
    selectConversation(conversation);
    navigate(`/chat/${conversation.id}`);
  };

  // Handle new direct chat
  const handleNewDirectChat = async (otherUser) => {
    try {
      setShowNewChatModal(false);
      const conversation = await createConversation('DIRECT', [otherUser.id]);
      // Select conversation and navigate to chat window
      selectConversation(conversation);
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      alert('Failed to create conversation. Please try again.');
    }
  };

  // Handle create group
  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      alert('Please select at least 2 members for group');
      return;
    }

    if (!groupName.trim()) {
      alert('Please enter group name');
      return;
    }

    try {
      const conversation = await createConversation(
        'GROUP',
        selectedUsers.map(u => u.id),
        groupName
      );
      setShowNewChatModal(false);
      setSelectedUsers([]);
      setGroupName('');
      setIsCreatingGroup(false);
      handleConversationClick(conversation);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  // Can user create groups?
  const canCreateGroups = ['ADMIN', 'HEAD', 'TRAINER', 'COACH'].includes(user?.role?.toUpperCase());

  // Get dashboard route based on user role
 const getDashboardUrl = () => {
    if (!user || !user.role) return '/dashboard';
    const dashboardMap = {
      'head': '/head/dashboard',
      'trainer': '/trainer/dashboard',
      'coach': '/coach/dashboard',
      'admin': '/admin/dashboard',
      'learner': '/learner/dashboard'
    };
    return dashboardMap[user.role] || '/dashboard';
  };

  // Filter users - exclude current user AND users with existing conversations
  const availableUsers = useMemo(() => {
    const conversationUserIds = new Set();
    conversations.forEach(conv => {
      if (conv.type === 'DIRECT') {
        conv.members?.forEach(member => {
          if (member.user_id !== user?.id) {
            conversationUserIds.add(member.user_id);
          }
        });
      }
    });
    
    return allUsers.filter(u => 
      u.id !== user?.id && !conversationUserIds.has(u.id)
    );
  }, [allUsers, conversations, user?.id]);

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header with Back Button and Title */}
          <div className="page-header">
            <button
              onClick={() => navigate(getDashboardUrl())}
              className="back-button"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
            
            <div>
              <h1 className="page-title">Chats</h1>
              <p className="page-description">View and manage your conversations</p>
            </div>

            <div className="chat-header-actions">
              <div className={`chat-connection-status ${isConnected ? 'connected' : 'disconnected'}`} />
              
              <button
                onClick={() => setShowNewChatModal(true)}
                className="chat-new-btn"
                title="New Chat"
              >
                <MessageSquarePlus size={24} />
              </button>
            </div>
          </div>

          {/* Disappearing Messages Alert */}
          <div className="chat-alert-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span>Messages will disappear in 7 days</span>
          </div>

          {/* Search Bar */}
         <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact..."
            />
            
          </div>

          {/* Conversations List */}
          <div className="chat-content">
            {loading ? (
              <div className="loading-container">
                <div className="chat-loading-spinner"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-message">
              <MessageSquarePlus size={64} className="chat-empty-icon" />
              <p className="chat-empty-title">No conversations yet</p>
              <p className="chat-empty-subtitle">Select a user below or click the + button to start messaging</p>
            </div>

            {/* Available Users List */}
            {availableUsers.length > 0 && (
              <div className="chat-available-users-section">
                <h3 className="chat-section-title">Start a New Chat</h3>
                <div className="chat-users-list">
                  {availableUsers.map(availUser => (
                    <div
                      key={availUser.id}
                      onClick={() => handleNewDirectChat(availUser)}
                      className="chat-user-item"
                    >
                      <div className="chat-avatar-container">
                        <div className="chat-user-avatar">
                          {availUser.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {onlineUsers.has(availUser.id) && (
                          <div className="chat-avatar-online-indicator" />
                        )}
                      </div>

                      <div className="chat-user-info">
                        <p className="chat-user-name">{availUser.name}</p>
                        <p className="chat-user-role">{availUser.role}</p>
                      </div>

                      {onlineUsers.has(availUser.id) && (
                        <span className="chat-user-status">●</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableUsers.length === 0 && (
              <div className="chat-no-users">
                No other users available
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Conversations */}
            {filteredConversations.map(conversation => {
              const unreadCount = unreadCounts[conversation.id] || 0;
              const lastMessage = conversation.last_message;

              return (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation)}
                  className="chat-conversation-item"
                >
                  <div className="chat-avatar-container">
                    <div className="chat-avatar">
                      {conversation.type === 'GROUP' ? (
                        <Users size={24} />
                      ) : (
                        conversation.name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    {conversation.type === 'DIRECT' && conversation.member_ids?.some(id => id !== user?.id && onlineUsers.has(id)) && (
                      <div className="chat-avatar-online-indicator" />
                    )}
                  </div>

                  <div className="chat-conversation-content">
                    <div className="chat-conversation-header">
                      <h3 className="chat-conversation-name">
                        {conversation.name}
                      </h3>
                      <span className="chat-conversation-time">
                        {formatTime(conversation.updated_at)}
                      </span>
                    </div>

                    <div className="chat-conversation-footer">
                      <p className="chat-conversation-message">
                        {lastMessage?.content || lastMessage?.file_name || 'No messages yet'}
                      </p>
                      
                      {unreadCount > 0 && (
                        <span className="chat-unread-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Available Users List After Conversations */}
            {availableUsers.length > 0 && (
              <div className="chat-available-users-section">
                <h3 className="chat-section-title">Start a New Chat</h3>
                <div className="chat-users-list">
                  {availableUsers.map(availUser => (
                    <div
                      key={availUser.id}
                      onClick={() => handleNewDirectChat(availUser)}
                      className="chat-user-item"
                    >
                      <div className="chat-avatar-container">
                        <div className="chat-user-avatar">
                          {availUser.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {onlineUsers.has(availUser.id) && (
                          <div className="chat-avatar-online-indicator" />
                        )}
                      </div>

                      <div className="chat-user-info">
                        <p className="chat-user-name">{availUser.name}</p>
                        <p className="chat-user-role">{availUser.role}</p>
                      </div>

                      {onlineUsers.has(availUser.id) && (
                        <span className="chat-user-status">●</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
          </div>
        </div>
      </main>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div className="chat-modal-header-flex">
                <h2 className="chat-modal-title">
                  {isCreatingGroup ? 'Create Group' : 'New Chat'}
                </h2>
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setIsCreatingGroup(false);
                    setSelectedUsers([]);
                    setGroupName('');
                  }}
                  className="chat-modal-close-btn"
                >
                  ✕
                </button>
              </div>

              {canCreateGroups && !isCreatingGroup && (
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="chat-modal-group-toggle"
                >
                  <Users size={16} />
                  Create Group Chat
                </button>
              )}

              {isCreatingGroup && (
                <input
                  type="text"
                  placeholder="Group Name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="chat-modal-group-input"
                />
              )}
            </div>

            <div className="chat-modal-body">
              {allUsers.filter(u => u.id !== user?.id).map(availUser => (
                <div
                  key={availUser.id}
                  onClick={() => {
                    if (isCreatingGroup) {
                      setSelectedUsers(prev => 
                        prev.find(u => u.id === availUser.id)
                          ? prev.filter(u => u.id !== availUser.id)
                          : [...prev, availUser]
                      );
                    } else {
                      handleNewDirectChat(availUser);
                    }
                  }}
                  className="chat-modal-user-item"
                >
                  {isCreatingGroup && (
                    <input
                      type="checkbox"
                      checked={selectedUsers.find(u => u.id === availUser.id) !== undefined}
                      onChange={() => {}}
                      className="chat-modal-checkbox"
                    />
                  )}

                  <div className="chat-avatar-container">
                    <div className="chat-user-avatar">
                      {availUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {onlineUsers.has(availUser.id) && (
                      <div className="chat-avatar-online-indicator" />
                    )}
                  </div>

                  <div className="chat-user-info">
                    <p className="chat-user-name">{availUser.name}</p>
                    <p className="chat-user-role">{availUser.role}</p>
                  </div>

                  {onlineUsers.has(availUser.id) && (
                    <span className="chat-user-status">Online</span>
                  )}
                </div>
              ))}
            </div>

            {isCreatingGroup && (
              <div className="chat-modal-footer">
                <button
                  onClick={handleCreateGroup}
                  disabled={selectedUsers.length < 2 || !groupName.trim()}
                  className="chat-modal-create-btn"
                >
                  Create Group ({selectedUsers.length} members)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
