import React from 'react';

/**
 * FormSection Component
 * 
 * Wrapper component for form sections with consistent styling
 * Provides section title and optional description
 * 
 * @param {string} title - The section title
 * @param {string} description - Optional section description
 * @param {ReactNode} children - Section content
 */
const FormSection = ({ title, description, children }) => (
  <div className="modern-form-section">
    <h2 className="modern-form-section-title">{title}</h2>
    {description && (
      <p className="modern-form-section-description">{description}</p>
    )}
    <div className="modern-form-grid">
      {children}
    </div>
  </div>
);

export default FormSection;
