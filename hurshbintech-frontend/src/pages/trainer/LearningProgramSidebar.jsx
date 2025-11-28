import React from 'react';
import { FaMicrophone } from 'react-icons/fa';

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
    <div className="bg-gray-50 border-2 border-gray-300 p-4 rounded h-fit max-h-[90vh] overflow-y-auto session-sidebar">
      <div className="bg-blue-500 text-white font-semibold p-2 -mx-4 -mt-4 mb-4 rounded-t">
        📋 Learning Program
      </div>

      <div className="bg-white border-2 border-blue-500 p-3 rounded mb-5 flex items-center">
        <input
          type="text"
          className="flex-1 bg-gray-100 px-2 py-2 rounded text-xs border-none outline-none mr-2"
          placeholder="🔍 Search Child Name / IIP..."
          value={learningProgramSearch}
          onChange={handleLearningProgramSearch}
        />
      </div>

      <div className="bg-gray-50 p-2 rounded mb-4">
        <div className="text-xs font-semibold mb-2 text-slate-800">
          Selected: {sessionInfo?.learner_name ?? '—'} {sessionInfo?.iip_id ? `- ${sessionInfo.iip_id}` : ''}
        </div>
      </div>

      <div className="text-sm font-semibold mb-2">Program Items</div>
      <div className="max-h-[200px] overflow-y-auto mb-4">
        {filteredLearningGoals.length > 0 ? (
          filteredLearningGoals.map((goal, index) => (
            <div key={goal.id ?? index} className="flex items-center gap-2 p-2 bg-white border border-gray-300 rounded my-1 text-xs">
              <input type="checkbox" className="w-4 h-4" />
              <div className="flex-1">{index + 1}. {goal.goal}</div>
              <div className="bg-gray-200 px-2 py-1 rounded font-semibold min-w-[30px] text-center cursor-pointer" title="Click to record prompt level">—</div>
            </div>
          ))
        ) : <div className="text-xs text-gray-500 italic">No matching program items found.</div>
        }
      </div>

      <div className="text-sm font-semibold mt-4 mb-2">📊 Prompt Meter</div>
      <div className="bg-white border-2 border-blue-500 rounded p-2 mb-4">
        <div className="flex flex-wrap gap-1 justify-center">
          {['I', '10', '20', '30', '40', '50', '60', '70', '80', '90'].map((p) => (
            <div
              key={p}
              className={`${selectedPromptLevel === p ? 'bg-blue-600' : 'bg-green-600'} text-white px-2 py-2 rounded font-semibold text-xs cursor-pointer min-w-[35px] text-center hover:bg-green-700`}
              onClick={() => {
                setSelectedPromptLevel(p);
                webRTC && webRTC.sendPromptMeter(p);
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 mt-2 text-center">Click to record prompt level for selected item</div>
        {selectedPromptLevel && (
          <div className="text-xs font-semibold text-center mt-2 text-blue-600">
            Selected: {selectedPromptLevel}
          </div>
        )}
      </div>

      <div className="text-sm font-semibold mb-2">🎯 Reinforcement Meter</div>
      <div className="bg-white border-2 border-green-600 rounded p-2 mb-4">
        <div className="flex flex-wrap gap-1 justify-center">
          {['Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'].map((r) => (
            <div
              key={r}
              className={`${selectedReinforcementLevel === r ? 'bg-blue-600' : 'bg-green-600'} text-white px-2 py-2 rounded font-semibold text-xs cursor-pointer min-w-[40px] text-center hover:bg-green-700`}
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
          <div className="text-xs font-semibold text-center mt-2 text-blue-600">
            Selected: {selectedReinforcementLevel}
          </div>
        )}
      </div>

      {/* Save Report Button */}
      {selectedProgramId && selectedPromptLevel && selectedReinforcementLevel && (
        <button
          onClick={onSaveReport}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm font-semibold mb-4 flex items-center justify-center gap-2"
        >
          💾 Save Session Report
        </button>
      )}
      {selectedProgramId && (!selectedPromptLevel || !selectedReinforcementLevel) && (
        <div className="text-xs text-orange-600 mb-4 text-center bg-orange-50 p-2 rounded border border-orange-200">
          ⚠️ Select both Prompt and Reinforcement levels to save report
        </div>
      )}

      {/* Speech Section */}
      <h3 className="text-base font-semibold mb-2">🎙️ Voice Input</h3>
      <button
        onClick={toggleListening}
        className={`${listening ? 'bg-red-500' : 'bg-green-500'} text-white border-none rounded-full w-[50px] h-[50px] text-lg cursor-pointer mb-2 flex justify-center items-center mx-auto hover:opacity-90`}
      >
        {listening ? "🔇" : <FaMicrophone />}
      </button>
      <p className="text-xs text-center text-gray-600 mb-2">
        {listening ? 'Recording... Click to stop' : 'Click to start recording'}
      </p>
      <div className="bg-white border border-gray-200 p-2 min-h-[60px] rounded whitespace-pre-wrap text-sm max-h-[150px] overflow-y-auto mb-2">
        {transcript || <span className="text-gray-400 italic">Your speech will appear here...</span>}
      </div>
      {transcript && !listening && (
        <button
          onClick={() => {
            if (whiteboardService && transcript.trim()) {
              console.log('[TrainerSession] ✅ Manually sending prompt to learner:', transcript);
              whiteboardService.send('prompt_update', {
                text: transcript.trim(),
                timestamp: Date.now()
              });
            }
          }}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm font-semibold mb-2"
        >
          📤 Send to Learner
        </button>
      )}
    </div>
  );
};

export default LearningProgramSidebar;
