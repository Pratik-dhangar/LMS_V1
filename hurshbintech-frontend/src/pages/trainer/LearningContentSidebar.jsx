import React, { useState, useRef } from 'react';
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
  const [touchDragActive, setTouchDragActive] = useState(false);
  const ghostElementRef = useRef(null);
  const touchStartTimeRef = useRef(null);

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
                  <div className="relative w-full h-12 bg-gray-100 rounded-md overflow-hidden mb-1">
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
                    <div className="hidden absolute inset-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-xl">
                      {getContentIcon(content.content_type)}
                    </div>
                  </div>
                );
              }
              return (
                <div className="w-full h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center mb-1 text-xl">
                  {getContentIcon(content.content_type)}
                </div>
              );
            };

            return (
              <div
                key={content.id}
                className="border-2 border-dashed border-blue-500 bg-white rounded-md p-1 my-1 cursor-grab shadow-sm hover:shadow-md transition-shadow"
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
                  touchStartTimeRef.current = Date.now();
                  target.dataset.touchContent = JSON.stringify(content);
                  target.dataset.touchStartX = touch.clientX;
                  target.dataset.touchStartY = touch.clientY;
                  target.dataset.isDragging = 'false';

                  // Long-press indication (lighter opacity)
                  target.style.transition = 'opacity 0.2s';
                  target.style.opacity = '0.85';
                }}
                onTouchMove={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.touchContent) return;

                  const touch = e.touches[0];
                  const deltaX = Math.abs(touch.clientX - parseFloat(target.dataset.touchStartX));
                  const deltaY = Math.abs(touch.clientY - parseFloat(target.dataset.touchStartY));

                  // If moved more than 15px, activate drag mode
                  if ((deltaX > 15 || deltaY > 15) && target.dataset.isDragging === 'false') {
                    target.dataset.isDragging = 'true';
                    target.style.opacity = '0.3';
                    setTouchDragActive(true);

                    // Create ghost element
                    if (!ghostElementRef.current) {
                      const ghost = target.cloneNode(true);
                      ghost.id = 'touch-drag-ghost';
                      ghost.style.position = 'fixed';
                      ghost.style.pointerEvents = 'none';
                      ghost.style.zIndex = '10000';
                      ghost.style.opacity = '0.7';
                      ghost.style.transform = 'scale(0.9)';
                      ghost.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
                      ghost.style.width = target.offsetWidth + 'px';
                      ghost.style.left = touch.clientX - (target.offsetWidth / 2) + 'px';
                      ghost.style.top = touch.clientY - 40 + 'px';
                      document.body.appendChild(ghost);
                      ghostElementRef.current = ghost;
                    }
                  }

                  // Move ghost element
                  if (target.dataset.isDragging === 'true' && ghostElementRef.current) {
                    // Note: Cannot preventDefault in React touch events (passive listeners)
                    // The drag will work, scrolling is minimized by the drag detection threshold
                    ghostElementRef.current.style.left = touch.clientX - (target.offsetWidth / 2) + 'px';
                    ghostElementRef.current.style.top = touch.clientY - 40 + 'px';

                    // Highlight drop zone
                    const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
                    const whiteboardCanvas = elementAtPoint?.closest('canvas[data-whiteboard="true"]');
                    if (whiteboardCanvas) {
                      whiteboardCanvas.classList.add('touch-drop-zone-active');
                    } else {
                      document.querySelectorAll('.touch-drop-zone-active').forEach(el => {
                        el.classList.remove('touch-drop-zone-active');
                      });
                    }
                  }
                }}
                onTouchEnd={(e) => {
                  const target = e.currentTarget;
                  target.style.opacity = '1';
                  target.style.transition = '';

                  // Clean up ghost element
                  if (ghostElementRef.current) {
                    ghostElementRef.current.remove();
                    ghostElementRef.current = null;
                  }

                  // Remove drop zone highlights
                  document.querySelectorAll('.touch-drop-zone-active').forEach(el => {
                    el.classList.remove('touch-drop-zone-active');
                  });

                  setTouchDragActive(false);

                  if (!target.dataset.touchContent || target.dataset.isDragging === 'false') {
                    // Cleanup and return (was just a tap)
                    delete target.dataset.touchContent;
                    delete target.dataset.touchStartX;
                    delete target.dataset.touchStartY;
                    delete target.dataset.isDragging;
                    return;
                  }

                  const content = JSON.parse(target.dataset.touchContent);
                  const touch = e.changedTouches[0];

                  // Find element at touch position
                  const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
                  const whiteboardCanvas = elementAtPoint?.closest('canvas[data-whiteboard="true"]');

                  if (whiteboardCanvas) {
                    // Trigger content drop on whiteboard
                    const rect = whiteboardCanvas.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;

                    const dropEvent = new CustomEvent('touchDrop', {
                      detail: { content, x, y }
                    });
                    whiteboardCanvas.dispatchEvent(dropEvent);
                  }

                  // Cleanup
                  delete target.dataset.touchContent;
                  delete target.dataset.touchStartX;
                  delete target.dataset.touchStartY;
                  delete target.dataset.isDragging;
                }}
              >
                {renderThumbnail()}

                <div className="text-[9px] font-semibold text-slate-800 mb-0.5 leading-tight">
                  {content.title}
                </div>
                <div className="text-[8px] text-gray-500 flex items-center gap-0.5 leading-tight">
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
