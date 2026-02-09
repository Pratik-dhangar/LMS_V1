import React, { useState, useEffect } from 'react';
import Emoji from '../../components/common/Emoji';
import { FaMicrophone } from 'react-icons/fa';
import '../../styles/LearningProgram.css';

const LearningProgramSidebar = ({
  sessionInfo,
  filteredLearningGoals,
  selectedPromptLevel,
  setSelectedPromptLevel,
  selectedReinforcementLevel,
  setSelectedReinforcementLevel,
  selectedProgramId,
  handleProgramCheck,
  webRTC,
  toggleListening,
  listening,
  transcript,
  whiteboardService,
  onSaveReport,
  learningGoalsSearch,
  setLearningGoalsSearch
}) => {
  // Get selected program name
  const selectedProgram = filteredLearningGoals.find(goal => goal.id === selectedProgramId);
  // State for editable transcript
  const [editableTranscript, setEditableTranscript] = useState(transcript || '');

  // Sync transcript from speech input to editable field
  useEffect(() => {
    if (transcript && transcript !== editableTranscript) {
      setEditableTranscript(transcript);
    }
  }, [transcript]);

  const handleSendPromptToLearner = () => {
    const textToSend = editableTranscript || transcript;
    if (textToSend) {
      webRTC && webRTC.sendPrompt(textToSend);
    }
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-header sidebar-header-blue">
        📋 Learning Program
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section-title">Program Items</div>

        {/* Coach: Search input (only shown when setLearningGoalsSearch is provided) */}
        {setLearningGoalsSearch && (
          <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0e0e0' }}>
            <input
              type="text"
              placeholder="🔍 Search programs..."
              value={learningGoalsSearch || ''}
              onChange={(e) => setLearningGoalsSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        <div className="sidebar-scrollable">
          {filteredLearningGoals.length > 0 ? (
            filteredLearningGoals.map((goal, index) => (
              <div key={goal.id ?? index} className="sidebar-list-item">
                <input
                  type="checkbox"
                  className="sidebar-checkbox"
                  checked={selectedProgramId === goal.id}
                  onChange={() => handleProgramCheck(goal.id)}
                />
                <div className="sidebar-item-text">{index + 1}. {goal.goal}</div>
                <div className="sidebar-badge" title="Click to record prompt level">—</div>
              </div>
            ))
          ) : <div className="sidebar-empty-text"></div>
          }
        </div>

        <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>📊 Prompt Meter</div>
        <div className="meter-container meter-container-blue">
          <div className="meter-buttons">
            {['I', '10', '20', '30', '40', '50', '60', '70', '80', '90'].map((p) => (
              <div
                key={p}
                className={`meter-button ${selectedPromptLevel === p ? 'meter-button-selected' : 'meter-button-green'}`}
                onClick={() => {
                  const newValue = selectedPromptLevel === p ? null : p;
                  setSelectedPromptLevel(newValue);
                  webRTC && webRTC.sendPromptMeter(newValue);
                }}
              >
                {p}
              </div>
            ))}
          </div>
          {/* <div className="meter-helper-text">Click to record prompt level for selected item</div> */}
          {/* {selectedPromptLevel && (
            <div className="meter-selected-text">
              Selected: {selectedPromptLevel}
            </div>
          )} */}
        </div>

        <div className="sidebar-section-title"><Emoji emoji="🎯" size="base" /> Reinforcement Meter</div>
        <div className="meter-container meter-container-green">
          <div className="meter-buttons">
            {['Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((r) => (
              <div
                key={r}
                className={`meter-button ${selectedReinforcementLevel === r ? 'meter-button-selected' : 'meter-button-green'}`}
                onClick={() => {
                  const newValue = selectedReinforcementLevel === r ? null : r;
                  setSelectedReinforcementLevel(newValue);
                  webRTC && webRTC.sendReinforcementMeter(newValue);
                }}
              >
                {r}
              </div>
            ))}
          </div>

          {/* {selectedReinforcementLevel && (
            <div className="meter-selected-text">
              Selected: {selectedReinforcementLevel}
            </div>
          )} */}
        </div>

        {/* Save Report Button */}
        {selectedProgramId && selectedPromptLevel && selectedReinforcementLevel && (
          <button
            onClick={onSaveReport}
            className="btn-primary w-50 ml-3.5"
          >
            💾 Save Session Report
          </button>
        )}


        {/* Speech Section */}
        <div className="voice-section">
          <h3 className="sidebar-section-title">🎙️ Voice Input</h3>
          <button
            onClick={toggleListening}
            className={`voice-button ${listening ? 'voice-button-recording' : 'voice-button-idle'}`}
          >
            {listening ? "🔇" : <FaMicrophone />}
          </button>
          {/* <p className="voice-status-text">
            {listening ? '🎤 Recording... Click to stop' : '📢 Click to start recording'}
          </p> */}
          <textarea
            value={editableTranscript || transcript || ''}
            onChange={(e) => setEditableTranscript(e.target.value)}
            // placeholder="Your speech will appear here... You can also edit it manually."
            style={{
              width: '100%',
              padding: '10px',
              minHeight: '80px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box',
              backgroundColor: '#fff',
              color: '#000',
              cursor: 'text'
            }}
          />
          <button
            onClick={handleSendPromptToLearner}
            disabled={!editableTranscript && !transcript}
            className="btn-send-to-learner"
          >
            ✈️ Send to Learner
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningProgramSidebar;
