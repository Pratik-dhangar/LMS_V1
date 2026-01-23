import React, { useState, useEffect, useRef } from 'react';
import { FaEdit, FaCheck, FaTimes, FaTrash, FaPlus } from 'react-icons/fa';
import '../../styles/session/exercise.css';

const Exercise = ({
    isTrainer = false,
    onExerciseSubmit = null,
    onExerciseUpdate = null,
    onExerciseDelete = null,
    onAnswerChange = null,
    onCursorMove = null,
    initialExercise = null
}) => {
    const answerTextareaRefs = useRef({});
    const [mode, setMode] = useState(isTrainer && !initialExercise ? 'create' : 'view'); // 'create', 'edit', 'view', 'sent'
    const [qaItems, setQaItems] = useState([]); // Array of {id, question, answer}
    const [editingQaItems, setEditingQaItems] = useState([]); // For edit mode
    const [cursorPosition, setCursorPosition] = useState(0);
    const [exerciseCreated, setExerciseCreated] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [editingId, setEditingId] = useState(null);

    // Initialize with existing exercise
    useEffect(() => {
        if (initialExercise) {
            // Handle both single question format and multiple Q&A format
            if (initialExercise.qaItems && Array.isArray(initialExercise.qaItems)) {
                setQaItems(initialExercise.qaItems);
                setExerciseCreated(true);
            } else if (initialExercise.question) {
                // Convert old format to new format
                setQaItems([{
                    id: '1',
                    question: initialExercise.question,
                    answer: initialExercise.learnerAnswer || ''
                }]);
                setExerciseCreated(true);
            }

            if (isTrainer) {
                setMode(prevMode => prevMode === 'sent' ? 'sent' : 'view');
            } else {
                setMode(prevMode => prevMode === 'submitted' ? 'submitted' : 'waiting');
            }
        }
    }, [initialExercise, isTrainer]);

    // Update learner answers when they change from parent (real-time sync)
    useEffect(() => {
        if (initialExercise && initialExercise.qaItems && Array.isArray(initialExercise.qaItems)) {
            setQaItems(initialExercise.qaItems);
        }
    }, [initialExercise?.qaItems]);

    // ============================================
    // TRAINER ACTIONS
    // ============================================

    const addNewQaItem = () => {
        const newId = Date.now().toString();
        setQaItems([...qaItems, { id: newId, question: '', answer: '' }]);
    };

    const updateQaItem = (id, field, value) => {
        setQaItems(qaItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const deleteQaItem = (id) => {
        if (qaItems.length === 1) {
            setFeedbackMessage('You must have at least one Q&A pair');
            setTimeout(() => setFeedbackMessage(''), 3000);
            return;
        }
        setQaItems(qaItems.filter(item => item.id !== id));
    };

    const handleCreateExercise = () => {
        if (qaItems.length === 0 || qaItems.some(item => !item.question.trim())) {
            setFeedbackMessage('All questions must be filled');
            return;
        }

        setExerciseCreated(true);
        setMode('view');

        if (onExerciseUpdate) {
            onExerciseUpdate({ qaItems });
        }

        setTimeout(() => setFeedbackMessage(''), 3000);
    };

    const handleEditExercise = () => {
        setEditingQaItems(JSON.parse(JSON.stringify(qaItems)));
        setMode('edit');
        setFeedbackMessage('');
    };

    const handleSaveEdit = () => {
        if (editingQaItems.length === 0 || editingQaItems.some(item => !item.question.trim())) {
            setFeedbackMessage('All questions must be filled');
            return;
        }

        setQaItems(editingQaItems);
        setMode('view');
        setFeedbackMessage('Exercise updated successfully!');

        if (onExerciseUpdate) {
            onExerciseUpdate({ qaItems: editingQaItems });
        }

        setTimeout(() => setFeedbackMessage(''), 3000);
    };

    const handleCancelEdit = () => {
        setEditingQaItems([]);
        setMode('view');
        setFeedbackMessage('');
    };

    const handleDeleteExercise = () => {
        if (window.confirm('Are you sure you want to delete this exercise?')) {
            setExerciseCreated(false);
            setQaItems([{ id: '1', question: '', answer: '' }]);
            setMode('create');
            setFeedbackMessage('Exercise deleted');

            if (onExerciseDelete) {
                onExerciseDelete();
            }

            setTimeout(() => setFeedbackMessage(''), 3000);
        }
    };

    const handleGiveCursor = () => {
        setMode('sent');
        // Reset answers
        setQaItems(qaItems.map(item => ({ ...item, answer: '' })));

        if (onExerciseSubmit) {
            onExerciseSubmit({
                qaItems,
                status: 'sent_to_learner'
            });
        }
    };

    // ============================================
    // LEARNER ACTIONS
    // ============================================

    const handleAnswerChange = (id, value) => {
        const updatedQaItems = qaItems.map(item =>
            item.id === id ? { ...item, answer: value } : item
        );
        setQaItems(updatedQaItems);

        // Send answers update to session
        if (onAnswerChange) {
            onAnswerChange({
                qaItems: updatedQaItems,
                timestamp: Date.now()
            });
        }
    };

    const handleCursorMove = (direction) => {
        // Cursor movement will be handled at the parent level
        if (onCursorMove) {
            window.exerciseCursorMove = () => { };
        }
    };

    // Expose cursor movement to parent component
    useEffect(() => {
        if (onCursorMove) {
            window.exerciseCursorMove = handleCursorMove;
        }
    }, [onCursorMove]);

    const handleSubmitAnswers = () => {
        if (qaItems.some(item => !item.answer.trim())) {
            setFeedbackMessage('Please answer all questions');
            return;
        }

        if (onExerciseSubmit) {
            onExerciseSubmit({
                qaItems,
                status: 'submitted'
            });
        }
    };

    // ============================================
    // RENDER TRAINER VIEW
    // ============================================

    const renderTrainerView = () => {
        if (mode === 'create') {
            return (
                <div className="exercise-container trainer-create">
                    <h3>Create Q & A</h3>
                    <div className="exercise-form">
                        {qaItems.map((item, index) => (
                            <div key={item.id} className="qa-item">
                                <div className="qa-header">
                                    <h4>Question {index + 1}</h4>
                                    {qaItems.length > 1 && (
                                        <button
                                            onClick={() => deleteQaItem(item.id)}
                                            className="rm-btn"
                                        >
                                            <FaTrash /> Remove
                                        </button>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Question:</label>
                                    <textarea
                                        value={item.question}
                                        onChange={(e) => updateQaItem(item.id, 'question', e.target.value)}
                                        placeholder="Enter the question for the learner"
                                        className="form-textarea"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="button-group">
                            <button onClick={addNewQaItem} className="btn btn-secondary">
                                <FaPlus /> Add Question
                            </button>
                            <button onClick={handleCreateExercise} className="btn btn-primary">
                                <FaCheck /> Create Q & A
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (mode === 'edit') {
            return (
                <div className="exercise-container trainer-edit">
                    <h3>Edit Exercise</h3>
                    <div className="exercise-form">
                        {editingQaItems.map((item, index) => (
                            <div key={item.id} className="qa-item">
                                <div className="qa-header">
                                    <h4>Question {index + 1}</h4>
                                    {editingQaItems.length > 1 && (
                                        <button
                                            onClick={() => setEditingQaItems(editingQaItems.filter(i => i.id !== item.id))}
                                            className="rm-btn"
                                        >
                                            <FaTrash /> Remove
                                        </button>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Question:</label>
                                    <textarea
                                        value={item.question}
                                        onChange={(e) => setEditingQaItems(editingQaItems.map(i =>
                                            i.id === item.id ? { ...i, question: e.target.value } : i
                                        ))}
                                        className="form-textarea"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="button-group">
                            <button onClick={() => setEditingQaItems([...editingQaItems, { id: Date.now().toString(), question: '', answer: '' }])} className="btn btn-secondary">
                                <FaPlus /> Add Question
                            </button>
                            <button onClick={handleSaveEdit} className="btn btn-success">
                                <FaCheck /> Save Changes
                            </button>
                            <button onClick={handleCancelEdit} className="btn btn-secondary">
                                <FaTimes /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (mode === 'view' && exerciseCreated) {
            return (
                <div className="exercise-container trainer-view">
                    <h3>Exercise</h3>
                    <div className="exercise-display">
                        {qaItems.map((item, index) => (
                            <div key={item.id} className="exercise-section">
                                <h4>Question {index + 1}:</h4>
                                <div className="exercise-content">{item.question}</div>
                            </div>
                        ))}

                        <div className="button-group">
                            <button onClick={handleGiveCursor} className="btn btn-primary">
                                Send to Learner
                            </button>
                            <button onClick={handleEditExercise} className="btn btn-secondary">
                                <FaEdit /> Edit
                            </button>
                            <button onClick={handleDeleteExercise} className="btn btn-danger">
                                <FaTrash /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (mode === 'sent') {
            return (
                <div className="exercise-container trainer-viewing">
                    <h3>Exercise Sent to Learner</h3>
                    <div className="exercise-display">
                        {qaItems.map((item, index) => (
                            <div key={item.id} className="qa-pair-section">
                                <div className="exercise-section">
                                    <h4>Question {index + 1}:</h4>
                                    <div className="exercise-content">{item.question}</div>
                                </div>

                                <div className="exercise-section answer-input-section">
                                    <h4>Learner's Answer {index + 1}:</h4>
                                    <textarea
                                        ref={(el) => answerTextareaRefs.current[item.id] = el}
                                        value={item.answer || ''}
                                        onChange={(e) => {
                                            const newAnswer = e.target.value;
                                            setQaItems(qaItems.map(i =>
                                                i.id === item.id ? { ...i, answer: newAnswer } : i
                                            ));
                                        }}
                                        placeholder="Learner's answer will appear here..."
                                        className="answer-input"
                                        style={{ backgroundColor: '#f9f9f9', cursor: 'text' }}
                                    />
                                    <div style={{ marginTop: '4px', fontSize: '0.8em', color: '#666' }}>
                                        {item.answer ? item.answer.length : 0} characters
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="button-group">
                            <button onClick={handleEditExercise} className="btn btn-secondary">
                                <FaEdit /> Edit
                            </button>
                            <button onClick={handleDeleteExercise} className="btn btn-danger">
                                <FaTrash /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    // ============================================
    // RENDER LEARNER VIEW
    // ============================================

    const renderLearnerView = () => {
        if (mode === 'waiting' && exerciseCreated) {
            return (
                <div className="exercise-container learner-view">
                    <h3>Exercise</h3>
                    <div className="exercise-display">
                        {qaItems.map((item, index) => (
                            <div key={item.id} className="qa-pair-section">
                                <div className="exercise-section">
                                    <h4>Question {index + 1}:</h4>
                                    <div className="exercise-content">{item.question}</div>
                                </div>

                                <div className="exercise-section answer-input-section">
                                    <h4>Your Answer {index + 1}:</h4>
                                    <textarea
                                        ref={(el) => answerTextareaRefs.current[item.id] = el}
                                        value={item.answer || ''}
                                        onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                                        placeholder="Click to focus or start typing..."
                                        className="answer-input"
                                        style={{ backgroundColor: '#f9f9f9', cursor: 'text' }}
                                    />
                                    <div style={{ marginTop: '4px', fontSize: '0.8em', color: '#666' }}>
                                        {item.answer ? item.answer.length : 0} characters
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleSubmitAnswers}
                            disabled={qaItems.some(item => !item.answer.trim())}
                            className="btn btn-primary submit-btn"
                        >
                            <FaCheck /> Submit All Answers
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="exercise-container learner-empty">
                <div className="empty-state">
                    <p>Waiting for trainer to start an exercise...</p>
                </div>
            </div>
        );
    };

    // ============================================
    // RENDER FEEDBACK MESSAGE
    // ============================================

    const renderFeedback = () => {
        if (!feedbackMessage) return null;

        let messageClass = 'feedback-info';
        if (feedbackMessage.includes('successfully')) messageClass = 'feedback-success';
        if (feedbackMessage.includes('cannot') || feedbackMessage.includes('need')) messageClass = 'feedback-error';
        if (feedbackMessage.includes('✓')) messageClass = 'feedback-success';

        return (
            <div className={`feedback-message ${messageClass}`}>
                {feedbackMessage}
            </div>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <div className="exercise-wrapper">
            {renderFeedback()}
            {isTrainer ? renderTrainerView() : renderLearnerView()}
        </div>
    );
};

export default Exercise;
