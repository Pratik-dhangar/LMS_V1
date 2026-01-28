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
    connectChat,
    disconnectChat,
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

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedAsReadRef = useRef(new Set());

  // Connect to chat on mount
  useEffect(() => {
    connectChat();
    return () => disconnectChat();
  }, [connectChat, disconnectChat]);

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
      const newConv = await createConversation([user.id], false);
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
    if (!messageInput.trim() || !selectedConversation) return;

    try {
      await sendMessage(selectedConversation.id, messageInput.trim());
      setMessageInput('');
      setIsTyping(false);
    } catch (error) {
      console.error('Failed to send message:', error);
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
      const conversation = await createConversation(memberIds, true, groupName.trim());
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

  // Render based on state
  return (
    <>
      <div className={`messaging-widget ${widgetState}`}>
        {/* COLLAPSED STATE */}
        {widgetState === 'collapsed' && (
          <div className="messaging-collapsed" onClick={handleToggleWidget}>
            <div className="messaging-collapsed-avatar">
              {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="messaging-collapsed-text">Messaging</span>
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
                <h3 className="messaging-header-title">Messaging</h3>
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
            <div className="messaging-search">
              <Search size={16} className="messaging-search-icon" />
              <input
                type="text"
                placeholder="Search messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="messaging-search-input"
              />
              <div style={{ position: 'relative' }}>
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
                  filteredConversations.map((conv) => {
                    const otherUser = conv.type === 'DIRECT' 
                      ? conv.member_ids?.find(id => id !== currentUser?.id)
                      : null;
                    const isOnline = otherUser && onlineUsers.has(otherUser);
                    const unreadCount = unreadCounts[conv.id] || 0;
                    const lastMessage = messages[conv.id]?.[messages[conv.id].length - 1];

                    return (
                      <div
                        key={conv.id}
                        className="messaging-conversation-item"
                        onClick={() => handleOpenConversation(conv)}
                      >
                        <div className="messaging-conv-avatar-wrapper">
                          <div className={`messaging-conv-avatar ${isOnline ? 'online' : ''}`}>
                            {conv.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        </div>
                        <div className="messaging-conv-content">
                          <div className="messaging-conv-header">
                            <span className="messaging-conv-name">{conv.name}</span>
                            <span className="messaging-conv-time">
                              {formatTime(lastMessage?.created_at || conv.updated_at)}
                            </span>
                          </div>
                          <div className="messaging-conv-footer">
                            <p className="messaging-conv-message">
                              {lastMessage?.content || 'No messages yet'}
                            </p>
                            {unreadCount > 0 && (
                              <span className="messaging-conv-unread">{unreadCount}</span>
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
                        className="messaging-conversation-item"
                        onClick={() => handleStartNewChat(user)}
                      >
                        <div className="messaging-conv-avatar-wrapper">
                          <div className={`messaging-conv-avatar ${isOnline ? 'online' : ''}`}>
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        </div>
                        <div className="messaging-conv-content">
                          <div className="messaging-conv-header">
                            <span className="messaging-conv-name">{user.name}</span>
                          </div>
                          <div className="messaging-conv-footer">
                            <p className="messaging-conv-message" style={{ color: '#999' }}>
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
              <button className="messaging-icon-btn">
                <MoreHorizontal size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="messaging-chat-messages">
              {conversationMessages.map((message, index) => {
                const isSent = message.sender_id === currentUser?.id;
                const sender = selectedConversation.members?.find(m => m.user_id === message.sender_id);

                return (
                  <div key={message.id} className={`messaging-message ${isSent ? 'sent' : 'received'}`}>
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
                                  src={message.file_url}
                                  alt={message.file_name}
                                  className="messaging-message-thumbnail"
                                  onClick={() => setImageModal({ url: message.file_url, name: message.file_name })}
                                  title="Click to view full size"
                                />
                                <button
                                  className="messaging-file-download-btn"
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
                              <div className="messaging-file-media">
                                <video src={message.file_url} controls />
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
                                  title="Download video"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : message.message_type === 'AUDIO' ? (
                              <div className="messaging-file-media">
                                <audio src={message.file_url} controls />
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
                                  title="Download audio"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="messaging-file-document">
                                <a
                                  href={message.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Paperclip size={14} />
                                  {message.file_name}
                                </a>
                                <button
                                  className="messaging-file-download-btn"
                                  onClick={() => handleDownload(message.file_url, message.file_name)}
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
                          {isSent && (
                            <span className="messaging-message-status">
                              {message.is_read ? <CheckCheck size={14} /> : <Check size={14} />}
                            </span>
                          )}
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
                disabled={!messageInput.trim()}
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
