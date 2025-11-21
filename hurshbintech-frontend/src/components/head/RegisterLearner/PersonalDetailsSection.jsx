import React from 'react';
import ChecklistField from '../../common/ChecklistField';

const PersonalDetailsSection = ({ formData, errors, handleChange, handleFileChange, referenceFiles, removeFile }) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
        Personal Details
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
            placeholder="Enter learner's name"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Age */}
        <div>
          <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
            Age <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age}
            onChange={handleChange}
            className={`w-full px-4 py-2 border ${errors.age ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
            placeholder="Enter age"
            min="0"
          />
          {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
        </div>

        {/* DOB */}
        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth (DOB) <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="dob"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className={`w-full px-4 py-2 border ${errors.dob ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
          />
          {errors.dob && <p className="text-red-500 text-sm mt-1">{errors.dob}</p>}
        </div>

        {/* Date of Assessment */}
        <div>
          <label htmlFor="date_of_assessment" className="block text-sm font-medium text-gray-700 mb-2">
            Date of Assessment <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="date_of_assessment"
            name="date_of_assessment"
            value={formData.date_of_assessment}
            onChange={handleChange}
            className={`w-full px-4 py-2 border ${errors.date_of_assessment ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
          />
          {errors.date_of_assessment && <p className="text-red-500 text-sm mt-1">{errors.date_of_assessment}</p>}
        </div>
      </div>

      {/* Checklist of DLB concerns */}
      <div className="mt-6">
        <ChecklistField
          label="DLB Concerns Checklist"
          name="dlb_concerns_checklist"
          value={formData.dlb_concerns_checklist || []}
          onChange={handleChange}
          error={errors.dlb_concerns_checklist}
          required
        />
      </div>

      {/* Upload References */}
      <div className="mt-6">
        <label htmlFor="personal_reference_files" className="block text-sm font-medium text-gray-700 mb-2">
          Upload References (Documents, Images, Videos)
        </label>
        <input
          type="file"
          id="personal_reference_files"
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

      {/* A box for notes */}
      <div className="mt-6">
        <label htmlFor="personal_notes" className="block text-sm font-medium text-gray-700 mb-2">
         Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          id="personal_notes"
          name="personal_notes"
          value={formData.personal_notes}
          onChange={handleChange}
          rows="4"
          className={`w-full px-4 py-2 border ${errors.personal_notes ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
          placeholder="Enter personal notes..."
        />
        {errors.personal_notes && <p className="text-red-500 text-sm mt-1">{errors.personal_notes}</p>}
      </div>
    </div>
  );
};

export default PersonalDetailsSection;
