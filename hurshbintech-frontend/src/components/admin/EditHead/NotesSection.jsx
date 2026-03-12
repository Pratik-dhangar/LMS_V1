// NotesSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import FormSection from '../../common/FormSection';

/**
 * @param {object} formData
 * @param {function} handleChange
 */

const NotesSection = ({ formData, handleChange }) => (
  <FormSection
    title="Notes"
    description="Additional notes"
  >
    <div className="modern-form-grid-full">
      <TextAreaField
        label="Note"
        name="note_box"
        value={formData.note_box}
        onChange={handleChange}
        rows={4}
        placeholder="Additional notes"
      />
    </div>
  </FormSection>
);

export default NotesSection;
