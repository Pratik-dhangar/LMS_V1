import React from 'react';
import Whiteboard from '../../components/common/Whiteboard';
import Emoji from '../../components/common/Emoji';


const WhiteboardSection = ({
  whiteboardService,
  isTrainer,
  canvasItems,
  setCanvasItems,
  isFrozen,
  learnerSelectedItemIds,
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
        isFrozen={isFrozen}
        learnerSelectedItemIds={learnerSelectedItemIds}
        textMessages={textMessages}
        setTextMessages={setTextMessages}
      />

      {/* Toolbar */}
      <div className="p-4 bg-gray-200 rounded mt-4">
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px', color: '#1a202c' }}><Emoji emoji="🛠️" size="sm" /> Whiteboard Tools</div>

        {/* Learner Tool Access Controls */}
        <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '2px solid #3b82f6' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '16px', color: '#1e40af' }}><Emoji emoji="👥" size="sm" /> Learner Tool Access & Exercise Tools</div>

          {/* Select Tool */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '8px 12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d1d5db' }}>
            <span style={{ fontSize: '12px' }}><Emoji emoji="✋" size="sm" /> Select</span>
            <button onClick={() => handleToolClick('✋ Select')} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>TOGGLE</button>
          </div>

          {/* Drag Tool */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '8px 12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d1d5db' }}>
            <span style={{ fontSize: '12px' }}><Emoji emoji="↔️" size="sm" /> Drag</span>
            <button onClick={() => handleToolClick('↔️ Drag')} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>TOGGLE</button>
          </div>

          {/* EXERCISE TOOL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}><Emoji emoji="💡" size="sm" /> Exercise</div>
              <div style={{ fontSize: '11px', color: '#4b5563' }}>Create Q&A exercises with keyword validation</div>
            </div>
            <button onClick={() => handleToolClick('💡 Exercise')} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '16px', whiteSpace: 'nowrap' }}><Emoji emoji="✨" size="sm" /> CREATE</button>
          </div>

          {/* FILL IN THE BLANKS TOOL - SIMPLE AND DIRECT */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#dcfce7', borderRadius: '8px', border: '2px solid #22c55e', marginBottom: '0' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#166534', marginBottom: '4px' }}><Emoji emoji="📝" size="sm" /> Fill in the Blanks</div>
              <div style={{ fontSize: '11px', color: '#4b5563' }}>Create interactive exercises</div>
            </div>
            <button onClick={() => handleToolClick('📝 Fill Blanks')} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '16px', whiteSpace: 'nowrap' }}><Emoji emoji="✨" size="sm" /> CREATE</button>
          </div>
        </div>

        {/* Other Trainer Tools */}
        <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '12px', color: '#1a202c' }}><Emoji emoji="🎨" size="sm" /> Trainer Tools (Click to use)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['⏸️ Pause', '❄️ Freeze', '🗑️ Clear', '🔀 Shuffle', '⏱️ Timer', '⏲️ Stopwatch', '👍 Good Job!', '🌟 Wow!', '💪 Doing Well', '🙏 Thank You', '❤️ Loved it', '📈 Can Better', '😌 Relax', '🫧 Bubbles', '😊 Smileys', '🎈 Balloons', '⭐ Stars', '⏳ Wait'].map((t, i) => {
            const parts = t.split(' ');
            const emoji = parts.shift();
            const label = parts.join(' ');
            return (
              <div key={i} style={{ width: '80px', height: '80px', backgroundColor: 'white', border: '2px solid #d1d5db', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '12px', textAlign: 'center', cursor: 'pointer', padding: '8px' }} onClick={() => handleToolClick(t)}>
                <Emoji emoji={emoji} size="2xl" />
                <span style={{ marginTop: '6px', fontSize: '10px' }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Session notes */}
        <div style={{ border: '2px solid #d1d5db', padding: '16px', marginTop: '16px', marginBottom: '16px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
          <div style={{ fontWeight: 'bold', color: '#1a202c', marginBottom: '8px' }}><Emoji emoji="📝" size="sm" /> Session Notes</div>
          <textarea style={{ width: '100%', padding: '8px', borderRadius: '6px', fontSize: '12px', color: '#1f2937', minHeight: '80px', border: '1px solid #d1d5db', outline: 'none' }} value={sessionNotes} onChange={handleNotesChange} placeholder="Write session notes here..." />
        </div>

        {/* Message box */}
        <div style={{ border: '2px solid #d1d5db', padding: '16px', marginTop: '8px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
          <div style={{ fontWeight: 'bold', color: '#1a202c', marginBottom: '8px' }}><Emoji emoji="💬" size="sm" /> Message Box</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '8px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.sender === 'trainer' ? 'message-bubble-sent' : 'message-bubble-received'}`}>
                <strong>{msg.sender}:</strong> {msg.text}
                <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type message..." style={{ flex: '1', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
            <button onClick={sendMessage} style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Send</button>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <button style={{ backgroundColor: '#16a34a', color: 'white', padding: '12px 32px', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '16px', cursor: 'pointer' }} onClick={handleSaveSession}>
            💾 Save Session
            <span style={{ fontSize: '10px', fontWeight: 'normal', opacity: '0.9' }}>(Saves: Name, Date, Time, Video, Notes, Prompts)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhiteboardSection;
