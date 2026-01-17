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
    title="Notes & Messages"
    description="Additional notes and communications"
  >
    <div className="modern-form-grid-full">
      <TextAreaField
        label="Box of Note"
        name="note_box"
        value={formData.note_box}
        onChange={handleChange}
        rows={4}
        placeholder="Additional notes"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Message Box"
        name="message_box"
        value={formData.message_box}
        onChange={handleChange}
        rows={4}
        placeholder="Messages and communications"
      />
    </div>
  </FormSection>
);

export default NotesSection;
