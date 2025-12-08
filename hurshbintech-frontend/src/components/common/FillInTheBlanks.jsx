import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../styles/components/common/FillInTheBlanks.css';

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

  return (
    <div
      className={`fill-in-blanks-container ${isSelected ? 'selected' : 'unselected'} ${isDraggable ? 'draggable' : 'not-draggable'}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`
      }}
      onMouseDown={onMouseDown}
    >
      {/* Title */}
      {exercise.title && (
        <div className="fill-in-blanks-title">
          {exercise.title}
        </div>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <div className="fill-in-blanks-instructions">
          {exercise.instructions}
        </div>
      )}

      {/* Draggable Options (for learners with permission) */}
      {!isTrainer && allowLearnerInteraction && exercise.options && exercise.options.length > 0 && (
        <div className="fill-in-blanks-options-learner">
          <div className="fill-in-blanks-options-header">
            📌 Drag options below to fill the blanks:
          </div>
          <div className="fill-in-blanks-options-list">
            {exercise.options.map((option, idx) => (
              <div
                key={idx}
                draggable={!usedOptions.has(option)}
                onDragStart={() => handleOptionDragStart(option)}
                className={`fill-in-blanks-option ${usedOptions.has(option) ? 'used' : 'available'}`}
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
        <div className="fill-in-blanks-options-trainer">
          <div className="fill-in-blanks-options-header">
            📋 Options provided to learners:
          </div>
          <div className="fill-in-blanks-options-list">
            {exercise.options.map((option, idx) => (
              <span
                key={idx}
                className="fill-in-blanks-option"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="fill-in-blanks-questions">
        {exercise.blanks.map((blank, blankIndex) => (
          <div
            key={blankIndex}
            className="fill-in-blanks-question"
          >
            {/* Image (if provided) */}
            {blank.imageUrl && (
              <div className="fill-in-blanks-question-image">
                <img
                  src={blank.imageUrl}
                  alt={`Question ${blankIndex + 1}`}
                  crossOrigin="anonymous"
                />
              </div>
            )}

            {/* Question Text with Blank */}
            <div className="fill-in-blanks-question-content">
              {/* Question Number */}
              <span className="fill-in-blanks-question-number">
                {blankIndex + 1}
              </span>

              {/* Text Before Blank */}
              {blank.textBefore && (
                <span className="fill-in-blanks-text">
                  {blank.textBefore}
                </span>
              )}

              {/* Input Field with Drag & Drop */}
              <div
                className="fill-in-blanks-input-wrapper"
                onDragOver={handleBlankDragOver}
                onDrop={(e) => handleBlankDrop(e, blankIndex)}
              >
                <input
                  type="text"
                  value={answers[blankIndex] || ''}
                  onChange={(e) => !isTrainer && allowLearnerInteraction && handleAnswerChange(blankIndex, e.target.value)}
                  disabled={isTrainer || !allowLearnerInteraction}
                  placeholder={allowLearnerInteraction && !isTrainer ? "Drag here or type" : "Read only"}
                  className={`fill-in-blanks-input ${isTrainer || !allowLearnerInteraction ? 'disabled' : 'enabled'
                    } ${answers[blankIndex] && exercise.showFeedback
                      ? (checkAnswer(blankIndex) ? 'correct' : 'incorrect')
                      : ''
                    }`.trim()}
                />
              </div>

              {/* Text After Blank */}
              {blank.textAfter && (
                <span className="fill-in-blanks-text">
                  {blank.textAfter}
                </span>
              )}

              {/* Feedback Icon */}
              {answers[blankIndex] && exercise.showFeedback && (
                <span className="fill-in-blanks-feedback">
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
          <div className="fill-in-blanks-trainer-answers">
            <div className="fill-in-blanks-trainer-header">
              🔐 Correct Answers (Trainer Only):
            </div>
            <div className="fill-in-blanks-trainer-list">
              {exercise.blanks.map((blank, idx) => (
                <div key={idx} className="fill-in-blanks-trainer-answer">
                  <strong>Q{idx + 1}:</strong> <span>{blank.correctAnswer}</span>
                </div>
              ))}
            </div>
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={() => onEdit(exercise)}
                className="fill-in-blanks-edit-btn"
              >
                ✏️ Edit Exercise
              </button>
            )}
          </div>

          {/* Learner's Answers - Real-time View */}
          {answers && Object.keys(answers).length > 0 && (
            <div className="fill-in-blanks-realtime-answers">
              <div className="fill-in-blanks-realtime-header">
                👁️ Learner's Answers (Live):
              </div>
              <div className="fill-in-blanks-realtime-list">
                {exercise.blanks.map((blank, idx) => (
                  <div key={idx} className={`fill-in-blanks-realtime-answer ${answers[idx]
                      ? (checkAnswer(idx) ? 'correct' : 'incorrect')
                      : 'unanswered'
                    }`}>
                    <strong>Q{idx + 1}:</strong>{' '}
                    <span className={`answer-text ${answers[idx]
                        ? (checkAnswer(idx) ? 'correct' : 'incorrect')
                        : 'unanswered'
                      }`}>
                      {answers[idx] || '(not answered yet)'}
                    </span>
                    {answers[idx] && (
                      <span className="fill-in-blanks-feedback">
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
        <div className={`fill-in-blanks-learner-progress ${allowLearnerInteraction ? 'active' : 'waiting'}`}>
          <div className="fill-in-blanks-progress-content">
            <div>
              <div className={`fill-in-blanks-progress-status ${allowLearnerInteraction ? 'active' : 'waiting'}`}>
                {allowLearnerInteraction ? '✨ Active - Fill the blanks!' : '⏳ Waiting for permission...'}
              </div>
              <div className={`fill-in-blanks-progress-count ${allowLearnerInteraction ? 'active' : 'waiting'}`}>
                Answered: <strong>{Object.keys(answers).filter(k => answers[k]).length}</strong> / <strong>{exercise.blanks.length}</strong>
              </div>
            </div>
            <div className={`fill-in-blanks-progress-icon ${allowLearnerInteraction ? 'active' : ''}`}>
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
