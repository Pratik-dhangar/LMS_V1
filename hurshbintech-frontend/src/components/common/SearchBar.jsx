// SearchBar.jsx - Reusable search bar component with consistent styling

import React, { useState } from 'react';
import { Search } from 'lucide-react';

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
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1 max-w-md">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-4 py-3 pl-12 pr-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
      <button
        onClick={handleSearch}
        className="bg-[#3498db] hover:bg-[#2980b9] text-white px-6 py-3 rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
      >
        Search
      </button>
    </div>
  );
};

export default SearchBar;
