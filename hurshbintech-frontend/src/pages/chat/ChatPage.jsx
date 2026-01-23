/**
 * Chat Page - Conversations List
 * WhatsApp-like home page showing all conversations
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, UserPlus, Users, MessageSquarePlus } from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import { useAuth } from '../../context/AuthContext';

const ChatPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations,
    onlineUsers,
    unreadCounts,
    allUsers,
    loading,
    loadConversations,
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

    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) { // Less than 7 days
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
      const conversation = await createConversation('DIRECT', [otherUser.id]);
      setShowNewChatModal(false);
      handleConversationClick(conversation);
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

  // Filter users (exclude current user and existing conversations)
  const availableUsers = allUsers.filter(u => u.id !== user?.id);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-blue-700 rounded-full transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold">Chats</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            
            {/* New Chat Button */}
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 hover:bg-blue-700 rounded-full transition"
              title="New Chat"
            >
              <MessageSquarePlus size={24} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full bg-blue-700 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Empty State Message */}
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <MessageSquarePlus size={64} className="mb-4 opacity-30" />
              <p className="text-lg">No conversations yet</p>
              <p className="text-sm">Select a user below or click the + button to start messaging</p>
            </div>

            {/* Available Users List */}
            <div className="px-4 pb-4">
              <h3 className="font-semibold text-gray-700 mb-3">Available Users</h3>
              <div className="space-y-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No other users available</p>
                ) : (
                  availableUsers.map(availUser => (
                    <div
                      key={availUser.id}
                      onClick={() => handleNewDirectChat(availUser)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                          {availUser.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {onlineUsers.has(availUser.id) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{availUser.name}</p>
                        <p className="text-xs text-gray-500">{availUser.role}</p>
                      </div>

                      {/* Online Status */}
                      {onlineUsers.has(availUser.id) && (
                        <span className="text-xs text-green-600 font-medium">●</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
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
                  className="flex items-center gap-3 p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {conversation.type === 'GROUP' ? (
                        <Users size={24} />
                      ) : (
                        conversation.name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    {/* Online Indicator for Direct Chats */}
                    {conversation.type === 'DIRECT' && conversation.member_ids?.some(id => id !== user?.id && onlineUsers.has(id)) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(conversation.updated_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600 truncate">
                        {lastMessage?.content || lastMessage?.file_name || 'No messages yet'}
                      </p>
                      
                      {/* Unread Badge */}
                      {unreadCount > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-1 min-w-[20px] text-center">
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
              <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-3">Start a New Chat</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableUsers.map(availUser => (
                    <div
                      key={availUser.id}
                      onClick={() => handleNewDirectChat(availUser)}
                      className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition"
                    >
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                          {availUser.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        {onlineUsers.has(availUser.id) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{availUser.name}</p>
                        <p className="text-xs text-gray-500">{availUser.role}</p>
                      </div>

                      {/* Online Status */}
                      {onlineUsers.has(availUser.id) && (
                        <span className="text-xs text-green-600 font-medium">●</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {isCreatingGroup ? 'Create Group' : 'New Chat'}
                </h2>
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setIsCreatingGroup(false);
                    setSelectedUsers([]);
                    setGroupName('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Group Creation Toggle */}
              {canCreateGroups && !isCreatingGroup && (
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="mt-2 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <Users size={16} />
                  Create Group Chat
                </button>
              )}

              {/* Group Name Input */}
              {isCreatingGroup && (
                <input
                  type="text"
                  placeholder="Group Name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-4">
              {availableUsers.map(availUser => (
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
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer transition"
                >
                  {/* Checkbox for Group */}
                  {isCreatingGroup && (
                    <input
                      type="checkbox"
                      checked={selectedUsers.find(u => u.id === availUser.id) !== undefined}
                      onChange={() => {}}
                      className="w-5 h-5"
                    />
                  )}

                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-bold">
                      {availUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {onlineUsers.has(availUser.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{availUser.name}</p>
                    <p className="text-sm text-gray-500">{availUser.role}</p>
                  </div>

                  {/* Online Status */}
                  {onlineUsers.has(availUser.id) && (
                    <span className="text-xs text-green-600 font-medium">Online</span>
                  )}
                </div>
              ))}
            </div>

            {/* Group Create Button */}
            {isCreatingGroup && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleCreateGroup}
                  disabled={selectedUsers.length < 2 || !groupName.trim()}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
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
