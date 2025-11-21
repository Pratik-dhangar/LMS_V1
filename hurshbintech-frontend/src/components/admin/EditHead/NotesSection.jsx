// NotesSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';

/**
 * @param {object} formData
 * @param {function} handleChange
 */

const NotesSection = ({ formData, handleChange }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
      Notes & Messages
    </h2>
    <div className="grid grid-cols-1 gap-6">
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
