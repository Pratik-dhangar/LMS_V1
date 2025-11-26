import React from 'react';
import Whiteboard from '../../components/common/Whiteboard';

const WhiteboardSection = ({
  whiteboardService,
  isTrainer,
  canvasItems,
  setCanvasItems,
  keyboardMode,
  keyboardText,
  setKeyboardText,
  keyboardPosition,
  setKeyboardPosition,
  isFrozen,
  learnerSelectedItemId,
  textMessages,
  setTextMessages,
  handleToolClick,
  sessionNotes,
  handleNotesChange,
  messages,
  currentMessage,
  setCurrentMessage,
  sendMessage,
  handleSaveSession
}) => {
  return (
    <div className="min-h-[450px] relative">
      {/* Whiteboard component - keep logic intact */}
      <Whiteboard
        whiteboardService={whiteboardService}
        isTrainer={isTrainer}
        canvasItems={canvasItems}
        setCanvasItems={setCanvasItems}
        keyboardMode={keyboardMode}
        keyboardText={keyboardText}
        setKeyboardText={setKeyboardText}
        keyboardPosition={keyboardPosition}
        setKeyboardPosition={setKeyboardPosition}
        isFrozen={isFrozen}
        learnerSelectedItemId={learnerSelectedItemId}
        textMessages={textMessages}
        setTextMessages={setTextMessages}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 p-4 bg-gray-200 rounded mt-4">
        <div className="text-xs font-semibold mb-2 text-slate-800 w-full">🛠️ Whiteboard Tools</div>

        {/* Learner Tool Access Controls */}
        <div className="bg-blue-50 p-2 rounded mb-2 border-2 border-blue-400 w-full">
          <div className="text-[10px] font-semibold mb-2 text-blue-800">👥 Learner Tool Access (Toggle ON/OFF)</div>

          {/* Select Tool Access */}
          <div className="flex justify-between items-center mb-2 py-1 px-2 bg-white rounded">
            <span className="text-xs">✋ Select (Learner can select items)</span>
            <button
              onClick={() => handleToolClick('✋ Select')}
              className="bg-blue-500 text-white border-none px-3 py-1 rounded-xl text-[10px] font-bold cursor-pointer min-w-[50px]"
            >
              TOGGLE
            </button>
          </div>

          {/* Drag Tool Access */}
          <div className="flex justify-between items-center mb-2 py-1 px-2 bg-white rounded">
            <span className="text-xs">↔️ Drag (Learner can move items)</span>
            <button
              onClick={() => handleToolClick('↔️ Drag')}
              className="bg-blue-500 text-white border-none px-3 py-1 rounded-xl text-[10px] font-bold cursor-pointer min-w-[50px]"
            >
              TOGGLE
            </button>
          </div>

          {/* Keyboard Tool Trigger */}
          <div className="flex justify-between items-center py-1 px-2 bg-white rounded">
            <span className="text-xs">⌨️ Keyboard (Trigger for learner)</span>
            <button
              onClick={() => handleToolClick('⌨️ Keyboard')}
              className="bg-blue-500 text-white border-none px-3 py-1 rounded text-[10px] font-bold cursor-pointer"
            >
              TRIGGER
            </button>
          </div>
        </div>

        {/* Other Trainer Tools */}
        <div className="text-[10px] font-semibold mb-2 text-slate-800 w-full">🎨 Trainer Tools (Click to use)</div>
        <div className="flex flex-wrap gap-2">
          {['⏸️ Pause', '❄️ Freeze', '🗑️ Clear', '🔀 Shuffle', '⏱️ Timer', '⏲️ Stopwatch', '👍 Good Job!', '🌟 Wow!', '💪 Doing Well', '🙏 Thank You', '❤️ Loved it', '📈 Can Better', '😌 Relax', '🫧 Bubbles', '😊 Smileys', '🎈 Balloons', '⭐ Stars', '⏳ Wait'].map((t, i) => {
            const parts = t.split(' ');
            const emoji = parts.shift();
            const label = parts.join(' ');
            return (
              <div key={i} className="w-20 h-20 bg-white border-2 border-gray-300 rounded-lg flex flex-col items-center justify-center text-xs text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md p-1" onClick={() => handleToolClick(t)}>
                <span className="emoji-fallback text-2xl leading-none">{emoji}</span>
                <span className="mt-1 text-[10px]">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Session notes */}
        <div className="border-2 border-gray-300 p-4 my-4 rounded bg-gray-50 w-full">
          <div className="font-semibold text-slate-800 mb-2 text-base">📝 Session Notes</div>
          <textarea
            className="w-full p-2 rounded mt-1 text-xs text-gray-800 min-h-[80px] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={sessionNotes}
            onChange={handleNotesChange}
            placeholder="Write session notes here..."
          />
        </div>

        {/* Message box */}
        <div className="border-2 border-gray-300 p-4 mt-2 rounded bg-gray-50 w-full">
          <div className="font-semibold text-slate-800 mb-2 text-base">💬 Message Box</div>
          <div className="max-h-[150px] overflow-y-auto mb-2">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.sender === 'trainer' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                <strong>{msg.sender}:</strong> {msg.text}
                <div className="text-[9px] text-gray-500 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type message..."
              className="flex-1 p-2 border border-gray-300 rounded text-xs"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-blue-500 text-white border-none rounded cursor-pointer hover:bg-blue-600"
            >
              Send
            </button>
          </div>
        </div>

        <div className="text-right mt-4 w-full">
          <button className="bg-green-600 text-white px-8 py-3 rounded inline-flex items-center gap-2 text-base cursor-pointer hover:bg-green-700" onClick={handleSaveSession}>
            💾 Save Session
            <span className="text-[10px] font-normal opacity-90">(Saves: Name, Date, Time, Video, Notes, Prompts)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteboardSection;
