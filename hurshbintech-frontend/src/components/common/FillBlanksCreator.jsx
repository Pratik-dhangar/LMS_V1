import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { exerciseTemplates } from '../../utils/fillInBlanksTemplates';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        fontFamily: "'Segoe UI', 'Roboto', sans-serif"
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          color: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
            📝 Create Fill in the Blanks Exercise
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
            For: <strong>{learnerName}</strong>
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Template/Custom Toggle */}
          <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setUseCustom(false)}
              style={{
                flex: 1,
                padding: '12px',
                border: useCustom ? '2px solid #e5e7eb' : '2px solid #667eea',
                backgroundColor: useCustom ? 'white' : '#f3f4f6',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📚 Use Template
            </button>
            <button
              onClick={() => setUseCustom(true)}
              style={{
                flex: 1,
                padding: '12px',
                border: useCustom ? '2px solid #667eea' : '2px solid #e5e7eb',
                backgroundColor: useCustom ? '#f3f4f6' : 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ✏️ Create Custom
            </button>
          </div>

          {/* Template Selection */}
          {!useCustom && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Choose a Template:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {templates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    style={{
                      padding: '16px',
                      border: selectedTemplate === template.id ? '2px solid #667eea' : '2px solid #e5e7eb',
                      backgroundColor: selectedTemplate === template.id ? '#eef2ff' : 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                      {template.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {template.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Exercise Form */}
          {useCustom && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Title:
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Grammar Exercise"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Instructions:
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Fill in the missing words"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Options (comma-separated, for drag & drop):
                </label>
                <input
                  type="text"
                  value={customOptions}
                  onChange={(e) => setCustomOptions(e.target.value)}
                  placeholder="e.g., apple, banana, orange"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Questions:
                </label>
                {customBlanks.map((blank, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={blank.textBefore}
                      onChange={(e) => handleBlankChange(index, 'textBefore', e.target.value)}
                      placeholder="Text before blank"
                      style={{ flex: 1, padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      value={blank.correctAnswer}
                      onChange={(e) => handleBlankChange(index, 'correctAnswer', e.target.value)}
                      placeholder="Answer"
                      style={{ width: '120px', padding: '8px', border: '2px solid #10b981', borderRadius: '6px', fontSize: '13px', fontWeight: '600' }}
                    />
                    <input
                      type="text"
                      value={blank.textAfter}
                      onChange={(e) => handleBlankChange(index, 'textAfter', e.target.value)}
                      placeholder="Text after"
                      style={{ flex: 1, padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }}
                    />
                    {customBlanks.length > 1 && (
                      <button
                        onClick={() => handleRemoveBlank(index)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddBlank}
                  style={{
                    marginTop: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}
                >
                  + Add Question
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            }}
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
