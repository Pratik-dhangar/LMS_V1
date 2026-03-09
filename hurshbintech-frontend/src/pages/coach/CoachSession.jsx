// CoachSession.jsx - Coach Live Session Interface
// Uses shared InstructorSessionPage component and custom hooks
// Manages Client connections with Learning Goals support

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachSessionService from '../../api/services/coachSessionService';
import learningGoalsService from '../../api/services/learningGoalsService';
import sessionReportService from '../../api/services/sessionReportService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import useVoiceInput from '../../hooks/useVoiceInput';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { useMediaControl } from '../../context/MediaControlContext';
import useInstructorSessionState from '../../hooks/useInstructorSessionState';
import useInstructorHandlers from '../../hooks/useInstructorHandlers';
import useInstructorEffects from '../../hooks/useInstructorEffects';
import LearningProgramSidebar from '../trainer/LearningProgramSidebar';

import { clearSessionActivity } from '../../utils/sessionActivityTracker';
import {
  WB_BUTTON_STYLES,
  MUSIC_OPTIONS,
  getWSBaseURL,
  initializeWhiteboardService,
  initializeToolsService,
  cleanupSessionResources,
  InstructorSessionPage,
} from '../../components/session/InstructorSessionLayout';
import '../../styles/session.css';

const WS_BASE_URL = getWSBaseURL();

const CoachSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Custom hooks for state, handlers, and effects
  const state = useInstructorSessionState('coach');
  const stopwatch = useStopwatch();
  const mediaControl = useMediaControl();
  const { toggleListening, listening, transcript } = useVoiceInput();
  const { pageClassName, navbarClassName } = useAutoHideNavbar();

  // Admit/reject state for client join requests
  const [pendingAdmission, setPendingAdmission] = useState(null);

  // Cleanup function
  const cleanup = () => {
    cleanupSessionResources({
      videoService: state.videoService,
      whiteboardService: state.whiteboardService,
      toolsService: state.toolsService,
      recordingService: null,
      secondaryVideoService: null,
      isInitializingRef: state.isInitializingRef,
    });
    state.timersRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.timersRef.current.clear();
    state.stopwatchesRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.stopwatchesRef.current.clear();
    clearSessionActivity(sessionId, 'coach');
  };

  // Initialize WebRTC for Client
  const initializeWebRTC = async (numericSessionId) => {
    if (state.isInitializingRef.current) return;
    state.isInitializingRef.current = true;

    // Initialize Whiteboard
    const wbService = initializeWhiteboardService({
      wsBaseUrl: WS_BASE_URL,
      sessionId,
      role: 'coach',
      setBuckets: state.setBuckets,
      setFloatingAnimations: state.setFloatingAnimations,
      setErasePenTrigger: state.setErasePenTrigger,
      setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    });

    if (wbService) {
      state.setWhiteboardService(wbService);
      const tbService = initializeToolsService(wbService);
      state.setToolsService(tbService);
    }

    // Initialize Client Video Conference
    const clientVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'coach');

    try {
      clientVideoService.onLocalStream = (stream) => state.setLocalStream(stream);
      clientVideoService.onRemoteStream = (stream) => {
        state.setRemoteStream(stream);
        if (!state.connectedRef.current) {
          state.connectedRef.current = true;
          toast.success(`${state.sessionInfo?.client_name || 'Client'} has joined the session`);
        }
      };

      clientVideoService.onConnectionStateChange = (stateStr) => {
        const statusMap = {
          'new': 'connecting', 'connecting': 'connecting', 'connected': 'connected',
          'disconnected': 'disconnected', 'failed': 'failed', 'closed': 'disconnected',
        };
        state.setConnectionStatus(statusMap[stateStr] || stateStr);

        if ((stateStr === 'disconnected' || stateStr === 'closed') && state.connectedRef.current) {
          toast.info(`${state.sessionInfo?.client_name || 'Client'} has left the session`);
          state.setRemoteStream(null);
          state.connectedRef.current = false;
        }
      };

      clientVideoService.onError = (error) => {
        toast.error(`Video error: ${error.message}`);
      };

      clientVideoService.onParticipantJoinRequest = () => {
        const clientName = state.sessionInfo?.client_name || 'Client';
        setPendingAdmission({ name: clientName });
      };

      await clientVideoService.initialize();
      state.setVideoService(clientVideoService);

      state.setMicEnabled(clientVideoService.isMicrophoneEnabled());
      state.setCameraEnabled(clientVideoService.isCameraEnabled());
    } catch (error) {
      toast.error('Failed to initialize video conference');
    }
  };

  // Admission modal handlers (coach)
  const handleAdmitClient = () => {
    setPendingAdmission(null);
    if (state.videoService) state.videoService.admitParticipant();
  };

  const handleRejectClient = () => {
    setPendingAdmission(null);
    if (state.whiteboardService) {
      state.whiteboardService.send('waiting_message', { text: '__ADMISSION_REJECTED__' });
    }
  };

  // Remove client/guest from ongoing session
  const handleRemoveClient = () => {
    const clientName = state.sessionInfo?.client_name || 'Guest';
    if (window.confirm(`Exit ${clientName} from the session?`)) {
      state.whiteboardService?.send('waiting_message', { text: '__REMOVED_FROM_SESSION__' });
      toast.info(`${clientName} has been removed from the session`);
    }
  };

  // Load Learning Goals (Coach-specific)
  useEffect(() => {
    const loadLearningGoals = async () => {
      if (!state.sessionInfo?.client_id) return;
      try {
        const goals = await learningGoalsService.getClientGoals(state.sessionInfo.client_id);
        state.setLearningGoals(goals || []);
        state.setFilteredLearningGoals(goals || []);
      } catch (error) {
        console.error('[CoachSession] Failed to load learning goals:', error);
        state.setLearningGoals([]);
        state.setFilteredLearningGoals([]);
      }
    };
    loadLearningGoals();
  }, [state.sessionInfo]);

  // Update learning goal (Coach-specific)
  const handleGoalUpdate = async (goalId, updateData) => {
    try {
      await learningGoalsService.updateGoal(goalId, updateData);
      state.setLearningGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updateData } : g));
      state.setFilteredLearningGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updateData } : g));
      toast.success('Learning goal updated');
    } catch (error) {
      toast.error('Failed to update learning goal');
    }
  };

  // Use custom hooks for handlers and effects
  const handlers = useInstructorHandlers({
    role: 'coach',
    sessionId,
    videoService: state.videoService,
    observerRTC: null,
    whiteboardService: state.whiteboardService,
    sessionNotes: state.sessionNotes,
    buckets: state.buckets,
    bucketColor: state.bucketColor,
    whiteboardCanvasRef: state.whiteboardCanvasRef,
    isFrozen: state.isFrozen,
    floatingAnimations: state.floatingAnimations,
    toolAccess: state.toolAccess,
    audioRef: state.audioRef,
    musicOptions: MUSIC_OPTIONS,
    selectedMusic: state.selectedMusic,
    backgroundMusicPlaying: state.backgroundMusicPlaying,
    musicVolume: state.musicVolume,
    sessionService: coachSessionService,
    navigate,
    cleanup,
    setMicEnabled: state.setMicEnabled,
    setCameraEnabled: state.setCameraEnabled,
    setIsFrozen: state.setIsFrozen,
    setSessionNotes: state.setSessionNotes,
    setFloatingAnimations: state.setFloatingAnimations,
    setYoutubePopups: state.setYoutubePopups,
    setExerciseData: state.setExerciseData,
    setToolAccess: state.setToolAccess,
    setBuckets: state.setBuckets,
    setErasePenTrigger: state.setErasePenTrigger,
    setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    setTool: state.setTool,
    setActiveIcons: state.setActiveIcons,
    setFeedbackMessage: state.setFeedbackMessage,
    setWaitingMessage: state.setWaitingMessage,
    setShowExercise: state.setShowExercise,
    isWaitActive: state.isWaitActive,
    setIsWaitActive: state.setIsWaitActive,
    setBackgroundMusicPlaying: state.setBackgroundMusicPlaying,
    setSelectedMusic: state.setSelectedMusic,
    setMusicVolume: state.setMusicVolume,
    setLearningContentSearch: state.setLearningContentSearch,
    setDatabaseSearchResults: state.setDatabaseSearchResults,
    setIsSearching: state.setIsSearching,
    setSelectedProgramId: state.setSelectedProgramId,
    setShowHeader: state.setShowHeader,
  });

  // Use effects hook
  useInstructorEffects({
    role: 'coach',
    sessionId,
    sessionInfo: state.sessionInfo,
    sessionNotes: state.sessionNotes,
    whiteboardService: state.whiteboardService,
    remoteStream: state.remoteStream,
    remoteVideoRef: state.remoteVideoRef,
    stopwatch,
    lastSyncTimeRef: state.lastSyncTimeRef,
    mediaWasVisibleRef: state.mediaWasVisibleRef,
    mediaControl,
    learningContentSearch: state.learningContentSearch,
    learningGoalsSearch: state.learningGoalsSearch,
    restrictionAlertShownRef: state.restrictionAlertShownRef,
    floatingAnimations: state.floatingAnimations,
    setSessionInfo: state.setSessionInfo,
    setLoading: state.setLoading,
    setSessionNotes: state.setSessionNotes,
    setTimeLeft: state.setTimeLeft,
    setRemoteSelectedItemIds: state.setRemoteSelectedItemIds,
    setFloatingAnimations: state.setFloatingAnimations,
    setExerciseData: state.setExerciseData,
    setBuckets: state.setBuckets,
    setErasePenTrigger: state.setErasePenTrigger,
    setRedrawCanvasTrigger: state.setRedrawCanvasTrigger,
    setShowStopwatch: state.setShowStopwatch,
    setDatabaseSearchResults: state.setDatabaseSearchResults,
    setIsSearching: state.setIsSearching,
    setFilteredLearningGoals: state.setFilteredLearningGoals,
    setDatabaseGoalsSearchResults: state.setDatabaseGoalsSearchResults,
    setIsSearchingGoals: state.setIsSearchingGoals,
    sessionService: coachSessionService,
    initializeWebRTC,
    cleanup,
    handleEndSession: handlers.handleEndSession,
  });

  // Loading state
  if (state.loading) {
    return (
      <div className="loading-container">
        <div className="session-loader"></div>
      </div>
    );
  }

  // Render session page
  const filteredLearningContent = state.learningContentSearch.trim()
    ? state.databaseSearchResults
    : (state.sessionInfo?.learning_contents || []);

  // For learning goals: show database search results when searching, otherwise show session goals
  const displayedLearningGoals = state.learningGoalsSearch.trim()
    ? state.databaseGoalsSearchResults
    : state.filteredLearningGoals;

  // Handle save session report for Coach
  const handleSaveReport = async (reportData) => {
    try {
      console.log('[CoachSession] Saving session report:', reportData);
      await sessionReportService.create({
        session_id: parseInt(sessionId),
        learner_id: state.sessionInfo?.learner_id,
        program_id: reportData.programId || null,
        program_name: reportData.programName,
        prompt_meter: reportData.promptMeter,
      });
      toast.success('Session report saved successfully!');
    } catch (error) {
      console.error('[CoachSession] Error saving report:', error);
      toast.error('Failed to save session report');
    }
  };

  const wbBtnBase = WB_BUTTON_STYLES.base;
  const wbBtnActive = WB_BUTTON_STYLES.active;
  const wbSmallBtnBase = WB_BUTTON_STYLES.smallBase;
  const wbSmallBtnActive = WB_BUTTON_STYLES.smallActive;

  return (
    <>
      {/* Client admission modal */}
      {pendingAdmission && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '36px 32px', maxWidth: '420px', width: '92%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>Client Wants to Join</h2>
            <p style={{ color: '#555', marginBottom: '28px', fontSize: '15px' }}>
              <strong>{pendingAdmission.name}</strong> is requesting to join this session.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              <button
                onClick={handleAdmitClient}
                style={{ padding: '10px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
              >
                ✅ Admit
              </button>
              <button
                onClick={handleRejectClient}
                style={{ padding: '10px 28px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      )}
      <InstructorSessionPage
        role="coach"
        participantName="Client"
        participantType="client"
        pageClassName={pageClassName}
        navbarClassName={navbarClassName}
        showHeader={state.showHeader}
        showInfoBar={state.showInfoBar}
        setShowInfoBar={state.setShowInfoBar}
        sessionInfo={state.sessionInfo}
        connectionStatus={state.connectionStatus}
        timeLeft={state.timeLeft}
        micEnabled={state.micEnabled}
        cameraEnabled={state.cameraEnabled}
        handleToggleMic={handlers.handleToggleMic}
        handleToggleCamera={handlers.handleToggleCamera}
        handleFreeze={handlers.handleFreeze}
        handleRemoveParticipant={handleRemoveClient}
        handleEndSession={handlers.handleEndSession}
        eraseAllPen={handlers.eraseAllPen}
        addBucket={handlers.addBucket}
        isFrozen={state.isFrozen}
        localStream={state.localStream}
        remoteStream={state.remoteStream}
        remoteVideoRef={state.remoteVideoRef}
        audioRef={state.audioRef}
        whiteboardService={state.whiteboardService}
        whiteboardCanvasRef={state.whiteboardCanvasRef}
        canvasItems={state.canvasItems}
        setCanvasItems={state.setCanvasItems}
        remoteSelectedItemIds={state.remoteSelectedItemIds}
        feedbackMessage={state.feedbackMessage}
        waitingMessage={state.waitingMessage}
        floatingAnimations={state.floatingAnimations}
        setFloatingAnimations={state.setFloatingAnimations}
        handleAnimationPop={handlers.handleAnimationPop}
        tool={state.tool}
        setTool={state.setTool}
        color={state.color}
        setColor={state.setColor}
        lineWidth={state.lineWidth}
        setLineWidth={state.setLineWidth}
        buckets={state.buckets}
        setBuckets={state.setBuckets}
        bucketColor={state.bucketColor}
        setBucketColor={state.setBucketColor}
        toolActive={state.toolActive}
        setToolActive={state.setToolActive}
        eraserActive={state.eraserActive}
        setEraserActive={state.setEraserActive}
        eraseAllActive={state.eraseAllActive}
        setEraseAllActive={state.setEraseAllActive}
        clearCanvasTrigger={state.clearCanvasTrigger}
        setClearCanvasTrigger={state.setClearCanvasTrigger}
        erasePenTrigger={state.erasePenTrigger}
        redrawCanvasTrigger={state.redrawCanvasTrigger}
        toolAccess={state.toolAccess}
        toggleToolAccess={handlers.toggleToolAccess}
        showExercise={state.showExercise}
        setShowExercise={state.setShowExercise}
        exerciseData={state.exerciseData}
        handleExerciseSubmit={handlers.handleExerciseSubmit}
        handleExerciseUpdate={handlers.handleExerciseUpdate}
        handleExerciseDelete={handlers.handleExerciseDelete}
        handleExerciseAnswerChange={handlers.handleExerciseAnswerChange}
        showStopwatch={state.showStopwatch}
        setShowStopwatch={state.setShowStopwatch}
        stopwatch={stopwatch}
        musicOptions={MUSIC_OPTIONS}
        toggleBackgroundMusic={handlers.toggleBackgroundMusic}
        selectedMusic={state.selectedMusic}
        backgroundMusicPlaying={state.backgroundMusicPlaying}
        musicVolume={state.musicVolume}
        handleMusicVolumeChange={handlers.handleMusicVolumeChange}
        sessionNotes={state.sessionNotes}
        handleNotesChange={handlers.handleNotesChange}
        handleClearNotes={handlers.handleClearNotes}
        learningContentSearch={state.learningContentSearch}
        handleLearningContentSearch={handlers.handleLearningContentSearch}
        filteredLearningContent={filteredLearningContent}
        isSearching={state.isSearching}
        onDragStartContent={handlers.onDragStartContent}
        filteredLearningGoals={state.filteredLearningGoals}
        selectedPromptLevel={state.selectedPromptLevel}
        setSelectedPromptLevel={state.setSelectedPromptLevel}
        selectedReinforcementLevel={state.selectedReinforcementLevel}
        setSelectedReinforcementLevel={state.setSelectedReinforcementLevel}
        selectedProgramId={state.selectedProgramId}
        handleProgramCheck={handlers.handleProgramCheck}
        webRTC={state.videoService}
        toggleListening={toggleListening}
        listening={listening}
        transcript={transcript}
        youtubePopups={state.youtubePopups}
        handleYoutubeDropped={handlers.handleYoutubeDropped}
        handleCloseYoutubePopup={handlers.handleCloseYoutubePopup}
        activeIcons={state.activeIcons}
        isWaitActive={state.isWaitActive}
        handleToolClick={handlers.handleToolClick}
        wbBtnBase={wbBtnBase}
        wbBtnActive={wbBtnActive}
        wbSmallBtnBase={wbSmallBtnBase}
        wbSmallBtnActive={wbSmallBtnActive}
        handleHeaderClick={handlers.handleHeaderClick}
        showObserverModal={false}
        observerData={null}
        handleObserverModalOk={() => { }}
        LeftSidebarComponent={
          <LearningProgramSidebar
            sessionInfo={state.sessionInfo}
            filteredLearningGoals={displayedLearningGoals}
            isSearching={state.isSearchingGoals}
            selectedPromptLevel={state.selectedPromptLevel}
            setSelectedPromptLevel={state.setSelectedPromptLevel}
            selectedReinforcementLevel={state.selectedReinforcementLevel}
            setSelectedReinforcementLevel={state.setSelectedReinforcementLevel}
            selectedProgramId={state.selectedProgramId}
            handleProgramCheck={handlers.handleProgramCheck}
            webRTC={state.videoService}
            toggleListening={toggleListening}
            listening={listening}
            transcript={transcript}
            whiteboardService={state.whiteboardService}
            onSaveReport={handleSaveReport}
            learningGoalsSearch={state.learningGoalsSearch}
            setLearningGoalsSearch={state.setLearningGoalsSearch}
          />
        }
      />
    </>
  );
};

export default CoachSession;
