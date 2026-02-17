import React, { useState, useEffect } from 'react';
import Emoji from '../../components/common/Emoji';
import { FaMicrophone } from 'react-icons/fa';
import '../../styles/LearningProgram.css';

const LearningProgramSidebar = ({
  sessionInfo,
  filteredLearningGoals,
  isSearching = false,
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

  // Debug log
  // console.log('[LearningProgramSidebar] Render:', {
  //   filteredLearningGoals: filteredLearningGoals.length,
  //   learningGoalsSearch,
  //   hasSetLearningGoalsSearch: !!setLearningGoalsSearch
  // });

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
      <div className="sidebar-header sidebar-header-gold">
        📋 Learning Program
      </div>

      <div className="sidebar-content">
        {/* Coach: Search input (only shown when setLearningGoalsSearch is provided) */}
        {setLearningGoalsSearch && (
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="🔍 Search programs..."
              value={learningGoalsSearch || ''}
              onChange={(e) => {
                const value = e.target.value;
                console.log('[LearningProgramSidebar] 🔍 Search changed to:', value);
                setLearningGoalsSearch(value);
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #4A90E2',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            {learningGoalsSearch && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                {isSearching ? (
                  '🔄 Searching database...'
                ) : (
                  `${filteredLearningGoals.length} program${filteredLearningGoals.length !== 1 ? 's' : ''} found`
                )}
              </div>
            )}
          </div>
        )}

        <div className="sidebar-section-title">Program Items</div>

        <div className="sidebar-scrollable">
          {isSearching ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
              <div>🔄 Searching programs...</div>
            </div>
          ) :
            (
              filteredLearningGoals.length > 0 ? (
                filteredLearningGoals.map((goal, index) => {
                  const goalText = goal.goal || goal.name || goal.title || 'Untitled';
                  return (
                    <div key={goal.id ?? index} className="sidebar-list-item">
                      <input
                        type="checkbox"
                        className="sidebar-checkbox"
                        checked={selectedProgramId === goal.id}
                        onChange={() => handleProgramCheck(goal.id)}
                      />
                      <div className="sidebar-item-text">{index + 1}. {goalText}</div>
                      <div className="sidebar-badge" title="Click to record prompt level">—</div>
                    </div>
                  );
                })
              ) : learningGoalsSearch ? (
                <div className="sidebar-empty-text" style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>
                  <div>🔍 No programs match "{learningGoalsSearch}"</div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>Try a different search term</div>
                </div>
              ) : null
            )}
        </div>

        <div className="sidebar-section-title" style={{ marginTop: '1rem' }}>📊 Prompt Meter</div>
        <div className="meter-container meter-container-gold">
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
            onClick={() => onSaveReport({
              programId: selectedProgramId,
              programName: selectedProgram?.goal || 'Unknown Program',
              promptMeter: selectedPromptLevel,
              reinforcementMeter: selectedReinforcementLevel
            })}
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
