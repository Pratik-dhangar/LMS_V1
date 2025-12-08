import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { exerciseTemplates } from '../../utils/fillInBlanksTemplates';
import '../../styles/components/common/FillBlanksCreator.css';

/**
 * FillBlanksCreator Modal
 * Allows trainer to create/customize fill-in-the-blank exercises
 * Shows live preview and sends to specific learner
 */
const FillBlanksCreator = ({
  isOpen,
  onClose,
  onSend,
  learnerName = 'Learner'
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('prepositions');
  const [customTitle, setCustomTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customOptions, setCustomOptions] = useState('');
  const [customBlanks, setCustomBlanks] = useState([{ textBefore: '', textAfter: '', correctAnswer: '' }]);
  const [useCustom, setUseCustom] = useState(false);

  const templates = [
    { id: 'prepositions', name: '📍 Prepositions', description: 'in, on, under, next to' },
    { id: 'whereIsTeddy', name: '🧸 Where is Teddy?', description: 'Position words' },
    { id: 'verbTenses', name: '⏰ Past Tense Verbs', description: 'went, played, baked' },
    { id: 'articles', name: '📝 Articles', description: 'a, an, the' },
    { id: 'animalSounds', name: '🐾 Animal Sounds', description: 'meow, woof, moo' },
    { id: 'numbers', name: '🔢 Numbers', description: 'Counting sequence' },
    { id: 'colors', name: '🎨 Colors', description: 'red, blue, green' }
  ];

  const handleAddBlank = () => {
    setCustomBlanks([...customBlanks, { textBefore: '', textAfter: '', correctAnswer: '' }]);
  };

  const handleRemoveBlank = (index) => {
    setCustomBlanks(customBlanks.filter((_, i) => i !== index));
  };

  const handleBlankChange = (index, field, value) => {
    const updated = [...customBlanks];
    updated[index][field] = value;
    setCustomBlanks(updated);
  };

  const handleSend = () => {
    let exercise;

    if (useCustom) {
      // Create custom exercise
      exercise = exerciseTemplates.custom({
        title: customTitle || 'Custom Exercise',
        instructions: customInstructions || 'Fill in the blanks',
        options: customOptions ? customOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
        blanks: customBlanks.filter(b => b.correctAnswer.trim() !== '')
      });
    } else {
      // Use selected template
      exercise = exerciseTemplates[selectedTemplate]();
    }

    onSend(exercise);
    handleClose();
  };

  const handleClose = () => {
    setUseCustom(false);
    setCustomTitle('');
    setCustomInstructions('');
    setCustomOptions('');
    setCustomBlanks([{ textBefore: '', textAfter: '', correctAnswer: '' }]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fill-blanks-creator-overlay">
      <div className="fill-blanks-creator-modal">
        {/* Header */}
        <div className="fill-blanks-creator-header">
          <h2>
            📝 Create Fill in the Blanks Exercise
          </h2>
          <p>
            For: <strong>{learnerName}</strong>
          </p>
        </div>

        {/* Content */}
        <div className="fill-blanks-creator-content">
          {/* Template/Custom Toggle */}
          <div className="fill-blanks-creator-toggle">
            <button
              onClick={() => setUseCustom(false)}
              className={useCustom ? 'inactive' : 'active'}
            >
              📚 Use Template
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={useCustom ? 'active' : 'inactive'}
            >
              ✏️ Create Custom
            </button>
          </div>

          {/* Template Selection */}
          {!useCustom && (
            <div className="fill-blanks-creator-template-section">
              <label className="fill-blanks-creator-template-label">
                Choose a Template:
              </label>
              <div className="fill-blanks-creator-template-grid">
                {templates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`fill-blanks-creator-template-card ${selectedTemplate === template.id ? 'selected' : 'unselected'}`}
                  >
                    <div className="fill-blanks-creator-template-card-name">
                      {template.name}
                    </div>
                    <div className="fill-blanks-creator-template-card-desc">
                      {template.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Exercise Form */}
          {useCustom && (
            <div className="fill-blanks-creator-custom-section">
              <div className="fill-blanks-creator-form-group">
                <label className="fill-blanks-creator-form-label">
                  Title:
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Grammar Exercise"
                  className="fill-blanks-creator-input"
                />
              </div>

              <div className="fill-blanks-creator-form-group">
                <label className="fill-blanks-creator-form-label">
                  Instructions:
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Fill in the missing words"
                  className="fill-blanks-creator-input"
                />
              </div>

              <div className="fill-blanks-creator-form-group">
                <label className="fill-blanks-creator-form-label">
                  Options (comma-separated, for drag & drop):
                </label>
                <input
                  type="text"
                  value={customOptions}
                  onChange={(e) => setCustomOptions(e.target.value)}
                  placeholder="e.g., apple, banana, orange"
                  className="fill-blanks-creator-input"
                />
              </div>

              <div className="fill-blanks-creator-blanks-container">
                <label className="fill-blanks-creator-form-label">
                  Questions:
                </label>
                {customBlanks.map((blank, index) => (
                  <div key={index} className="fill-blanks-creator-blank-row">
                    <input
                      type="text"
                      value={blank.textBefore}
                      onChange={(e) => handleBlankChange(index, 'textBefore', e.target.value)}
                      placeholder="Text before blank"
                      className="fill-blanks-creator-blank-input"
                    />
                    <input
                      type="text"
                      value={blank.correctAnswer}
                      onChange={(e) => handleBlankChange(index, 'correctAnswer', e.target.value)}
                      placeholder="Answer"
                      className="fill-blanks-creator-blank-answer"
                    />
                    <input
                      type="text"
                      value={blank.textAfter}
                      onChange={(e) => handleBlankChange(index, 'textAfter', e.target.value)}
                      placeholder="Text after"
                      className="fill-blanks-creator-blank-input"
                    />
                    {customBlanks.length > 1 && (
                      <button
                        onClick={() => handleRemoveBlank(index)}
                        className="fill-blanks-creator-remove-btn"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddBlank}
                  className="fill-blanks-creator-add-btn"
                >
                  + Add Question
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fill-blanks-creator-footer">
          <button
            onClick={handleClose}
            className="fill-blanks-creator-cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="fill-blanks-creator-send-btn"
          >
            📤 Send to {learnerName}
          </button>
        </div>
      </div>
    </div>
  );
};

FillBlanksCreator.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  learnerName: PropTypes.string
};

export default FillBlanksCreator;
