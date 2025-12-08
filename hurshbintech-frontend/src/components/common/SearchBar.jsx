// SearchBar.jsx - Reusable search bar component with consistent styling

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import '../../styles/components/common/SearchBar.css';

/**
 * Reusable SearchBar Component
 * @param {Function} onSearch - Callback function when search button is clicked
 * @param {string} placeholder - Placeholder text for the input
 * @param {string} className - Additional classes for the container
 */
const SearchBar = ({ onSearch, placeholder = "Search...", className = "" }) => {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onSearch) {
      onSearch('');
    }
  };

  return (
    <div className={`search-bar-container ${className}`}>
      <div className="search-bar-input-wrapper">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="search-bar-input"
        />
        <Search className="search-bar-icon" />
        {query && (
          <button
            onClick={handleClear}
            className="search-bar-clear"
          >
            ✕
          </button>
        )}
      </div>
      <button
        onClick={handleSearch}
        className="search-bar-button"
      >
        Search
      </button>
    </div>
  );
};

export default SearchBar;
