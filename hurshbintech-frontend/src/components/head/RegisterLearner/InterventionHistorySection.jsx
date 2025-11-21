import React from 'react';

const InterventionHistorySection = ({ formData, handleChange, handleFileChange, referenceFiles, removeFile }) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
        History of Intervention
      </h2>
      
      {/* Upload References */}
      <div className="mb-6">
        <label htmlFor="intervention_reference_files" className="block text-sm font-medium text-gray-700 mb-2">
          Upload References (Documents, Images, Videos)
        </label>
        <input
          type="file"
          id="intervention_reference_files"
          multiple
          onChange={handleFileChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
        />
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: PDF, DOCX, Images, Videos
        </p>
        
        {referenceFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {referenceFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="ml-3 text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Duration of intervention */}
      <div className="mb-6">
        <label htmlFor="intervention_duration" className="block text-sm font-medium text-gray-700 mb-2">
          Number of months/years of intervention
        </label>
        <input
          type="text"
          id="intervention_duration"
          name="intervention_duration"
          value={formData.intervention_duration}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="e.g., 6 months, 2 years"
        />
      </div>

      {/* Intervention notes */}
      <div>
        <label htmlFor="intervention_notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          id="intervention_notes"
          name="intervention_notes"
          value={formData.intervention_notes}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Enter intervention notes..."
        />
      </div>
    </div>
  );
};

export default InterventionHistorySection;
