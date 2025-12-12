import React from 'react';
import Emoji from '../../components/common/Emoji';
import { FaMicrophone } from 'react-icons/fa';
import '../../styles/LearningProgram.css';

const LearningProgramSidebar = ({
  learningProgramSearch,
  handleLearningProgramSearch,
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
  onSaveReport
}) => {
  // Get selected program name
  const selectedProgram = filteredLearningGoals.find(goal => goal.id === selectedProgramId);

  return (
    <div className="sidebar-container">
      <div className="sidebar-header sidebar-header-blue">
        📋 Learning Program
      </div>

      <div className="sidebar-search-box">
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="🔍 Search Child Name / IIP..."
          value={learningProgramSearch}
          onChange={handleLearningProgramSearch}
        />
      </div>

      <div className="sidebar-info-box">
        <div className="sidebar-info-text">
          Selected: {sessionInfo?.learner_name ?? '—'} {sessionInfo?.iip_id ? `- ${sessionInfo.iip_id}` : ''}
        </div>
      </div>

      <div className="sidebar-section-title">Program Items</div>
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
        ) : <div className="sidebar-empty-text">No matching program items found.</div>
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
                setSelectedPromptLevel(p);
                webRTC && webRTC.sendPromptMeter(p);
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <div className="meter-helper-text">Click to record prompt level for selected item</div>
        {selectedPromptLevel && (
          <div className="meter-selected-text">
            Selected: {selectedPromptLevel}
          </div>
        )}
      </div>

      <div className="sidebar-section-title"><Emoji emoji="🎯" size="base" /> Reinforcement Meter</div>
      <div className="meter-container meter-container-green">
        <div className="meter-buttons">
          {['Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((r) => (
            <div
              key={r}
              className={`meter-button ${selectedReinforcementLevel === r ? 'meter-button-selected' : 'meter-button-green'}`}
              onClick={() => {
                setSelectedReinforcementLevel(r);
                webRTC && webRTC.sendReinforcementMeter(r);
              }}
            >
              {r}
            </div>
          ))}
        </div>

        {selectedReinforcementLevel && (
          <div className="meter-selected-text">
            Selected: {selectedReinforcementLevel}
          </div>
        )}
      </div>

      {/* Save Report Button */}
      {selectedProgramId && selectedPromptLevel && selectedReinforcementLevel && (
        <button
          onClick={onSaveReport}
          className="btn-save-report"
        >
          💾 Save Session Report
        </button>
      )}
      {selectedProgramId && (!selectedPromptLevel || !selectedReinforcementLevel) && (
        <div className="sidebar-warning">
          ⚠️ Select both Prompt and Reinforcement levels to save report
        </div>
      )}

      {/* Speech Section */}
      <h3 className="sidebar-section-title">🎙️ Voice Input</h3>
      <button
        onClick={toggleListening}
        className={`voice-button ${listening ? 'voice-button-recording' : 'voice-button-idle'}`}
      >
        {listening ? "🔇" : <FaMicrophone />}
      </button>
      <p className="voice-status-text">
        {listening ? '🎤 Recording... Click to stop' : '📢 Click to start recording'}
      </p>
      <div className="transcript-box">
        {transcript || <span className="transcript-placeholder">Your speech will appear here...</span>}
      </div>
    </div>
  );
};

export default LearningProgramSidebar;
