import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * FillInTheBlanks Component
 * Interactive component for fill-in-the-blank exercises
 * Supports drag-and-drop options for learners and trainer control
 * Can be used for prepositions, vocabulary, and other learning exercises
 */
const FillInTheBlanks = ({ 
  exercise, 
  isTrainer, 
  onAnswerChange,
  onEdit,
  x,
  y,
  width,
  height,
  isSelected,
  onMouseDown,
  isDraggable,
  allowLearnerInteraction = false
}) => {
  const [answers, setAnswers] = useState({});
  const [draggedOption, setDraggedOption] = useState(null);
  const [usedOptions, setUsedOptions] = useState(new Set());

  // Initialize answers from exercise data
  useEffect(() => {
    if (exercise.answers) {
      setAnswers(exercise.answers);
      // Track which options have been used
      const used = new Set(Object.values(exercise.answers).filter(Boolean));
      setUsedOptions(used);
    }
  }, [exercise.answers]);

  const handleAnswerChange = (blankIndex, value) => {
    const newAnswers = {
      ...answers,
      [blankIndex]: value
    };
    setAnswers(newAnswers);
    
    // Update used options
    const used = new Set(Object.values(newAnswers).filter(Boolean));
    setUsedOptions(used);
    
    // Notify parent component
    if (onAnswerChange) {
      onAnswerChange(exercise.id, newAnswers);
    }
  };

  const handleOptionDragStart = (option) => {
    setDraggedOption(option);
  };

  const handleBlankDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleBlankDrop = (e, blankIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedOption && allowLearnerInteraction && !isTrainer) {
      handleAnswerChange(blankIndex, draggedOption);
      setDraggedOption(null);
    }
  };

  const checkAnswer = (blankIndex) => {
    const userAnswer = (answers[blankIndex] || '').trim().toLowerCase();
    const correctAnswer = (exercise.blanks[blankIndex].correctAnswer || '').trim().toLowerCase();
    return userAnswer === correctAnswer;
  };

  const containerStyle = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: 'white',
    border: isSelected ? '3px solid #007bff' : '2px solid #d1d5db',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: isSelected 
      ? '0 20px 25px -5px rgba(0, 123, 255, 0.3)' 
      : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
    overflow: 'auto',
    cursor: isDraggable ? 'move' : 'default',
    userSelect: 'none',
    zIndex: 30,
    fontFamily: "'Segoe UI', 'Roboto', sans-serif"
  };

  return (
    <div 
      style={containerStyle}
      onMouseDown={onMouseDown}
    >
      {/* Title */}
      {exercise.title && (
        <div style={{
          fontSize: '22px',
          fontWeight: '700',
          marginBottom: '12px',
          color: '#1f2937',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {exercise.title}
        </div>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '16px',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          {exercise.instructions}
        </div>
      )}

      {/* Draggable Options (for learners with permission) */}
      {!isTrainer && allowLearnerInteraction && exercise.options && exercise.options.length > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          border: '2px dashed #9ca3af'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#4b5563',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📌 Drag options below to fill the blanks:
          </div>
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            {exercise.options.map((option, idx) => (
              <div
                key={idx}
                draggable={!usedOptions.has(option)}
                onDragStart={() => handleOptionDragStart(option)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: usedOptions.has(option) ? '#d1d5db' : '#3b82f6',
                  border: '2px solid #1e40af',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: usedOptions.has(option) ? '#6b7280' : 'white',
                  cursor: usedOptions.has(option) ? 'not-allowed' : 'grab',
                  transition: 'all 0.2s',
                  opacity: usedOptions.has(option) ? 0.6 : 1,
                  boxShadow: usedOptions.has(option) ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                  userSelect: 'none'
                }}
                onDragEnd={() => setDraggedOption(null)}
              >
                {option}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainer View - Show Options as Reference */}
      {isTrainer && exercise.options && exercise.options.length > 0 && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          borderRadius: '12px',
          border: '2px solid #fcd34d'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#92400e',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📋 Options provided to learners:
          </div>
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            {exercise.options.map((option, idx) => (
              <span
                key={idx}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#fef08a',
                  border: '2px solid #ca8a04',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#78350f'
                }}
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {exercise.blanks.map((blank, blankIndex) => (
          <div
            key={blankIndex}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s',
              ':hover': {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }
            }}
          >
            {/* Image (if provided) */}
            {blank.imageUrl && (
              <div style={{
                flexShrink: 0,
                width: '120px',
                height: '120px',
                border: '3px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={blank.imageUrl}
                  alt={`Question ${blankIndex + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: '8px'
                  }}
                  crossOrigin="anonymous"
                />
              </div>
            )}

            {/* Question Text with Blank */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Question Number */}
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#667eea',
                minWidth: '35px',
                textAlign: 'center',
                width: '35px',
                height: '35px',
                backgroundColor: '#eef2ff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {blankIndex + 1}
              </span>

              {/* Text Before Blank */}
              {blank.textBefore && (
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>
                  {blank.textBefore}
                </span>
              )}

              {/* Input Field with Drag & Drop */}
              <div
                onDragOver={handleBlankDragOver}
                onDrop={(e) => handleBlankDrop(e, blankIndex)}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  value={answers[blankIndex] || ''}
                  onChange={(e) => !isTrainer && allowLearnerInteraction && handleAnswerChange(blankIndex, e.target.value)}
                  disabled={isTrainer || !allowLearnerInteraction}
                  placeholder={allowLearnerInteraction && !isTrainer ? "Drag here or type" : "Read only"}
                  style={{
                    width: '140px',
                    padding: '10px 14px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: isTrainer || !allowLearnerInteraction ? '#f3f4f6' : '#ffffff',
                    outline: 'none',
                    cursor: isTrainer || !allowLearnerInteraction ? 'not-allowed' : 'text',
                    transition: 'all 0.2s',
                    color: '#1f2937',
                    ...(answers[blankIndex] && exercise.showFeedback && {
                      borderColor: checkAnswer(blankIndex) ? '#10b981' : '#ef4444',
                      backgroundColor: checkAnswer(blankIndex) ? '#ecfdf5' : '#fef2f2'
                    })
                  }}
                  onFocus={(e) => {
                    if (!isTrainer && allowLearnerInteraction) {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Text After Blank */}
              {blank.textAfter && (
                <span style={{ fontSize: '15px', color: '#374151', fontWeight: '500' }}>
                  {blank.textAfter}
                </span>
              )}

              {/* Feedback Icon */}
              {answers[blankIndex] && exercise.showFeedback && (
                <span style={{ fontSize: '24px', marginLeft: '8px', animation: 'pulse 0.5s' }}>
                  {checkAnswer(blankIndex) ? '✅' : '❌'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Trainer View - Show Correct Answers */}
      {isTrainer && (
        <>
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#fffbeb',
            border: '2px solid #fcd34d',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🔐 Correct Answers (Trainer Only):
            </div>
            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.8', marginBottom: '12px' }}>
              {exercise.blanks.map((blank, idx) => (
                <div key={idx} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#fef9e7', borderRadius: '6px' }}>
                  <strong style={{ color: '#a16207' }}>Q{idx + 1}:</strong> <span style={{ color: '#78350f' }}>{blank.correctAnswer}</span>
                </div>
              ))}
            </div>
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={() => onEdit(exercise)}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  width: '100%',
                  marginTop: '8px'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#2563eb';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#3b82f6';
                }}
              >
                ✏️ Edit Exercise
              </button>
            )}
          </div>

          {/* Learner's Answers - Real-time View */}
          {answers && Object.keys(answers).length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: '#f0f9ff',
              border: '2px solid #3b82f6',
              borderRadius: '12px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👁️ Learner's Answers (Live):
              </div>
              <div style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: '1.8' }}>
                {exercise.blanks.map((blank, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: '8px', 
                    padding: '8px', 
                    backgroundColor: answers[idx] ? (checkAnswer(idx) ? '#d1fae5' : '#fee2e2') : '#f3f4f6',
                    borderRadius: '6px',
                    border: answers[idx] ? (checkAnswer(idx) ? '2px solid #10b981' : '2px solid #ef4444') : '2px solid #d1d5db'
                  }}>
                    <strong style={{ color: '#1e40af' }}>Q{idx + 1}:</strong>{' '}
                    <span style={{ 
                      color: answers[idx] ? (checkAnswer(idx) ? '#065f46' : '#991b1b') : '#6b7280',
                      fontWeight: '600'
                    }}>
                      {answers[idx] || '(not answered yet)'}
                    </span>
                    {answers[idx] && (
                      <span style={{ marginLeft: '8px', fontSize: '16px' }}>
                        {checkAnswer(idx) ? '✅' : '❌'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Learner Progress & Permission Status */}
      {!isTrainer && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: allowLearnerInteraction ? '#f0fdf4' : '#f3f4f6',
          borderRadius: '12px',
          border: `2px solid ${allowLearnerInteraction ? '#86efac' : '#d1d5db'}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div>
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: allowLearnerInteraction ? '#16a34a' : '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px'
              }}>
                {allowLearnerInteraction ? '✨ Active - Fill the blanks!' : '⏳ Waiting for permission...'}
              </div>
              <div style={{
                fontSize: '12px',
                color: allowLearnerInteraction ? '#15803d' : '#6b7280'
              }}>
                Answered: <strong>{Object.keys(answers).filter(k => answers[k]).length}</strong> / <strong>{exercise.blanks.length}</strong>
              </div>
            </div>
            <div style={{
              fontSize: '28px',
              animation: allowLearnerInteraction ? 'pulse 2s infinite' : 'none'
            }}>
              {allowLearnerInteraction ? '✅' : '🔒'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

FillInTheBlanks.propTypes = {
  exercise: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    instructions: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string),
    blanks: PropTypes.arrayOf(PropTypes.shape({
      imageUrl: PropTypes.string,
      textBefore: PropTypes.string,
      textAfter: PropTypes.string,
      correctAnswer: PropTypes.string.isRequired
    })).isRequired,
    answers: PropTypes.object,
    showFeedback: PropTypes.bool
  }).isRequired,
  isTrainer: PropTypes.bool.isRequired,
  onAnswerChange: PropTypes.func,
  onEdit: PropTypes.func,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  isSelected: PropTypes.bool,
  onMouseDown: PropTypes.func,
  isDraggable: PropTypes.bool,
  allowLearnerInteraction: PropTypes.bool
};

FillInTheBlanks.defaultProps = {
  isSelected: false,
  isDraggable: false,
  allowLearnerInteraction: false
};

export default FillInTheBlanks;
