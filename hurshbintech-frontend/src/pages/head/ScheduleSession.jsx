import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import learningGoalsService from '../../api/services/learningGoalsService';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import headService from '../../api/services/headService';
import sessionService from '../../api/services/sessionService';
import learningContentService from '../../api/services/learningContentService';


const ScheduleSession = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [learners, setLearners] = useState([]);
  const [contents, setContents] = useState([]);
  const [learningGoals, setLearningGoals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    trainer_id: '',
    learner_id: '',
    scheduled_date: '',
    duration: 30,
    content_ids: [],
    goal_ids: []
  });

  const [searchTerm, setSearchTerm] = useState({
    trainer: '',
    learner: ''
  });

  const [showDropdown, setShowDropdown] = useState({
    trainer: false,
    learner: false
  });

  const trainerDropdownRef = useRef(null);
  const learnerDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (trainerDropdownRef.current && !trainerDropdownRef.current.contains(event.target)) {
        setShowDropdown(prev => ({ ...prev, trainer: false }));
      }
      if (learnerDropdownRef.current && !learnerDropdownRef.current.contains(event.target)) {
        setShowDropdown(prev => ({ ...prev, learner: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [trainersData, learnersData, contentsData, goalsData] = await Promise.all([
        headService.getAllTrainers(),
        headService.getAllLearners(),
        learningContentService.head.getAll(),
        learningGoalsService.head.getAll()
      ]);
      setTrainers(trainersData);
      setLearners(learnersData);
      setContents(contentsData);
      setLearningGoals(goalsData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  // Toggle learning goal selection
  const handleGoalToggle = (goalId) => {
    setFormData(prev => {
      const newGoalIds = prev.goal_ids.includes(goalId)
        ? prev.goal_ids.filter(id => id !== goalId)
        : [...prev.goal_ids, goalId];
      return {
        ...prev,
        goal_ids: newGoalIds
      };
    });
  };

  const handleContentToggle = (contentId) => {
    setFormData(prev => {
      const newContentIds = prev.content_ids.includes(contentId)
        ? prev.content_ids.filter(id => id !== contentId)
        : [...prev.content_ids, contentId];
      return {
        ...prev,
        content_ids: newContentIds
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.trainer_id || !formData.learner_id || !formData.scheduled_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate scheduled_date
    const dateObj = new Date(formData.scheduled_date);
    if (isNaN(dateObj.getTime())) {
      toast.error('Please select a valid date and time.');
      return;
    }

    const scheduled_date = formData.scheduled_date + ':00';

    const sessionPayload = {
      ...formData,
      trainer_id: parseInt(formData.trainer_id),
      learner_id: parseInt(formData.learner_id),
      scheduled_date,
      duration: parseInt(formData.duration),
      content_ids: formData.content_ids.map(Number),
      goal_ids: formData.goal_ids.map(Number),
    };

    try {
      setLoading(true);
      await sessionService.createSession(sessionPayload);
      toast.success('Session scheduled successfully!');
      navigate('/head/dashboard');
    } catch (error) {
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errorMessages = error.response.data.detail.map(err => 
            `${err.loc.join('.')}: ${err.msg}`
          ).join(', ');
          toast.error(`Validation error: ${errorMessages}`);
        } else {
          toast.error(error.response.data.detail);
        }
      } else {
        toast.error('Failed to schedule session');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTrainers = trainers.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.trainer.toLowerCase()) ||
    t.user_id?.toString().includes(searchTerm.trainer)
  );

  const filteredLearners = learners.filter(l =>
    l.name?.toLowerCase().includes(searchTerm.learner.toLowerCase()) ||
    l.user_id?.toString().includes(searchTerm.learner)
  );

  const getSelectedTrainerName = () => {
    const trainer = trainers.find(t => t.user_id === parseInt(formData.trainer_id));
    return trainer ? `${trainer.name} (ID: ${trainer.user_id})` : '';
  };

  const getSelectedLearnerName = () => {
    const learner = learners.find(l => l.user_id === parseInt(formData.learner_id));
    return learner ? `${learner.name} (ID: ${learner.user_id})` : '';
  };

  const handleTrainerSelect = (trainerId) => {
    setFormData({...formData, trainer_id: trainerId});
    setShowDropdown({...showDropdown, trainer: false});
    setSearchTerm({...searchTerm, trainer: ''});
  };

  const handleLearnerSelect = (learnerId) => {
    setFormData({...formData, learner_id: learnerId});
    setShowDropdown({...showDropdown, learner: false});
    setSearchTerm({...searchTerm, learner: ''});
  };



// State to hold the unconfirmed date/time from the input
const [tempDate, setTempDate] = useState(formData.scheduled_date || '');

// Handler for the "Set" button
const handleSetDate = () => {
  // Commit the temporary date to the main form state
  setFormData({...formData, scheduled_date: tempDate});
  // You could also add a console.log or alert here for confirmation
  console.log("Date set:", tempDate);
};



  if (loadingData) {
    return (
      <>
        <Navbar />
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8 min-h-screen">
        <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Schedule Training Session</h1>
            <p className="text-gray-600">Create a new session for trainer and learner</p>
          </div>

          <form onSubmit={handleSubmit} className="form-section">
            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Session Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Introduction to Fruits"
                required
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows="3"
                placeholder="Session description (optional)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Select Trainer with Searchable Dropdown */}
              <div className="relative" ref={trainerDropdownRef}>
                <label className="block text-sm font-medium mb-2">
                  Select Trainer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={formData.trainer_id ? getSelectedTrainerName() : "Search trainer by name or ID..."}
                  value={searchTerm.trainer}
                  onChange={(e) => {
                    setSearchTerm({...searchTerm, trainer: e.target.value});
                    setShowDropdown({...showDropdown, trainer: true});
                  }}
                  onFocus={() => setShowDropdown({...showDropdown, trainer: true})}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required={!formData.trainer_id}
                />
                {showDropdown.trainer && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredTrainers.length > 0 ? (
                      filteredTrainers.map(trainer => (
                        <div
                          key={trainer.id}
                          onClick={() => handleTrainerSelect(trainer.user_id)}
                          className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                            formData.trainer_id === trainer.user_id ? 'bg-blue-100 font-medium' : ''
                          }`}
                        >
                          {trainer.name} <span className="text-gray-500 text-sm">(ID: {trainer.user_id})</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">No trainers found</div>
                    )}
                  </div>
                )}
                {formData.trainer_id && !showDropdown.trainer && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({...formData, trainer_id: ''});
                      setSearchTerm({...searchTerm, trainer: ''});
                    }}
                    className="absolute right-2 top-9 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Select Learner with Searchable Dropdown */}
              <div className="relative" ref={learnerDropdownRef}>
                <label className="block text-sm font-medium mb-2">
                  Select Learner <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={formData.learner_id ? getSelectedLearnerName() : "Search learner by name or ID..."}
                  value={searchTerm.learner}
                  onChange={(e) => {
                    setSearchTerm({...searchTerm, learner: e.target.value});
                    setShowDropdown({...showDropdown, learner: true});
                  }}
                  onFocus={() => setShowDropdown({...showDropdown, learner: true})}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required={!formData.learner_id}
                />
                {showDropdown.learner && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredLearners.length > 0 ? (
                      filteredLearners.map(learner => (
                        <div
                          key={learner.id}
                          onClick={() => handleLearnerSelect(learner.user_id)}
                          className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                            formData.learner_id === learner.user_id ? 'bg-blue-100 font-medium' : ''
                          }`}
                        >
                          {learner.name} <span className="text-gray-500 text-sm">(ID: {learner.user_id})</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">No learners found</div>
                    )}
                  </div>
                )}
                {formData.learner_id && !showDropdown.learner && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({...formData, learner_id: ''});
                      setSearchTerm({...searchTerm, learner: ''});
                    }}
                    className="absolute right-2 top-9 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Scheduled Date/Time */}
              {/* <div>
                <label className="block text-sm font-medium mb-2">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div> */}


                    <div>
  <label className="block text-sm font-medium mb-2">
    Date & Time <span className="text-red-500">*</span>
  </label>
  
  {/* Flex container to hold input and button */}
  <div className="flex items-center gap-2">
    <input
      type="datetime-local"
      value={tempDate}  
      onChange={(e) => setTempDate(e.target.value)} 
      className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      required
    />
    <button
      type="button" // Important: prevents form submission
      onClick={handleSetDate}
      className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 whitespace-nowrap"
    >
      Set
    </button>
  </div>

  {/* Optional: Show the user what date is currently *confirmed* */}
  {formData.scheduled_date && (
    <p className="text-sm text-gray-600 mt-2">
      Confirmed time: {new Date(formData.scheduled_date).toLocaleString()}
    </p>
  )}
</div>




              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: e.target.value})}
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="5"
                  max="60"
                  step="5"
                  required
                />
              </div>
            </div>


            {/* Select Learning Goals */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Select Learning Goals (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-3">Choose learning goals for this session</p>
             
              {learningGoals.length === 0 ? (
                <p className="text-gray-500 text-center py-4 border rounded">No learning goals available</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#34495e] text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-12">
                          Select
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                          Goal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {learningGoals.map((goal) => (
                        <tr 
                          key={goal.id}
                          onClick={() => handleGoalToggle(goal.id)}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                            formData.goal_ids.includes(goal.id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={formData.goal_ids.includes(goal.id)}
                              onChange={() => {}}
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{goal.goal}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-500">{goal.goal_description}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {formData.goal_ids.length} goal(s) selected
              </p>
            </div>

            {/* Select Learning Content */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Select Learning Content (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-3">Choose content that will be available during the session</p>
              
              {contents.length === 0 ? (
                <p className="text-gray-500 text-center py-4 border rounded">No learning content available</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto border rounded p-2">
                  {contents.map(content => {
                    const getContentIcon = (type) => {
                      const icons = { image: '🖼️', pdf: '📄', video: '🎥', audio: '🎵', document: '📝' };
                      return icons[type] || '📁';
                    };
                    
                    // Function to render thumbnail or icon
                    const renderThumbnail = () => {
                      if (content.content_type === 'image' || content.thumbnail_url) {
                        const imageUrl = learningContentService.getFileUrl(
                          content.content_type === 'image' ? content.file_url : content.thumbnail_url
                        );
                        return (
                          <div className="relative w-full h-16 bg-gray-100 rounded overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={content.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <span className="text-2xl">{getContentIcon(content.content_type)}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="w-full h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
                          <span className="text-2xl">{getContentIcon(content.content_type)}</span>
                        </div>
                      );
                    };
                    
                    return (
                      <div
                        key={content.id}
                        onClick={() => handleContentToggle(content.id)}
                        className={`p-2 border rounded cursor-pointer transition-all relative ${
                          formData.content_ids.includes(content.id)
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-300 hover:border-blue-300 hover:shadow'
                        }`}
                      >
                        {/* Thumbnail */}
                        {renderThumbnail()}
                        
                        {/* Content Info */}
                        <div className="mt-1.5">
                          <h4 className="font-medium text-xs line-clamp-1" title={content.title}>
                            {content.title}
                          </h4>
                          <p className="text-[10px] text-gray-500 uppercase mt-0.5">
                            {content.content_type}
                          </p>
                        </div>
                        
                        {/* Checkbox */}
                        <div className="absolute top-1 right-1">
                          <input
                            type="checkbox"
                            checked={formData.content_ids.includes(content.id)}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 text-blue-600 rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {formData.content_ids.length} item(s) selected
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                disabled={loading}
              >
                {loading ? 'Scheduling...' : 'Schedule Session'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/head/dashboard')}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ScheduleSession;
