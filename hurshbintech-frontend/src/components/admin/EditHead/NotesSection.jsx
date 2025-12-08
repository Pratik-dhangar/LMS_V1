// NotesSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import '../../../styles/components/admin/EditHeadSections.css';

/**
 * @param {object} formData
 * @param {function} handleChange
 */

const NotesSection = ({ formData, handleChange }) => (
  <section className="edit-head-section">
    <h2 className="edit-head-section-title">
      Notes & Messages
    </h2>
    <div className="edit-head-section-grid">
      <TextAreaField
        label="Box of Note"
        name="note_box"
        value={formData.note_box}
        onChange={handleChange}
        rows={4}
        placeholder="Additional notes"
      />

      <TextAreaField
        label="Message Box"
        name="message_box"
        value={formData.message_box}
        onChange={handleChange}
        rows={4}
        placeholder="Messages and communications"
      />
    </div>
  </section>
);

export default NotesSection;
