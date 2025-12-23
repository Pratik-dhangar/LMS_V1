import React, { useState } from 'react';
import learningContentService from '../../api/services/learningContentService';
import '../../styles/Pages.css';

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
      className={`sidebar-container ${isDragOver ? 'sidebar-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sidebar-search-box">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="🔍 Search All Content in Database..."
          value={learningContentSearch}
          onChange={handleLearningContentSearch}
        />
        {isSearching && (
          <div className="sidebar-search-spinner">⟳</div>
        )}
      </div>

      <div className="sidebar-section-title">
        {learningContentSearch ? '🔍 Search Results' : '📋 Assigned IIP Content'}
      </div>

      <div className="sidebar-content-list">
        {isSearching ? (
          <div className="sidebar-loading">
            <div className="sidebar-loading-spinner">⟳</div>
            <div className="sidebar-loading-text">Searching database...</div>
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
                onDragStart={(e) => {
                  onDragStartContent(e, content);
                  // Add visual feedback
                  e.currentTarget.style.opacity = '0.5';
                }}
                onDragEnd={(e) => {
                  // Restore opacity after drag
                  e.currentTarget.style.opacity = '1';
                }}
                onTouchStart={(e) => {
                  // Store content data for touch drag
                  const touch = e.touches[0];
                  const target = e.currentTarget;
                  target.dataset.touchContent = JSON.stringify(content);
                  target.dataset.touchStartX = touch.clientX;
                  target.dataset.touchStartY = touch.clientY;
                  target.style.opacity = '0.7';
                }}
                onTouchMove={(e) => {
                  // Visual feedback during drag
                  const target = e.currentTarget;
                  if (target.dataset.touchContent) {
                    const touch = e.touches[0];
                    const deltaX = Math.abs(touch.clientX - parseFloat(target.dataset.touchStartX));
                    const deltaY = Math.abs(touch.clientY - parseFloat(target.dataset.touchStartY));

                    // If moved more than 10px, consider it a drag
                    if (deltaX > 10 || deltaY > 10) {
                      target.style.opacity = '0.5';
                    }
                  }
                }}
                onTouchEnd={(e) => {
                  const target = e.currentTarget;
                  // Always restore opacity
                  target.style.opacity = '1';

                  if (!target.dataset.touchContent) return;

                  const content = JSON.parse(target.dataset.touchContent);
                  const touch = e.changedTouches[0];

                  // Find element at touch position (the whiteboard canvas)
                  const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

                  // Check if dropped on whiteboard canvas
                  const whiteboardCanvas = elementAtPoint?.closest('canvas[data-whiteboard="true"]');

                  if (whiteboardCanvas) {
                    // Trigger content drop on whiteboard
                    const rect = whiteboardCanvas.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;

                    // Dispatch custom event for whiteboard to handle
                    const dropEvent = new CustomEvent('touchDrop', {
                      detail: {
                        content,
                        x,
                        y
                      }
                    });
                    whiteboardCanvas.dispatchEvent(dropEvent);
                  }

                  // Cleanup
                  delete target.dataset.touchContent;
                  delete target.dataset.touchStartX;
                  delete target.dataset.touchStartY;
                }}
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
