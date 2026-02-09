import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaEdit, FaCheck, FaTimes, FaTrash } from 'react-icons/fa';
import { FaComments } from 'react-icons/fa';
import useComments from '../../hooks/useComments';
import '../../styles/session/exercise.css';

const Exercise = ({
    isTrainer = false,
    onExerciseSubmit = null,
    onExerciseUpdate = null,
    onExerciseDelete = null,
    onAnswerChange = null,
    whiteboardService = null,
    initialExercise = null,
    attendeeLabel = 'Attendee' // 'Guest/Client' for Coach, 'Learner' for Trainer
}) => {
    const answerTextareaRef = useRef(null);
    const [mode, setMode] = useState(isTrainer && !initialExercise ? 'create' : 'view'); // 'create', 'edit', 'view', 'sent'
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [editingQuestion, setEditingQuestion] = useState('');
    const [exerciseCreated, setExerciseCreated] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const wbSmallBtnBase = 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';
    const wbSmallBtnActive = 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1';


    // Initialize with existing exercise
    useEffect(() => {
        if (initialExercise) {
            // Handle single question format
            if (initialExercise.question) {
                setQuestion(initialExercise.question);
                // For trainer: sync answer from parent
                // For learner: only set initial answer if it's a new exercise
                if (isTrainer) {
                    setAnswer(initialExercise.answer || '');
                } else if (!exerciseCreated) {
                    // Only set answer on first load for learner
                    setAnswer(initialExercise.answer || '');
                }
                setExerciseCreated(true);
            }

            if (isTrainer) {
                setMode(prevMode => prevMode === 'sent' ? 'sent' : 'view');
            } else {
                setMode('waiting');
            }
        }
    }, [initialExercise?.question, isTrainer]);

    // Sync trainer's view with learner's answer (trainer only, when in "sent" mode)
    useEffect(() => {
        if (isTrainer && mode === 'sent' && initialExercise?.answer !== undefined) {
            setAnswer(initialExercise.answer || '');
        }
    }, [initialExercise?.answer, isTrainer, mode]);


    // -----------------------------------------------------------
    // 🔹 Purpose: Comments tool state
    // 🔸 How it works: manages comments display for both trainer and learner
    // -----------------------------------------------------------
    const [showComments, setShowComments] = useState(false);

    // -----------------------------------------------------------  
    // 🔹 Purpose: Comments using custom hook (separate from messages)
    // 🔸 How it works: useComments hook manages comments visible to both trainer and learner
    // -----------------------------------------------------------  
    const {
        trainerComments,
        learnerComments,
        commentInput,
        setCommentInput,
        sendComment,
        handleKeyPress: _handleCommentKeyPress,
        addReceivedComment
    } = useComments(whiteboardService, 'trainer');

    // Setup WebSocket handler for real-time comment updates
    useEffect(() => {
        if (!whiteboardService) return;

        console.log('[Exercise] Setting up whiteboardService.onCommentUpdate handler');

        whiteboardService.onCommentUpdate = (data) => {
            console.log('[Exercise] ✅ onCommentUpdate callback triggered with data:', data);
            // normalize incoming comment shape to what useComments expects
            const incoming = {
                text: data.message || data.text || '',
                type: data.type || 'learner',
                timestamp: data.timestamp || Date.now()
            };
            console.log('[Exercise] ✅ Calling addReceivedComment with normalized:', incoming);
            addReceivedComment(incoming);
            console.log('[Exercise] ✅ addReceivedComment completed');
        };

        return () => {
            if (whiteboardService) {
                console.log('[Exercise] Cleaning up whiteboardService.onCommentUpdate');
                whiteboardService.onCommentUpdate = null;
            }
        };
    }, [whiteboardService, addReceivedComment]);

    // ============================================
    // TRAINER ACTIONS
    // ============================================

    const handleCreateExercise = () => {
        if (!question.trim()) {
            setFeedbackMessage('Question cannot be empty');
            setTimeout(() => setFeedbackMessage(''), 3000);
            return;
        }

        setExerciseCreated(true);
        setMode('view');

        // Do not auto-send the question to attendees here.
        // The trainer must explicitly "Send to Attendee" via the Send button (handleGiveCursor).

        setTimeout(() => setFeedbackMessage(''), 3000);
    };

    const handleEditExercise = () => {
        setEditingQuestion(question);
        setMode('edit');
        setFeedbackMessage('');
    };

    const handleSaveEdit = () => {
        if (!editingQuestion.trim()) {
            setFeedbackMessage('Question cannot be empty');
            return;
        }

        setQuestion(editingQuestion);
        setMode('view');
        setFeedbackMessage('Question updated successfully!');

        if (onExerciseUpdate) {
            onExerciseUpdate({ question: editingQuestion });
        }

        setTimeout(() => setFeedbackMessage(''), 3000);
    };

    const handleCancelEdit = () => {
        setEditingQuestion('');
        setMode('view');
        setFeedbackMessage('');
    };

    const handleDeleteExercise = () => {
        if (window.confirm('Are you sure you want to delete this exercise?')) {
            setExerciseCreated(false);
            setQuestion('');
            setAnswer('');
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
        // Reset answer
        setAnswer('');

        if (onExerciseSubmit) {
            onExerciseSubmit({
                question,
                answer: '',
                status: 'sent_to_learner'
            });
        }
    };

    // ============================================
    // LEARNER ACTIONS
    // ============================================

    // Debounce timer for sending answer updates to trainer
    const answerDebounceTimer = useRef(null);
    const commentDebounceTimer = useRef(null);

    const debouncedSendAnswer = useCallback((answerValue) => {
        const DELAY = 300; // ms
        if (answerDebounceTimer.current) {
            clearTimeout(answerDebounceTimer.current);
        }
        answerDebounceTimer.current = setTimeout(() => {
            if (whiteboardService) {
                whiteboardService.send('exercise_answer_update', {
                    question,
                    answer: answerValue,
                    timestamp: Date.now()
                });
            }
            answerDebounceTimer.current = null;
        }, DELAY);
    }, [whiteboardService, question]);

    const debouncedSendComment = useCallback((commentValue) => {
        const DELAY = 300; // ms
        if (commentDebounceTimer.current) {
            clearTimeout(commentDebounceTimer.current);
        }
        commentDebounceTimer.current = setTimeout(() => {
            if (whiteboardService) {
                whiteboardService.send('comment_update', {
                    text: commentValue,
                    type: 'learner',
                    timestamp: new Date().toISOString()
                });
            }
            commentDebounceTimer.current = null;
        }, DELAY);
    }, [whiteboardService]);

    const flushSendAnswer = useCallback((answerValue) => {
        if (answerDebounceTimer.current) {
            clearTimeout(answerDebounceTimer.current);
            answerDebounceTimer.current = null;
        }
        if (whiteboardService) {
            whiteboardService.send('exercise_answer_update', {
                question,
                answer: answerValue,
                timestamp: Date.now()
            });
        }
    }, [whiteboardService, question]);

    useEffect(() => {
        return () => {
            if (answerDebounceTimer.current) {
                clearTimeout(answerDebounceTimer.current);
                answerDebounceTimer.current = null;
            }
            if (commentDebounceTimer.current) {
                clearTimeout(commentDebounceTimer.current);
                commentDebounceTimer.current = null;
            }
        };
    }, []);

    const handleAnswerChange = (value) => {
        setAnswer(value);

        // Notify parent immediately (local state update)
        if (onAnswerChange) {
            onAnswerChange({
                question,
                answer: value,
                timestamp: Date.now()
            });
        }

        // Debounced send to trainer via WebSocket to avoid per-keystroke sends
        if (!isTrainer) {
            debouncedSendAnswer(value);
        }
    };

    const handleSubmitAnswer = () => {
        if (!answer.trim()) {
            setFeedbackMessage('Please answer the question');
            return;
        }

        if (onExerciseSubmit) {
            onExerciseSubmit({
                question,
                answer,
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
                    {/* <h3>Create Q & A</h3> */}
                    <div className="exercise-form">
                        <div className="qa-item">
                            <div className="form-group">
                                <label>Question:</label>
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Enter the question for the learner"
                                    className="form-textarea"
                                />
                            </div>
                        </div>

                        <div className="button-group">
                            <button onClick={handleCreateExercise} className="btn btn-primary">
                                <FaCheck /> Create Q & A
                            </button>
                            {/* Comments Tool Button */}
                            <button
                                onClick={() => {
                                    const newState = !showComments;
                                    setShowComments(newState);
                                    if (whiteboardService) {
                                        whiteboardService.send('comments_toggle', {
                                            visible: newState,
                                            timestamp: Date.now()
                                        });
                                    }
                                }}
                                className={`${showComments ? wbSmallBtnActive : wbSmallBtnBase}`}
                                title="Open Comments Tool - Share notes with learner"
                            >
                                <span>💬</span>
                                <span>Comments</span>
                            </button>
                        </div>
                    </div>
                    {/* Comments Tool */}
                    {showComments && (
                        <div className="session-comments-section border-2 border-gray-300 mt-2 rounded bg-gray-50 w-full" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                            <div style={{ position: 'relative' }}>
                                {/* Learner Comments Editable Section */}
                                <div style={{ paddingTop: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}>
                                    <textarea
                                        value={learnerComments || ''}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            // Update local display state immediately via addReceivedComment
                                            addReceivedComment({
                                                text: newValue,
                                                type: 'learner',
                                                timestamp: new Date().toISOString()
                                            });
                                            // Debounced send to attendee via whiteboard
                                            debouncedSendComment(newValue);
                                        }}
                                        onBlur={(e) => {
                                            // Flush any pending comment sends on blur
                                            if (commentDebounceTimer.current) {
                                                clearTimeout(commentDebounceTimer.current);
                                                if (whiteboardService) {
                                                    whiteboardService.send('comment_update', {
                                                        text: e.target.value,
                                                        type: 'learner',
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                                commentDebounceTimer.current = null;
                                            }
                                        }}
                                        placeholder="Learner comments will appear here..."
                                        className="bg-blue-50 border border-blue-300 rounded p-2 w-full text-gray-700"
                                        style={{ minHeight: '60px', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', maxHeight: '100px', overflowY: 'auto', resize: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (mode === 'edit') {
            return (
                <div className="exercise-container trainer-edit">
                    <h3>Edit Question</h3>
                    <div className="exercise-form">
                        <div className="qa-item">
                            <div className="form-group">
                                <label>Question:</label>
                                <textarea
                                    value={editingQuestion}
                                    onChange={(e) => setEditingQuestion(e.target.value)}
                                    className="form-textarea"
                                />
                            </div>
                        </div>

                        <div className="button-group">
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
                    {/* <h3>Exercise</h3> */}
                    <div className="exercise-display">
                        <div className="exercise-section">
                            <h4>Question:</h4>
                            <div className="exercise-content">{question}</div>
                        </div>

                        <div className="button-group">
                            <button onClick={handleGiveCursor} className="btn btn-primary">
                                Send to {attendeeLabel}
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
                    {/* <h3>Exercise Sent to Learner</h3> */}
                    <div className="exercise-display">
                        <div className="exercise-section">
                            <h4>Question:</h4>
                            <div className="exercise-content">{question}</div>
                        </div>

                        <div className="exercise-section answer-input-section">
                            <h4>Learner's Answer:</h4>
                            <textarea
                                ref={answerTextareaRef}
                                value={answer || ''}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Learner's answer will appear here..."
                                className="answer-input"
                                style={{ backgroundColor: '#f9f9f9', cursor: 'text' }}
                                disabled={false}
                            />
                        </div>

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
                    {/* <h3>Exercise</h3> */}
                    <div className="exercise-display">
                        <div className="exercise-section">
                            <h4>Question:</h4>
                            <div className="exercise-content">{question}</div>
                        </div>

                        <div className="exercise-section answer-input-section">
                            <h4>Your Answer:</h4>
                            <textarea
                                ref={answerTextareaRef}
                                value={answer || ''}
                                onChange={(e) => handleAnswerChange(e.target.value)}
                                onBlur={(e) => flushSendAnswer(e.target.value)}
                                placeholder="Click to focus or start typing..."
                                className="answer-input"
                                style={{ backgroundColor: '#f9f9f9', cursor: 'text' }}
                            />

                        </div>
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
