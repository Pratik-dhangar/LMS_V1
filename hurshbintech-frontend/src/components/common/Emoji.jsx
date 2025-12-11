import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import twemoji from 'twemoji';

/**
 * Emoji Component
 * 
 * Renders emojis using Twemoji for consistent cross-browser/cross-device display.
 * Automatically converts native emoji characters to Twitter's emoji images.
 * 
 * @param {string} emoji - The emoji character(s) or text containing emoji
 * @param {string} className - Optional CSS classes for styling
 * @param {object} style - Optional inline styles
 * @param {string} size - Size preset: 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', or custom size
 */
const Emoji = ({ emoji, className = '', style = {}, size = 'base' }) => {
  const emojiRef = useRef(null);

  // Size mapping to actual dimensions
  const sizeMap = {
    'xs': '12px',
    'sm': '14px',
    'base': '16px',
    'lg': '20px',
    'xl': '24px',
    '2xl': '32px',
    '3xl': '48px'
  };

  // Determine the actual size value
  const actualSize = sizeMap[size] || size;

  useEffect(() => {
    if (emojiRef.current) {
      // Parse the emoji and replace with Twemoji images
      twemoji.parse(emojiRef.current, {
        folder: 'svg',
        ext: '.svg',
        base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
      });

      // Apply size to all emoji images
      const images = emojiRef.current.querySelectorAll('img.emoji');
      images.forEach(img => {
        img.style.width = actualSize;
        img.style.height = actualSize;
        img.style.verticalAlign = 'middle';
        img.style.display = 'inline-block';
      });
    }
  }, [emoji, actualSize]);

  return (
    <span
      ref={emojiRef}
      className={`emoji-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        ...style
      }}
    >
      {emoji}
    </span>
  );
};

Emoji.propTypes = {
  emoji: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  size: PropTypes.string
};

export default Emoji;
