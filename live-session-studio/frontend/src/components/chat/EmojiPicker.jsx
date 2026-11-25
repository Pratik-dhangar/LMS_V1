/**
 * Simple Emoji Picker Component
 * Displays common emojis for quick selection on desktop/tablet
 * Note: On mobile, use native emoji keyboard instead
 */

import React, { useEffect, useRef } from 'react';
import '../../styles/chats/EmojiPicker.css';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴'],
  'Gestures': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '🦿', '🦵', '🦶'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  'Objects': ['💻', '⌨️', '🖥️', '🖨️', '🖱️', '💿', '💾', '💽', '📱', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '⏰', '⌛', '⏳', '💡', '🔦', '💸', '💵', '💰', '💳', '🎯', '🏆', '⚽', '🏀', '🎮', '🎲', '🎨', '🎭', '🎪'],
  'Symbols': ['✅', '❌', '❗', '❓', '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '💯', '🎉', '🎊', '🎈', '🎁', '🏅', '🥇', '🥈', '🥉', '👑'],
};

const EmojiPicker = ({ onEmojiSelect, onClose, buttonRef }) => {
  const pickerRef = useRef(null);
  const [activeCategory, setActiveCategory] = React.useState('Smileys');

  // Position picker above the emoji button
  useEffect(() => {
    if (pickerRef.current && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const pickerHeight = pickerRef.current.offsetHeight;
      const pickerWidth = pickerRef.current.offsetWidth;
      
      // Position above the button, aligned to the left
      const top = buttonRect.top - pickerHeight - 10; // 10px gap
      const left = buttonRect.left;
      
      // Adjust if picker goes off screen
      if (top < 0) {
        pickerRef.current.style.top = `${buttonRect.bottom + 10}px`; // Below if no space above
      } else {
        pickerRef.current.style.top = `${top}px`;
      }
      
      // Ensure picker doesn't go off right edge
      const maxLeft = window.innerWidth - pickerWidth - 10;
      pickerRef.current.style.left = `${Math.min(left, maxLeft)}px`;
    }
  }, [buttonRef]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && 
          buttonRef?.current && !buttonRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, buttonRef]);

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
    // Don't close automatically - let users select multiple emojis
  };

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-picker-header">
        <div className="emoji-picker-categories">
          {Object.keys(EMOJI_CATEGORIES).map(category => (
            <button
              key={category}
              className={`emoji-category-btn ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
              title={category}
            >
              {EMOJI_CATEGORIES[category][0]}
            </button>
          ))}
        </div>
      </div>
      <div className="emoji-picker-content">
        {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            className="emoji-btn"
            onClick={() => handleEmojiClick(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
