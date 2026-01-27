/**
 * Unified Chat Page - WhatsApp-like Interface
 * Split view on desktop, single view on mobile
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Search,
  MoreVertical,
  Users,
  MessageSquarePlus,
  Smile,
  Download
} from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import { useAuth } from '../../context/AuthContext';
import EmojiPicker from '../../components/chat/EmojiPicker';
import ImageModal from '../../components/chat/ImageModal';
import '../../styles/ManageUsersLayout.css';
import '../../styles/chats/UnifiedChatPage.css';

const UnifiedChatPage = ({ isModal = false }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    conversations,
    messages,
    onlineUsers,
    unreadCounts,
    typingUsers,
    allUsers,
    loading,
    currentConversation,
    createConversation,
    selectConversation,
    loadMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    sendTypingStatus,
    isConnected,
    connectChat,
    disconnectChat,
  } = useChat();

  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [filterTag, setFilterTag] = useState('ALL'); // Track active filter
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imageModal, setImageModal] = useState(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedAsReadRef = useRef(new Set());

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Connect to chat when component mounts
  useEffect(() => {
    connectChat();
    return () => {
      disconnectChat();
    };
  }, [connectChat, disconnectChat]);

  // Handle URL params for direct conversation access
  useEffect(() => {
    if (conversationId) {
      const conversation = conversations.find(c => c.id === parseInt(conversationId));
      if (conversation) {
        handleSelectChat(conversation);
      }
    }
  }, [conversationId, conversations]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    const name = conv.name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    // Search filter
    if (query && !name.includes(query)) {
      return false;
    }

    // Tag filters
    switch (filterTag) {
      case 'UNREAD':
        return (unreadCounts[conv.id] || 0) > 0;
      case 'GROUPS':
        return conv.type === 'GROUP';
      case 'ALL':
      default:
        return true;
    }
  });

  // Available users for new chat
  const availableUsers = useMemo(() => {
    const conversationUserIds = new Set();
    conversations.forEach(conv => {
      if (conv.type === 'DIRECT') {
        conv.members?.forEach(member => {
          if (member.user_id !== currentUser?.id) {
            conversationUserIds.add(member.user_id);
          }
        });
      }
    });
    
    return allUsers.filter(u => 
      u.id !== currentUser?.id && !conversationUserIds.has(u.id)
    );
  }, [allUsers, conversations, currentUser?.id]);

  // Handle chat selection
  const handleSelectChat = (conversation) => {
    setSelectedChat(conversation);
    selectConversation(conversation);
    loadMessages(conversation.id);
    if (!isModal) {
      navigate(`/chat/${conversation.id}`, { replace: true });
    }
  };

  // Handle back to list on mobile
  const handleBackToList = () => {
    setSelectedChat(null);
    if (!isModal) {
      navigate('/chat', { replace: true });
    }
  };

  // Mark messages as read
  useEffect(() => {
    if (selectedChat && messages[selectedChat.id]?.length > 0) {
      const unreadMessages = messages[selectedChat.id].filter(
        msg => !msg.is_read && 
               msg.sender_id !== currentUser?.id && 
               !markedAsReadRef.current.has(msg.id)
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        messageIds.forEach(id => markedAsReadRef.current.add(id));
        markAsRead(selectedChat.id, messageIds);
      }
    }
  }, [selectedChat, messages, markAsRead, currentUser]);

  // Scroll to bottom
  useEffect(() => {
    if (selectedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedChat]);

  // Handle typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping && selectedChat) {
      setIsTyping(true);
      sendTypingStatus(selectedChat.id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedChat) {
        sendTypingStatus(selectedChat.id, false);
      }
    }, 3000);
  }, [isTyping, selectedChat, sendTypingStatus]);

  // Handle send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!messageInput.trim() || !selectedChat) return;

    const content = messageInput.trim();
    setMessageInput('');

    if (isTyping) {
      setIsTyping(false);
      sendTypingStatus(selectedChat.id, false);
    }

    try {
      await sendMessage(selectedChat.id, content);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    if (file.size > 60 * 1024 * 1024) {
      alert('File size must be less than 60MB');
      return;
    }

    setUploadingFile(true);
    
    try {
      await sendFileMessage(selectedChat.id, file);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setMessageInput(prev => prev + emoji);
  };

  // Handle file download
  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(fileUrl, '_blank');
    }
  };

  // Handle new direct chat
  const handleNewDirectChat = async (otherUser) => {
    try {
      setShowNewChatModal(false);
      const conversation = await createConversation('DIRECT', [otherUser.id]);
      // Immediately select and open the chat
      setSelectedChat(conversation);
      selectConversation(conversation);
      loadMessages(conversation.id);
      navigate(`/chat/${conversation.id}`, { replace: true });
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
      handleSelectChat(conversation);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

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

  // Format message time
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Get typing users
  const getTypingUsersNames = () => {
    if (!selectedChat || !typingUsers[selectedChat.id]) return [];
    
    const typingSet = typingUsers[selectedChat.id];
    const typingArray = Array.from(typingSet).filter(id => id !== currentUser?.id);
    
    const names = selectedChat.members
      ?.filter(m => typingArray.includes(m.user_id))
      .map(m => m.user_name.split(' ')[0]) || [];
    
    return names;
  };

  const canCreateGroups = ['ADMIN', 'HEAD', 'TRAINER', 'COACH'].includes(currentUser?.role?.toUpperCase());
  const conversationMessages = selectedChat ? (messages[selectedChat.id] || []) : [];
  const typingNames = getTypingUsersNames();
  
  // Get other user ID for direct chats (direct approach like in modal)
  const otherUserId = selectedChat?.type === 'DIRECT' 
    ? selectedChat.member_ids?.find(id => id !== currentUser?.id)
    : null;
  
  // Debug logging
  if (selectedChat?.type === 'DIRECT') {
    console.log('[OnlineStatus Debug]', {
      selectedChatName: selectedChat.name,
      memberIds: selectedChat.member_ids,
      currentUserId: currentUser?.id,
      otherUserId,
      onlineUsersArray: Array.from(onlineUsers),
      isOnline: otherUserId && onlineUsers.has(otherUserId)
    });
  }

  return (
    <div className="unified-chat-container">
      {/* Left Sidebar - Chat List */}
      <div className={`chat-sidebar ${selectedChat ? 'hidden-mobile' : ''}`}>
        {/* Sidebar Header */}
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-header-left">
            <div className="chat-user-avatar">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h2 className="chat-sidebar-title">Chats</h2>
          </div>
          
          <div className="chat-sidebar-actions">
            <div className={`chat-connection-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
            <button
              onClick={() => setShowNewChatModal(true)}
              className="chat-icon-btn"
            >
              <MessageSquarePlus size={20} />
            </button>
            <button className="chat-icon-btn">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="chat-search-wrapper">
          <div className="chat-search-box">
            <Search className="chat-search-box-icon" size={18} />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tags */}
        <div className="chat-filter-tags">
          <button 
            className={`chat-filter-tag ${filterTag === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterTag('ALL')}
          >
            All
          </button>
          <button 
            className={`chat-filter-tag ${filterTag === 'GROUPS' ? 'active' : ''}`}
            onClick={() => setFilterTag('GROUPS')}
          >
            Groups
          </button>
        </div>

        {/* Chat List */}
        <div className="chat-list">
          {loading ? (
            <div className="chat-list-loading">
              <div className="chat-list-spinner" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="chat-list-empty">
              <MessageSquarePlus size={48} className="chat-list-empty-icon" />
              <p>No conversations yet</p>
              <p style={{ fontSize: '0.875rem' }}>Click + to start messaging</p>
            </div>
          ) : (
            filteredConversations.map(conversation => {
              const unreadCount = unreadCounts[conversation.id] || 0;
              const lastMessage = conversation.last_message;
              const isActive = selectedChat?.id === conversation.id;

              return (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectChat(conversation)}
                  className={`chat-conversation-item ${isActive ? 'active' : ''}`}
                >
                  <div className="chat-avatar-wrapper">
                    <div className="chat-conversation-avatar">
                      {conversation.type === 'GROUP' ? (
                        <Users size={20} />
                      ) : (
                        conversation.name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    {conversation.type === 'DIRECT' && conversation.member_ids?.some(id => id !== currentUser?.id && onlineUsers.has(id)) && (
                      <div className="chat-online-badge" />
                    )}
                  </div>

                  <div className="chat-conversation-details">
                    <div className="chat-conversation-header">
                      <h3 className="chat-conversation-name">{conversation.name}</h3>
                      <span className="chat-conversation-time">
                        {formatTime(conversation.updated_at)}
                      </span>
                    </div>
                    <div className="chat-conversation-footer">
                      <p className="chat-conversation-message">
                        {lastMessage?.content || lastMessage?.file_name || 'No messages yet'}
                      </p>
                      {unreadCount > 0 && (
                        <span className="chat-unread-count">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Start New Conversation Section */}
          {availableUsers.length > 0 && filterTag === 'ALL' && (
            <div className="chat-start-conversation-section">
              <div className="chat-section-divider" />
              <h3 className="chat-section-title">Start New Conversation</h3>
              <div className="chat-available-users">
                {availableUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleNewDirectChat(user)}
                    className="chat-available-user-item"
                  >
                    <div className="chat-avatar-wrapper">
                      <div className="chat-user-avatar">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      {onlineUsers.has(user.id) && (
                        <div className="chat-online-badge" />
                      )}
                    </div>

                    <div className="chat-user-details">
                      <p className="chat-user-name">{user.name}</p>
                      <p className="chat-user-role">{user.role}</p>
                    </div>

                    {onlineUsers.has(user.id) && (
                      <span className="chat-user-online-dot">●</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Area - Chat Window */}
      <div className={`chat-window ${selectedChat ? '' : 'hidden-mobile'}`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-window-header">
              <div className="chat-window-header-left">
                <button
                  onClick={handleBackToList}
                  className="chat-back-mobile"
                >
                  <ArrowLeft size={20} />
                </button>
                
                <div className="chat-avatar-wrapper">
                  <div className="chat-user-avatar">
                    {selectedChat.type === 'GROUP' ? (
                      <Users size={18} />
                    ) : (
                      selectedChat.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  {otherUserId && onlineUsers.has(otherUserId) && (
                    <div className="chat-online-badge" />
                  )}
                </div>

                <div className="chat-window-user-info">
                  <h2>{selectedChat.name}</h2>
                  {selectedChat.type === 'GROUP' && (
                    <p>{selectedChat.members?.length || 0} members</p>
                  )}
                </div>
              </div>

              <button 
                className="chat-icon-btn"
                onClick={() => setShowChatInfo(!showChatInfo)}
                title="Chat info"
              >
                <MoreVertical size={20} />
              </button>

              {/* Chat Info Dropdown */}
              {showChatInfo && (
                <div className="chat-info-dropdown">
                  <div className="chat-info-header">
                    <h3>{selectedChat.type === 'DIRECT' ? 'Contact Info' : 'Group Info'}</h3>
                    <button 
                      onClick={() => setShowChatInfo(false)}
                      className="chat-info-close"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="chat-info-body">
                    {selectedChat.type === 'DIRECT' ? (
                      <>
                        <div className="chat-info-section">
                          <h4>Participants</h4>
                          <div className="chat-info-participants">
                            {selectedChat.members?.map(member => (
                              <div key={member.user_id} className="chat-info-participant">
                                <div className="chat-avatar-wrapper">
                                  <div className="chat-user-avatar">
                                    {member.user_name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                  {onlineUsers.has(member.user_id) && (
                                    <div className="chat-online-badge" />
                                  )}
                                </div>
                                <div className="chat-participant-details">
                                  <p className="chat-participant-name">{member.user_name}</p>
                                  <p className="chat-participant-role">{member.user_role}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="chat-info-section">
                          <h4>Group Participants ({selectedChat.members?.length || 0})</h4>
                          <div className="chat-info-participants">
                            {selectedChat.members?.map(member => (
                              <div key={member.user_id} className="chat-info-participant">
                                <div className="chat-avatar-wrapper">
                                  <div className="chat-user-avatar">
                                    {member.user_name?.charAt(0).toUpperCase() || 'U'}
                                  </div>
                                  {onlineUsers.has(member.user_id) && (
                                    <div className="chat-online-badge" />
                                  )}
                                </div>
                                <div className="chat-participant-details">
                                  <p className="chat-participant-name">{member.user_name}</p>
                                  <p className="chat-participant-role">{member.user_role}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="chat-messages-area">
              <div className="chat-messages-container">
                {conversationMessages.map((message) => {
                  const isOwnMessage = message.sender_id === currentUser?.id;
                  const showSenderName = selectedChat.type === 'GROUP' && !isOwnMessage;

                  return (
                    <div
                      key={message.id}
                      className={`chat-message-wrapper ${isOwnMessage ? 'own' : 'other'}`}
                    >
                      <div className={`chat-message-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                        {showSenderName && (
                          <p className="chat-message-sender-name">
                            {message.sender_name}
                          </p>
                        )}

                        {/* File Message */}
                        {message.file_url && (
                          <div className="chat-message-file">
                            {message.message_type === 'IMAGE' ? (
                              <div className="chat-file-media">
                                <img
                                  src={message.file_url}
                                  alt={message.file_name}
                                  className="chat-message-thumbnail"
                                  onClick={() => setImageModal({ url: message.file_url, name: message.file_name })}
                                  title="Click to view full size"
                                />
                                <button
                                  className="chat-file-download-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(message.file_url, message.file_name);
                                  }}
                                  title="Download image"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : message.message_type === 'VIDEO' ? (
                              <div className="chat-file-media">
                                <video src={message.file_url} controls />
                                <button
                                  className="chat-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
                                  title="Download video"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : message.message_type === 'AUDIO' ? (
                              <div className="chat-file-media">
                                <audio src={message.file_url} controls />
                                <button
                                  className="chat-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
                                  title="Download audio"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="chat-file-document">
                                <a
                                  href={message.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Paperclip size={14} />
                                  {message.file_name}
                                </a>
                                <button
                                  className="chat-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
                                  title="Download file"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text Content */}
                        {message.content && (
                          <p className="chat-message-content">
                            {message.content}
                          </p>
                        )}

                        {/* Time & Read Receipt */}
                        <div className="chat-message-meta">
                          <span className="chat-message-time">
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {typingNames.length > 0 && (
                  <div className="chat-typing-indicator">
                    <div className="chat-typing-bubble">
                      <p className="chat-typing-text">
                        {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing
                      </p>
                      <div className="chat-typing-dots">
                        <div className="chat-typing-dot" />
                        <div className="chat-typing-dot" />
                        <div className="chat-typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <button
                  ref={emojiButtonRef}
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => {
                    if (isMobile) {
                      // On mobile, focus input and let native emoji keyboard open
                      document.querySelector('.chat-input')?.focus();
                    } else {
                      // On desktop/tablet, toggle emoji picker
                      setShowEmojiPicker(!showEmojiPicker);
                    }
                  }}
                  title="Emoji"
                >
                  <Smile size={24} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="chat-input-file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="chat-icon-btn"
                  title="Attach file"
                >
                  <Paperclip size={24} />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTypingStart();
                  }}
                  placeholder="Type a message"
                  className="chat-input"
                />

                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="chat-send-btn"
                  title="Send message"
                >
                  <Send size={20} />
                </button>
              </form>

              {uploadingFile && (
                <p className="chat-uploading-text">Uploading file...</p>
              )}

              {/* Emoji Picker - Desktop/Tablet Only */}
              {!isMobile && showEmojiPicker && (
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                  buttonRef={emojiButtonRef}
                />
              )}
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="chat-welcome-screen">
            <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
              <div className="chat-welcome-icon">
                <svg viewBox="0 0 303 172" style={{ width: '100%', height: '100%' }}>
                  <path fill="currentColor" d="M151.5 0C67.9 0 0 67.9 0 151.5S67.9 303 151.5 303 303 235.1 303 151.5 235.1 0 151.5 0zm0 282C79 282 21 224 21 151.5S79 21 151.5 21 282 79 282 151.5 224 282 151.5 282z"/>
                </svg>
              </div>
              <h2 className="chat-welcome-title">HurshbinTech Chat</h2>
              <p className="chat-welcome-description">
                Send and receive messages without keeping your phone online.
                Use HurshbinTech Chat on up to 4 linked devices and 1 mobile phone.
              </p>
              <div className="chat-welcome-divider" />
              <p className="chat-welcome-encrypted">
                <span style={{ display: 'inline-block', width: '1rem', height: '1rem' }}>🔒</span>
                End-to-end encrypted
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal">
            <div className="chat-modal-header">
              <div className="chat-modal-header-top">
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
                  className="chat-modal-close"
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
              {allUsers.filter(u => u.id !== currentUser?.id).map(availUser => (
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
                      readOnly
                      className="chat-modal-checkbox"
                    />
                  )}

                  <div className="chat-avatar-wrapper">
                    <div className="chat-user-avatar">
                      {availUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {onlineUsers.has(availUser.id) && (
                      <div className="chat-online-badge" />
                    )}
                  </div>

                  <div className="chat-modal-user-details">
                    <p className="chat-modal-user-name">{availUser.name}</p>
                    <p className="chat-modal-user-role">{availUser.role}</p>
                  </div>

                  {onlineUsers.has(availUser.id) && (
                    <span className="chat-modal-online-status">Online</span>
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

      {/* Image Modal */}
      {imageModal && (
        <ImageModal
          imageUrl={imageModal.url}
          fileName={imageModal.name}
          onClose={() => setImageModal(null)}
        />
      )}
    </div>
  );
};

export default UnifiedChatPage;
