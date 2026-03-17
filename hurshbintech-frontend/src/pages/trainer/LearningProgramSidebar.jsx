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
                border: '1px solid gray',
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

        {sessionInfo?.program?.name && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            margin: '4px auto',
            padding: '4px 8px',
            backgroundColor: '#fef3c7',
            borderLeft: '3px solid #d97706',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#92400e',
            fontWeight: '600',
          }}>
            <span>📁</span>
            <span>{sessionInfo.program.name}</span>
          </div>
        )}
        <div className="sidebar-section-title">Learning Goals</div>

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
            {['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'].map((p) => (
              <div
                key={p}
                className={`meter-button ${p === '0' || p === '100'
                  ? ''
                  : selectedPromptLevel === p ? 'meter-button-selected' : 'meter-button-green'
                  }`}
                style={
                  p === '0'
                    ? {
                      backgroundColor: selectedPromptLevel === '0' ? '#15803d' : '#16a34a',
                      borderColor: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }
                    : p === '100'
                      ? {
                        backgroundColor: selectedPromptLevel === '100' ? '#991b1b' : '#dc2626',
                        borderColor: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                      : {}
                }
                title={p === '0' ? 'No prompt needed (0)' : p === '100' ? 'Full prompt needed (100)' : `Prompt level ${p}`}
                onClick={() => {
                  const newValue = selectedPromptLevel === p ? null : p;
                  setSelectedPromptLevel(newValue);
                  webRTC && webRTC.sendPromptMeter(newValue);
                }}
              >
                {p === '0' ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <polyline
                      points="1.5,7 5.5,11 12.5,3"
                      stroke="#ffffff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : p === '100' ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                    <line x1="1" y1="1" x2="11" y2="11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="11" y1="1" x2="1" y2="11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                ) : p}
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
        {/* Save Report Button */}
        {selectedProgramId && selectedPromptLevel && (
          <button
            onClick={() => onSaveReport({
              programId: selectedProgramId,
              programName: selectedProgram?.goal || 'Unknown Program',
              promptMeter: selectedPromptLevel
            })}
            className="btn-primary w-60 ml-3.5"
          >
            💾 Save Learning Progress
          </button>
        )}

        <div className="sidebar-section-title"><Emoji emoji="🎯" size="base" /> Reinforcement Meter</div>
        <div className="meter-container meter-container-green">
          <div className="meter-buttons">
            {['Cross', '10', '20', '30', '40', '50', '60', '70', '80', '90', 'Tick'].map((r) => {
              const val = r === 'Cross' ? 0 : r === 'Tick' ? 100 : r;
              const isSelected = selectedReinforcementLevel === val;
              return (
                <div
                  key={r}
                  className={`meter-button ${r === 'Tick' || r === 'Cross' ? '' : isSelected ? 'meter-button-selected' : 'meter-button-green'}`}
                  style={
                    r === 'Tick'
                      ? { backgroundColor: isSelected ? '#15803d' : '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                      : r === 'Cross'
                        ? { backgroundColor: isSelected ? '#991b1b' : '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                        : {}
                  }
                  title={r === 'Tick' ? 'Full reinforcement (100)' : r === 'Cross' ? 'No reinforcement (0)' : `Reinforcement level ${r}`}
                  onClick={() => {
                    const newValue = isSelected ? null : val;
                    setSelectedReinforcementLevel(newValue);
                    webRTC && webRTC.sendReinforcementMeter(newValue);
                  }}
                >
                  {r === 'Tick' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                      <polyline points="1.5,7 5.5,11 12.5,3" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : r === 'Cross' ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                      <line x1="1" y1="1" x2="11" y2="11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                      <line x1="11" y1="1" x2="1" y2="11" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  ) : r}
                </div>
              );
            })}
          </div>

          {/* {selectedReinforcementLevel && (
            <div className="meter-selected-text">
              Selected: {selectedReinforcementLevel}
            </div>
          )} */}
        </div>




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
