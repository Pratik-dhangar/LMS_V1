# Modal CSS Migration Guide

## Overview
All modal styles have been consolidated into a single reusable CSS file:
`src/styles/components/common/Modal.css`

## What Changed

### Before (Multiple files with duplicate styles):
- `head/SessionModals.css` - `.modal-overlay`, `.modal-container`, etc.
- `trainer/CreateSessionModal.css` - `.modal-overlay`, `.modal-container`, etc.
- `admin/AdminModal.css` - `.admin-modal-overlay`, `.admin-modal-content`, etc.
- `LearnerProgramAssignmentDetails.css` - `.modal-overlay`
- `ManageProgramAssignments.css` - `.mpa-modal-overlay`
- `trainer/Schedule.css` - `.trainer-modal-overlay`

### After (Single source of truth):
- `components/common/Modal.css` - Contains all modal styles with `.app-modal-*` prefix

## Class Name Mapping

### Old → New Class Names

| Old Class | New Class |
|-----------|-----------|
| `.modal-overlay` | `.app-modal-overlay` |
| `.modal-container` | `.app-modal-container` |
| `.modal-header` | `.app-modal-header` |
| `.modal-title` | `.app-modal-title` |
| `.modal-subtitle` | `.app-modal-subtitle` |
| `.modal-close-button` | `.app-modal-close` |
| `.modal-content` | `.app-modal-content` |
| `.modal-actions` | `.app-modal-footer` |
| `.btn-primary` | `.app-modal-btn app-modal-btn--primary` |
| `.btn-secondary` | `.app-modal-btn app-modal-btn--secondary` |
| `.btn-danger` | `.app-modal-btn app-modal-btn--danger` |
| `.form-field` | `.app-modal-form-field` |
| `.form-label` | `.app-modal-form-label` |
| `.form-input` | `.app-modal-form-input` |
| `.form-textarea` | `.app-modal-form-textarea` |
| `.form-select` | `.app-modal-form-select` |
| `.form-grid form-grid-2` | `.app-modal-form-grid app-modal-form-grid--2` |

## Available Variants

### Container Sizes
- `.app-modal-container--sm` - 500px max-width
- `.app-modal-container--md` - 768px max-width (default)
- `.app-modal-container--lg` - 1024px max-width
- `.app-modal-container--xl` - 1280px max-width
- `.app-modal-container--full` - 95vw max-width

### Header Themes
- `.app-modal-header--primary` - Gold gradient (#db9d32)
- `.app-modal-header--blue` - Blue gradient
- `.app-modal-header--green` - Green gradient
- `.app-modal-header--red` - Red gradient
- `.app-modal-header--purple` - Purple gradient
- `.app-modal-header--gray` - Gray gradient

### Button Variants
- `.app-modal-btn--primary` - Gold button
- `.app-modal-btn--secondary` - Gray button
- `.app-modal-btn--danger` - Red button
- `.app-modal-btn--success` - Green button

## Migration Steps

### Step 1: Update CSS Imports

**Before:**
```javascript
import '../../styles/head/SessionModals.css';
```

**After:**
```javascript
import '../../styles/components/common/Modal.css';
```

### Step 2: Update JSX Class Names

**Before:**
```jsx
<div className="modal-overlay">
  <div className="modal-container" style={{ maxWidth: '1024px' }}>
    <div className="modal-header">
      <h2 className="modal-title">My Modal</h2>
      <button className="modal-close-button">✕</button>
    </div>
    <div className="modal-content">
      {/* content */}
    </div>
    <div className="modal-actions">
      <button className="btn-primary">Save</button>
      <button className="btn-secondary">Cancel</button>
    </div>
  </div>
</div>
```

**After:**
```jsx
<div className="app-modal-overlay">
  <div className="app-modal-container app-modal-container--lg">
    <div className="app-modal-header app-modal-header--primary">
      <div className="app-modal-header-content">
        <h2 className="app-modal-title">My Modal</h2>
      </div>
      <button className="app-modal-close">✕</button>
    </div>
    <div className="app-modal-content">
      {/* content */}
    </div>
    <div className="app-modal-footer">
      <button className="app-modal-btn app-modal-btn--primary">Save</button>
      <button className="app-modal-btn app-modal-btn--secondary">Cancel</button>
    </div>
  </div>
</div>
```

### Step 3: Update Form Elements

**Before:**
```jsx
<div className="form-field">
  <label className="form-label">Name</label>
  <input className="form-input" />
</div>
```

**After:**
```jsx
<div className="app-modal-form-field">
  <label className="app-modal-form-label">Name</label>
  <input className="app-modal-form-input" />
</div>
```

## Example: Complete Modal Component

```jsx
import React from 'react';
import '../../styles/components/common/Modal.css';

const MyModal = ({ onClose, onSave, data }) => {
  return (
    <div className="app-modal-overlay">
      <div className="app-modal-container app-modal-container--md">
        {/* Header with gold theme */}
        <div className="app-modal-header app-modal-header--primary">
          <div className="app-modal-header-content">
            <h2 className="app-modal-title">Edit Item</h2>
            <p className="app-modal-subtitle">Update item details</p>
          </div>
          <button onClick={onClose} className="app-modal-close">✕</button>
        </div>

        {/* Content */}
        <div className="app-modal-content">
          <div className="app-modal-form-field">
            <label className="app-modal-form-label">
              Title <span className="app-modal-text-required">*</span>
            </label>
            <input 
              type="text" 
              className="app-modal-form-input"
              placeholder="Enter title"
            />
          </div>

          <div className="app-modal-form-field">
            <label className="app-modal-form-label">Description</label>
            <textarea 
              className="app-modal-form-textarea"
              rows="4"
            />
          </div>

          {/* Two-column grid */}
          <div className="app-modal-form-grid app-modal-form-grid--2">
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">Category</label>
              <select className="app-modal-form-select">
                <option>Select...</option>
              </select>
            </div>
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">Status</label>
              <select className="app-modal-form-select">
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="app-modal-footer">
          <button 
            onClick={onClose} 
            className="app-modal-btn app-modal-btn--secondary"
          >
            Cancel
          </button>
          <button 
            onClick={onSave} 
            className="app-modal-btn app-modal-btn--primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyModal;
```

## Files to Migrate

### Priority 1 (Already using modal-overlay):
- [x] `head/EditSessionModal.jsx`
- [x] `head/ViewSessionModal.jsx`
- [x] `head/HeadSessionNotesModal.jsx`
- [ ] Files importing `trainer/CreateSessionModal.css`
- [ ] Files with `.admin-modal-overlay`
- [ ] Files with `.mpa-modal-overlay`
- [ ] Files with `.trainer-modal-overlay`

### Priority 2 (Other modals):
- [ ] `LearnerProgramAssignmentDetails.jsx` components
- [ ] `ManageProgramAssignments.jsx` components
- [ ] Vlog modals
- [ ] Confirm modal components

## Benefits After Migration

✅ **Consistency**: All modals look and behave the same
✅ **Maintainability**: Update styles in one place
✅ **Smaller Bundle**: No CSS duplication
✅ **Responsive**: Mobile-optimized by default
✅ **Themeable**: Easy to add new color themes
✅ **Type-safe**: Consistent class naming pattern

## Need Help?

Check the comprehensive Modal.css file for all available classes and utilities:
`src/styles/components/common/Modal.css`
