
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Session</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Session Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="learnerId" className="block text-sm font-medium text-gray-700 mb-1">
              Learner ID
            </label>
            <input
              type="number"
              id="learnerId"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter the numeric ID of the learner"
              required
            />
            {/* In a future version, this could be a dropdown populated by an API call to fetch available learners. */}
          </div>
          <div className="mb-4">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-400"
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
