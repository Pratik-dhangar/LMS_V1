
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';
import '../../styles/components/trainer/CreateSessionModal.css';

const CreateSessionModal = ({ isOpen, onClose, onSessionCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [duration, setDuration] = useState(40);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !learnerId) {
      toast.error('Title and Learner ID are required.');
      return;
    }

    setIsLoading(true);
    try {
      const sessionData = {
        title,
        description,
        learner_id: parseInt(learnerId, 10),
        duration: duration,
      };
      await sessionService.createSession(sessionData);
      toast.success('Session created successfully!');
      onSessionCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error(error.response?.data?.detail || 'Failed to create session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setLearnerId('');
    setDuration(40);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">Create New Session</h2>
        <form onSubmit={handleSubmit}>
          <div className="modal-form-group">
            <label htmlFor="title" className="modal-label">
              Session Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-input"
              required
            />
          </div>
          <div className="modal-form-group">
            <label htmlFor="learnerId" className="modal-label">
              Learner ID
            </label>
            <input
              type="number"
              id="learnerId"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              className="modal-input"
              placeholder="Enter the numeric ID of the learner"
              required
            />
            {/* In a future version, this could be a dropdown populated by an API call to fetch available learners. */}
          </div>
          <div className="modal-form-group">
            <label htmlFor="duration" className="modal-label">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="modal-input"
              required
            />
          </div>
          <div className="modal-form-group last">
            <label htmlFor="description" className="modal-label">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="modal-textarea"
            ></textarea>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="modal-btn modal-btn-cancel"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSessionModal;
