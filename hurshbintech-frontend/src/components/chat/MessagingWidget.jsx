/**
 * LinkedIn-style Messaging Widget
 * Bottom-right popup with collapsed, list, and chat views
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, ChevronDown, ChevronUp, Search, Settings, 
  MoreHorizontal, MessageSquarePlus, X, Send, Paperclip, Smile, 
  ArrowLeft, Check, CheckCheck, Image as ImageIcon,
  Download, Users
} from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getFileUrl } from '../../utils/urlHelper';
import EmojiPicker from './EmojiPicker';
import ImageModal from './ImageModal';
import '../../styles/chats/MessagingWidget.css';

const MessagingWidget = () => {
  const { user: currentUser } = useAuth();
  const {
    conversations,
    messages,
    onlineUsers,
    typingUsers,
    unreadCounts,
    sendMessage,
    sendFileMessage,
    markAsRead,
    loadMessages,
    selectConversation,
    sendTypingStatus,
    createConversation,
    currentConversation,
    allUsers,
  } = useChat();

  // Widget states: 'collapsed', 'list', 'chat'
  const [widgetState, setWidgetState] = useState('collapsed');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'new'
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageModal, setImageModal] = useState(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [filterTag, setFilterTag] = useState('ALL'); // 'ALL' or 'GROUPS'
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedAsReadRef = useRef(new Set());

  // Auto-scroll to bottom in chat view
  useEffect(() => {
    if (widgetState === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConversation, widgetState]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (widgetState === 'chat' && selectedConversation && messages[selectedConversation.id]?.length > 0) {
      const conversationMessages = messages[selectedConversation.id];
      const unreadMessages = conversationMessages.filter(
        msg => !msg.is_read && msg.sender_id !== currentUser?.id && !markedAsReadRef.current.has(msg.id)
      );

      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => markedAsReadRef.current.add(msg.id));
        markAsRead(selectedConversation.id);
      }
    }
  }, [selectedConversation, messages, markAsRead, currentUser, widgetState]);

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Search filter
    if (!matchesSearch) return false;

    // Tag filters
    switch (filterTag) {
      case 'GROUPS':
        return conv.type === 'GROUP';
      case 'ALL':
      default:
        return true;
    }
  });

  // Available users for new chat (exact same logic as UnifiedChatPage)
  const availableUsers = React.useMemo(() => {
    const conversationUserIds = new Set();
    conversations.forEach(conv => {
      if (conv.type === 'DIRECT') {
        // For DIRECT chats, add the other user's ID
        conv.member_ids?.forEach(memberId => {
          if (memberId !== currentUser?.id) {
            conversationUserIds.add(memberId);
          }
        });
      }
    });
    
    return allUsers.filter(u => 
      u.id !== currentUser?.id && !conversationUserIds.has(u.id)
    );
  }, [allUsers, conversations, currentUser?.id]);

  // Filter available users based on search
  const filteredAvailableUsers = availableUsers.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle widget state
  const handleToggleWidget = () => {
    if (widgetState === 'collapsed') {
      setWidgetState('list');
    } else if (widgetState === 'list') {
      setWidgetState('collapsed');
    } else if (widgetState === 'chat') {
      setWidgetState('list');
      setSelectedConversation(null);
    }
  };

  // Open conversation
  const handleOpenConversation = (conversation) => {
    if (!conversation || !conversation.id) {
      console.error('Invalid conversation:', conversation);
      return;
    }
    setSelectedConversation(conversation);
    selectConversation(conversation.id);
    loadMessages(conversation.id);
    setWidgetState('chat');
  };

  // Back to list
  const handleBackToList = () => {
    setWidgetState('list');
    setSelectedConversation(null);
  };

  // Start new conversation with user
  const handleStartNewChat = async (user) => {
    try {
      const newConv = await createConversation('DIRECT', [user.id]);
      if (newConv) {
        setSelectedConversation(newConv);
        selectConversation(newConv.id);
        loadMessages(newConv.id);
        setWidgetState('chat');
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !selectedConversation || isSubmitting) return;

    const messageToSend = messageInput.trim();
    setMessageInput('');
    setIsTyping(false);
    setIsSubmitting(true);

    try {
      await sendMessage(selectedConversation.id, messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on error
      setMessageInput(messageToSend);
    } finally {
      setIsSubmitting(false);
    }
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    if (file.size > 60 * 1024 * 1024) {
      alert('File size must be less than 60MB');
      return;
    }

    setUploadingFile(true);
    try {
      await sendFileMessage(selectedConversation.id, file);
      e.target.value = '';
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  // Typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping && selectedConversation) {
      setIsTyping(true);
      sendTypingStatus(selectedConversation.id, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedConversation) {
        sendTypingStatus(selectedConversation.id, false);
      }
    }, 3000);
  }, [isTyping, selectedConversation, sendTypingStatus]);

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
    if (!selectedConversation || !typingUsers[selectedConversation.id]) return [];
    
    const typingSet = typingUsers[selectedConversation.id];
    const typingArray = Array.from(typingSet).filter(id => id !== currentUser?.id);
    
    const names = selectedConversation.members
      ?.filter(m => typingArray.includes(m.user_id))
      .map(m => m.user_name.split(' ')[0]) || [];
    
    return names;
  };

  // Download file
  const handleDownload = async (fileUrl, fileName) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Handle create group
  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      alert('Please select at least 2 members for a group');
      return;
    }

    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    try {
      const memberIds = selectedUsers.map(u => u.id);
      const conversation = await createConversation('GROUP', memberIds, groupName.trim());
      setShowNewChatModal(false);
      setSelectedUsers([]);
      setGroupName('');
      setIsCreatingGroup(false);
      handleOpenConversation(conversation);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  const canCreateGroups = ['ADMIN', 'HEAD', 'TRAINER'].includes(currentUser?.role?.toUpperCase());
  const conversationMessages = selectedConversation ? (messages[selectedConversation.id] || []) : [];
  const typingNames = getTypingUsersNames();
  const otherUserId = selectedConversation?.type === 'DIRECT' 
    ? selectedConversation.member_ids?.find(id => id !== currentUser?.id)
    : null;

  // Total unread count for notification dot
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  // Render based on state
  return (
    <>
      <div className={`messaging-widget ${widgetState}`}>
        {/* COLLAPSED STATE */}
        {widgetState === 'collapsed' && (
          <div className="messaging-collapsed" onClick={handleToggleWidget}>
            <div className="messaging-collapsed-avatar">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
              {totalUnread > 0 && (
                <span className="messaging-unread-dot" />
              )}
            </div>
            <span className="messaging-collapsed-text">Messaging</span>
            {totalUnread > 0 && (
              <span className="messaging-unread-dot-header" />
            )}
            <ChevronUp size={20} className="messaging-collapsed-icon" />
          </div>
        )}

        {/* LIST VIEW */}
        {widgetState === 'list' && (
          <div className="messaging-list-view">
            {/* Header */}
            <div className="messaging-header" onClick={handleToggleWidget}>
              <div className="messaging-header-left">
                <div className="messaging-header-avatar">
                  {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <h3 className="messaging-header-title">
                  Messaging
                  {totalUnread > 0 && (
                    <span className="messaging-unread-dot-header" />
                  )}
                </h3>
              </div>
              <div className="messaging-header-actions">
                {canCreateGroups && (
                  <button 
                    className="messaging-icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNewChatModal(true);
                    }}
                    title="New chat"
                  >
                    <MessageSquarePlus size={20} />
                  </button>
                )}
                <button className="messaging-icon-btn">
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="messaging-search" style={{ position: 'relative' }}>
              <Search size={16} className="messaging-search-icon" />
              <input
                type="text"
                placeholder="Search messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="messaging-search-input"
              />
              <Settings 
                size={16} 
                className="messaging-search-settings" 
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{ cursor: 'pointer' }}
              />
              {showFilterMenu && (
                <div className="messaging-filter-menu">
                  <button
                    className={`messaging-filter-option ${filterTag === 'ALL' ? 'active' : ''}`}
                    onClick={() => {
                      setFilterTag('ALL');
                      setShowFilterMenu(false);
                    }}
                  >
                    All Chats
                  </button>
                  <button
                    className={`messaging-filter-option ${filterTag === 'GROUPS' ? 'active' : ''}`}
                    onClick={() => {
                      setFilterTag('GROUPS');
                      setShowFilterMenu(false);
                    }}
                  >
                    Groups Only
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="messaging-tabs">
              <button
                className={`messaging-tab ${activeTab === 'chats' ? 'active' : ''}`}
                onClick={() => setActiveTab('chats')}
              >
                Chats
              </button>
              <button
                className={`messaging-tab ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => setActiveTab('new')}
              >
                New Chats
              </button>
            </div>

            {/* Conversation List or Available Users */}
            <div className="messaging-conversations">
              {activeTab === 'chats' ? (
                // Existing Conversations
                filteredConversations.length === 0 ? (
                  <div className="messaging-empty">
                    <MessageCircle size={48} className="messaging-empty-icon" />
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const unreadCount = unreadCounts[conversation.id] || 0;
                    const lastMessage = conversation.last_message;

                    return (
                      <div
                        key={conversation.id}
                        className="messaging-conversation-item"
                        onClick={() => handleOpenConversation(conversation)}
                      >
                        <div className="messaging-conv-avatar-wrapper">
                          <div className="messaging-conv-avatar">
                            {conversation.type === 'GROUP' ? (
                              <Users size={16} />
                            ) : (
                              conversation.name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          {conversation.type === 'DIRECT' && conversation.member_ids?.some(id => id !== currentUser?.id && onlineUsers.has(id)) && (
                            <div className="messaging-online-badge" />
                          )}
                        </div>
                        <div className="messaging-conv-content">
                          <div className="messaging-conv-header">
                            <span className="messaging-conv-name">{conversation.name}</span>
                            <span className="messaging-conv-time">
                              {formatTime(conversation.updated_at)}
                            </span>
                          </div>
                          <div className="messaging-conv-footer">
                            <p className="messaging-conv-message">
                              {lastMessage?.content || lastMessage?.file_name || 'No messages yet'}
                            </p>
                            {unreadCount > 0 && (
                              <span className="messaging-conv-unread-dot"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                // Available Users for New Chats
                filteredAvailableUsers.length === 0 ? (
                  <div className="messaging-empty">
                    <MessageCircle size={48} className="messaging-empty-icon" />
                    <p>No users available</p>
                  </div>
                ) : (
                  filteredAvailableUsers.map((user) => {
                    const isOnline = onlineUsers.has(user.id);

                    return (
                      <div
                        key={user.id}
                        onClick={() => handleStartNewChat(user)}
                        className="messaging-conversation-item"
                      >
                        <div className="messaging-conv-avatar-wrapper">
                          <div className="messaging-conv-avatar">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          {isOnline && (
                            <div className="messaging-online-badge" />
                          )}
                        </div>

                        <div className="messaging-conv-content">
                          <div className="messaging-conv-header">
                            <span className="messaging-conv-name">{user.name}</span>
                          </div>
                          <div className="messaging-conv-footer">
                            <p className="messaging-conv-message" style={{ color: '#666' }}>
                              {user.role}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        )}

        {/* CHAT VIEW */}
        {widgetState === 'chat' && selectedConversation && (
          <div className="messaging-chat-view">
            {/* Chat Header */}
            <div className="messaging-chat-header">
              <button className="messaging-back-btn" onClick={handleBackToList}>
                <ArrowLeft size={20} />
              </button>
              <div className="messaging-chat-user-info">
                <div className="messaging-chat-avatar-wrapper">
                  <div className={`messaging-chat-avatar ${otherUserId && onlineUsers.has(otherUserId) ? 'online' : ''}`}>
                    {selectedConversation.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                <div className="messaging-chat-details">
                  <h4 className="messaging-chat-name">{selectedConversation.name}</h4>
                  {otherUserId && onlineUsers.has(otherUserId) && (
                    <span className="messaging-chat-status">Online</span>
                  )}
                </div>
              </div>
              <button 
                className="messaging-icon-btn"
                onClick={() => setShowChatDetails(!showChatDetails)}
                title="Chat details"
              >
                <MoreHorizontal size={20} />
              </button>
            </div>

            {/* Chat Details Sidebar */}
            {showChatDetails && (
              <div className="messaging-chat-details-panel">
                <div className="messaging-details-header">
                  <h4>Chat Details</h4>
                  <button 
                    className="messaging-details-close"
                    onClick={() => setShowChatDetails(false)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="messaging-details-content">
                  {/* Chat Info */}
                  <div className="messaging-details-section">
                    <div className="messaging-details-avatar-large">
                      {selectedConversation.type === 'GROUP' ? (
                        <Users size={32} />
                      ) : (
                        selectedConversation.name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <h3 className="messaging-details-name">{selectedConversation.name}</h3>
                    <p className="messaging-details-type">
                      {selectedConversation.type === 'GROUP' ? 'Group Chat' : 'Direct Message'}
                    </p>
                  </div>

                  {/* Members List */}
                  <div className="messaging-details-section">
                    <h4 className="messaging-details-section-title">
                      Members ({selectedConversation.members?.length || 0})
                    </h4>
                    <div className="messaging-details-members">
                      {selectedConversation.members?.map((member) => {
                        const isOnline = onlineUsers.has(member.user_id);
                        return (
                          <div key={member.user_id} className="messaging-details-member">
                            <div className="messaging-member-avatar-wrapper">
                              <div className="messaging-member-avatar">
                                {member.user_name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              {isOnline && <div className="messaging-member-online-badge" />}
                            </div>
                            <div className="messaging-member-info">
                              <p className="messaging-member-name">{member.user_name}</p>
                              {isOnline && <span className="messaging-member-status">Online</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedConversation.type === 'GROUP' && (
                    <div className="messaging-details-section">
                      <button className="messaging-details-action-btn messaging-details-danger">
                        Leave Group
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Disappearing Messages Alert */}
            <div className="chat-alert-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <span>Messages will disappear in 7 days</span>
            </div>

            {/* Messages */}
            <div className="messaging-chat-messages">
              {conversationMessages.map((message) => {
                const isSent = message.sender_id === currentUser?.id;
                const sender = selectedConversation.members?.find(m => m.user_id === message.sender_id);

                return (
                  <div key={`msg-${message.id}-${message.created_at}`} className={`messaging-message ${isSent ? 'sent' : 'received'}`}>
                    {!isSent && (
                      <div className="messaging-message-avatar">
                        {sender?.user_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="messaging-message-content">
                      {!isSent && selectedConversation.type === 'GROUP' && (
                        <span className="messaging-message-sender">{sender?.user_name}</span>
                      )}
                      <div className="messaging-message-bubble">
                        {message.file_url && (
                          <div className="messaging-message-file">
                            {message.message_type === 'IMAGE' ? (
                              <div className="messaging-file-media">
                                <img
                                  src={getFileUrl(message.file_url)}
                                  alt={message.file_name}
                                  className="messaging-message-thumbnail"
                                  onClick={() => setImageModal({ url: getFileUrl(message.file_url), name: message.file_name })}
                                  title="Click to view full size"
                                />
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(getFileUrl(message.file_url), message.file_name);
                                  }}
                                  title="Download image"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : message.message_type === 'VIDEO' ? (
                              <div className="messaging-file-media">
                                <video src={getFileUrl(message.file_url)} controls />
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(getFileUrl(message.file_url), message.file_name)}
                                  title="Download video"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : message.message_type === 'AUDIO' ? (
                              <div className="messaging-file-media">
                                <audio src={getFileUrl(message.file_url)} controls />
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(getFileUrl(message.file_url), message.file_name)}
                                  title="Download audio"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="messaging-file-document">
                                <a
                                  href={getFileUrl(message.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Paperclip size={14} />
                                  {message.file_name}
                                </a>
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(getFileUrl(message.file_url), message.file_name)}
                                  title="Download file"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {message.content && (
                          <p className="messaging-message-text">{message.content}</p>
                        )}
                        <div className="messaging-message-meta">
                          <span className="messaging-message-time">
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {typingNames.length > 0 && (
                <div className="messaging-typing-indicator">
                  <div className="messaging-typing-avatar">
                    {selectedConversation.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="messaging-typing-bubble">
                    <p className="messaging-typing-text">
                      {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing
                    </p>
                    <div className="messaging-typing-dots">
                      <div className="messaging-typing-dot"></div>
                      <div className="messaging-typing-dot"></div>
                      <div className="messaging-typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="messaging-chat-input">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="messaging-file-input"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="messaging-input-btn"
              >
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                className="messaging-input-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={18} />
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  handleTypingStart();
                }}
                placeholder="Write a message..."
                className="messaging-input-field"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || isSubmitting}
                className="messaging-send-btn"
              >
                <Send size={18} />
              </button>
            </form>

            {uploadingFile && (
              <div className="messaging-uploading">
                <div className="messaging-uploading-spinner"></div>
                <span>Uploading...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="chat-modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
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
                      handleStartNewChat(availUser);
                      setShowNewChatModal(false);
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
    </>
  );
};

export default MessagingWidget;
