import { useState, useCallback } from 'react';

/**
 * Custom hook for managing comments functionality in session components
 * Allows both trainer and learner to add comments visible to both sides
 * @param {Object} whiteboardService - Whiteboard service instance for real-time communication
 * @param {string} userRole - 'trainer' or 'learner'
 * @returns {Object} - Comments state and handlers
 */
const useComments = (whiteboardService, userRole = 'trainer') => {
    const [trainerComments, setTrainerComments] = useState('');
    const [learnerComments, setLearnerComments] = useState('');
    const [commentInput, setCommentInput] = useState('');

    /**
     * Send a comment via Whiteboard service
     */
    const sendComment = useCallback(() => {
        if (!commentInput.trim()) return;

        const commentData = {
            type: userRole, // 'trainer' or 'learner'
            text: commentInput.trim(),
            timestamp: new Date().toISOString()
        };

        // Send via WebRTC Whiteboard if available
        if (whiteboardService) {
            whiteboardService.send('comment_update', commentData);
        }

        // Update local state based on user role
        if (userRole === 'trainer') {
            setTrainerComments(commentInput.trim());
        } else {
            setLearnerComments(commentInput.trim());
        }

        // Clear input
        setCommentInput('');
    }, [commentInput, whiteboardService, userRole]);

    /**
     * Handle Enter key press in comment input
     */
    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendComment();
        }
    }, [sendComment]);

    /**
     * Receive a comment from the other participant
     */
    const addReceivedComment = useCallback((commentData) => {
        if (commentData.type === 'trainer') {
            setTrainerComments(commentData.text);
        } else if (commentData.type === 'learner') {
            setLearnerComments(commentData.text);
        }
    }, []);

    /**
     * Clear all comments
     */
    const clearComments = useCallback(() => {
        setTrainerComments('');
        setLearnerComments('');
        setCommentInput('');
    }, []);

    /**
     * Clear trainer comments
     */
    const clearTrainerComments = useCallback(() => {
        setTrainerComments('');
    }, []);

    /**
     * Clear learner comments
     */
    const clearLearnerComments = useCallback(() => {
        setLearnerComments('');
    }, []);

    return {
        trainerComments,
        learnerComments,
        commentInput,
        setCommentInput,
        sendComment,
        handleKeyPress,
        addReceivedComment,
        clearComments,
        clearTrainerComments,
        clearLearnerComments
    };
};

export default useComments;
