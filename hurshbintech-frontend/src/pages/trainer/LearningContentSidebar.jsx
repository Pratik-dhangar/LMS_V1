import React, { useState } from 'react';
import learningContentService from '../../api/services/learningContentService';

const LearningContentSidebar = ({
  learningContentSearch,
  handleLearningContentSearch,
  filteredLearningContent,
  isSearching = false,
  onDragStartContent,
  // onContentCreated
  onRemoveFromWhiteboard = () => { }
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [_isProcessing, setIsProcessing] = useState(false);
  const [_statusMessage, setStatusMessage] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      let dragPayload = null;
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          dragPayload = JSON.parse(jsonData);
        }
      } catch (error) {
        console.error('[LearningContentSidebar] Error parsing dropped data:', error);
        setStatusMessage({ type: 'error', text: 'Invalid drop data format' });
        return;
      }

      // Validate drop payload - must be from whiteboard
      if (!dragPayload || dragPayload.action !== 'remove-from-whiteboard') {
        console.log('[LearningContentSidebar] Ignoring drop - not a whiteboard item');
        return;
      }

      setIsProcessing(true);
      console.log('[LearningContentSidebar] Processing dropped whiteboard item:', dragPayload);

      // Simple flow: just mark as returned to learning content
      // The item is already in learning content, we're just removing it from whiteboard
      setStatusMessage({
        type: 'success',
        text: `✅ "${dragPayload.title}" returned to Learning Content`
      });

      // Remove item from whiteboard by calling the callback
      onRemoveFromWhiteboard(dragPayload.whiteboardItemId);

    } catch (error) {
      console.error('[LearningContentSidebar] Drop handling error:', error);
      setStatusMessage({
        type: 'error',
        text: `Failed to return item: ${error.message || 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
      // Auto-clear status message after 5 seconds
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };
  return (
    <div
      className={`bg-gray-50 border-2 border-gray-300 p-2 sm:p-4 rounded h-fit 130vh overflow-y-auto session-sidebar transition-colors ${isDragOver ? 'bg-blue-50 border-blue-400' : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="bg-green-600 text-white font-semibold p-1.5 sm:p-2 -mx-2 sm:-mx-4 -mt-2 sm:-mt-4 mb-2 sm:mb-4 rounded-t text-sm sm:text-base">📚 Learning Content</div>

      {/* Status Message Display */}
      {/* {statusMessage && (
        <div
          className={`mb-3 p-3 rounded text-sm font-medium ${statusMessage.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
            }`}
        >
          {statusMessage.text}
          {isProcessing && <span className="ml-2 animate-spin">⟳</span>}
        </div>
      )}

      {/* Drag Over Indicator */}
      {/*{isDragOver && (
        <div className="mb-3 p-3 bg-blue-100 border-2 border-dashed border-blue-400 rounded text-center text-blue-700 font-medium text-sm">
          Drop whiteboard image here to import
        </div>
      )} */}

      <div className="bg-white border-2 border-blue-500 p-2 sm:p-3 rounded mb-3 sm:mb-4 flex items-center">
        <input
          type="text"
          className="flex-1 bg-gray-100 px-2 py-1.5 sm:py-2 rounded text-xs border-none outline-none"
          placeholder="🔍 Search All Content in Database..."
          value={learningContentSearch}
          onChange={handleLearningContentSearch}
        />
        {isSearching && (
          <div className="ml-2 animate-spin text-blue-500">⟳</div>
        )}
      </div>

      <div className="text-[10px] sm:text-xs font-semibold mb-2">
        {learningContentSearch ? '🔍 Search Results' : '📋 Assigned IIP Content'}
      </div>

      <div className="max-h-[400px] sm:max-h-[460px] overflow-y-auto">
        {isSearching ? (
          <div className="text-center p-8 text-gray-500">
            <div className="animate-spin text-3xl mb-2">⟳</div>
            <div className="text-xs">Searching database...</div>
          </div>
        ) : filteredLearningContent.length > 0 ? (
          filteredLearningContent.map((content) => {
            // Get proper icon for content type
            const getContentIcon = (type) => {
              switch (type?.toLowerCase()) {
                case 'image': return '🖼️';
                case 'video': return '🎥';
                case 'audio': return '🎵';
                case 'activity': return '🎮';
                case 'pdf': return '📄';
                case 'document': return '📝';
                default: return '📦';
              }
            };

            const renderThumbnail = () => {
              if (content.content_type === 'image' || content.thumbnail_url) {
                const imageUrl = learningContentService.getFileUrl(
                  content.content_type === 'image' ? content.file_url : content.thumbnail_url
                );
                return (
                  <div className="relative w-full h-16 sm:h-20 bg-gray-100 rounded-md overflow-hidden mb-1.5 sm:mb-2">
                    <img
                      src={imageUrl}
                      alt={content.title}
                      className="w-full h-full object-cover block"
                      onError={(e) => {
                        console.error('[TrainerSession] Failed to load image:', imageUrl);
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = 'flex';
                        }
                      }}
                    // onLoad={() => {
                    //   console.log('[TrainerSession] Image loaded successfully:', imageUrl);
                    // }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl sm:text-3xl">
                      {getContentIcon(content.content_type)}
                    </div>
                  </div>
                );
              }
              return (
                <div className="w-full h-16 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center mb-1.5 sm:mb-2 text-2xl sm:text-3xl">
                  {getContentIcon(content.content_type)}
                </div>
              );
            };

            return (
              <div
                key={content.id}
                className="border-2 border-dashed border-blue-500 bg-white rounded-md p-1.5 sm:p-2 my-1.5 sm:my-2 cursor-grab shadow-sm hover:shadow-md transition-shadow"
                draggable
                onDragStart={(e) => onDragStartContent(e, content)}
              >
                {renderThumbnail()}

                <div className="text-[10px] sm:text-xs font-semibold text-slate-800 mb-1">
                  {content.title}
                </div>
                <div className="text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1">
                  <span>{getContentIcon(content.content_type)}</span>
                  <span className="uppercase">
                    {content.content_type || 'file'}
                  </span>
                  {content.category && (
                    <>
                      <span>•</span>
                      <span>{content.category}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-[10px] sm:text-xs text-gray-500 italic p-3 sm:p-4 text-center">
            {learningContentSearch ? (
              <>No content matches "{learningContentSearch}". Try a different search term.</>
            ) : (
              <>No assigned content for this session.</>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningContentSidebar;
