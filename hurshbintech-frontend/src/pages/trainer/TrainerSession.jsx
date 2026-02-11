// TrainerSession.jsx - Trainer Live Session Interface
// Uses shared InstructorSessionPage component and custom hooks
// Manages Observer connections, Recording, and Learner-specific logic

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionService from '../../api/services/sessionService';
import sessionReportService from '../../api/services/sessionReportService';
import VideoConferenceService from '../../api/services/videoConferenceService';
import JanusRecordingService from '../../api/services/janusService';
import useVoiceInput from '../../hooks/useVoiceInput';
import useStopwatch from '../../hooks/useStopwatch';
import useAutoHideNavbar from '../../hooks/useAutoHideNavbar';
import { useMediaControl } from '../../context/MediaControlContext';
import useInstructorSessionState from '../../hooks/useInstructorSessionState';
import useInstructorHandlers from '../../hooks/useInstructorHandlers';
import useInstructorEffects from '../../hooks/useInstructorEffects';
import LearningProgramSidebar from './LearningProgramSidebar';
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

const TrainerSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Custom hooks for state, handlers, and effects
  const state = useInstructorSessionState('trainer');
  const stopwatch = useStopwatch();
  const mediaControl = useMediaControl();
  const { toggleListening, listening, transcript } = useVoiceInput();
  const { pageClassName, navbarClassName } = useAutoHideNavbar();

  // Cleanup function
  const cleanup = () => {
    cleanupSessionResources({
      videoService: state.videoService,
      whiteboardService: state.whiteboardService,
      toolsService: state.toolsService,
      recordingService: state.recordingService,
      secondaryVideoService: state.observerRTC,
      isInitializingRef: state.isInitializingRef,
    });
    state.observerInitializedRef.current = false;
    state.timersRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.timersRef.current.clear();
    state.stopwatchesRef.current.forEach(({ intervalId }) => clearInterval(intervalId));
    state.stopwatchesRef.current.clear();
    clearSessionActivity(sessionId, 'trainer');
  };

  // Initialize WebRTC for Learner (with Observer hooks)
  const initializeWebRTC = async (numericSessionId) => {
    if (state.isInitializingRef.current) return;
    state.isInitializingRef.current = true;

    // Initialize Whiteboard
    const wbService = initializeWhiteboardService({
      wsBaseUrl: WS_BASE_URL,
      sessionId,
      role: 'trainer',
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

    // Initialize Learner Video Conference with Observer event hooks
    const learnerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer');

    try {
      learnerVideoService.onLocalStream = (stream) => state.setLocalStream(stream);
      learnerVideoService.onRemoteStream = (stream) => {
        state.setRemoteStream(stream);
        if (!state.connectedRef.current) {
          state.connectedRef.current = true;
          toast.success(`${state.sessionInfo?.learner_name || 'Learner'} has joined the session`);
        }
      };

      learnerVideoService.onConnectionStateChange = (stateStr) => {
        const statusMap = {
          'new': 'connecting', 'connecting': 'connecting', 'connected': 'connected',
          'disconnected': 'disconnected', 'failed': 'failed', 'closed': 'disconnected',
        };
        state.setConnectionStatus(statusMap[stateStr] || stateStr);

        if ((stateStr === 'disconnected' || stateStr === 'closed') && state.connectedRef.current) {
          toast.info(`${state.sessionInfo?.learner_name || 'Learner'} has left the session`);
          state.setRemoteStream(null);
          state.connectedRef.current = false;
        }
      };

      learnerVideoService.onError = (error) => {
        toast.error(`Video error: ${error.message}`);
      };

      // Observer event hooks
      learnerVideoService.onObserverJoined = (observerUserData) => {
        state.setObserverData(observerUserData);
        state.setShowObserverModal(true);
      };

      learnerVideoService.onObserverLeft = () => {
        toast.info('Observer left the session', { autoClose: 2000, position: 'top-center' });
        if (state.observerRTC) {
          state.observerRTC.close();
          state.setObserverRTC(null);
          state.observerInitializedRef.current = false;
        }
      };

      await learnerVideoService.initialize();
      state.setVideoService(learnerVideoService);

      const recService = new JanusRecordingService(learnerVideoService, numericSessionId);
      state.setRecordingService(recService);

      state.setMicEnabled(learnerVideoService.isMicrophoneEnabled());
      state.setCameraEnabled(learnerVideoService.isCameraEnabled());
    } catch (error) {
      toast.error('Failed to initialize video conference');
    }
  };

  // Initialize Observer connection
  const initializeObserverConnection = async () => {
    if (state.observerInitializedRef.current) return;
    state.observerInitializedRef.current = true;

    try {
      const observerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer', false, 'observer');
      observerVideoService.onError = (error) => {
        toast.error(`Observer connection error: ${error.message}`);
      };
      observerVideoService.onConnectionStateChange = (stateStr) => {
        console.log('[TrainerSession] OBSERVER connection state:', stateStr);
      };

      await observerVideoService.initialize();
      state.setObserverRTC(observerVideoService);

      setTimeout(async () => {
        try {
          await observerVideoService.startScreenShare('observer');
          toast.success('Screen sharing started for observer', { autoClose: 2000 });
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            toast.warning('Screen sharing cancelled', { autoClose: 3000 });
          } else {
            toast.error('Failed to start screen sharing');
          }
        }
      }, 1000);
    } catch (error) {
      toast.error('Failed to initialize observer connection');
      state.observerInitializedRef.current = false;
    }
  };

  // Observer modal handler
  const handleObserverModalOk = async () => {
    state.setShowObserverModal(false);
    await initializeObserverConnection();
  };

  // Session report handler (Trainer only)
  const handleSaveReport = async (reportData) => {
    try {
      if (!reportData?.programName || !reportData?.promptMeter || !reportData?.reinforcementMeter) {
        toast.error('Please select a program, prompt level, and reinforcement level');
        return;
      }

      // Convert sessionId to integer and build report with API-required fields
      const numericSessionId = parseInt(sessionId) || state.sessionInfo?.id;
      const reportPayload = {
        session_id: numericSessionId,
        learner_id: state.sessionInfo?.learner_id,
        program_id: reportData.programId || null,
        program_name: reportData.programName,
        prompt_meter: reportData.promptMeter,
        reinforcement_meter: reportData.reinforcementMeter,
      };

      console.log('[TrainerSession] Saving report:', reportPayload);
      await sessionReportService.create(reportPayload);
      toast.success('Session report saved successfully');
      // Reset meters after successful save
      state.setSelectedPromptLevel(null);
      state.setSelectedReinforcementLevel(null);
      state.setSelectedProgramId(null);
    } catch (error) {
      console.error('[TrainerSession] Error saving report:', error);
      console.error('Response details:', error.response?.data);
      toast.error('Failed to save session report');
    }
  };

  // Use custom hooks for handlers and effects
  const handlers = useInstructorHandlers({
    role: 'trainer',
    sessionId,
    videoService: state.videoService,
    observerRTC: state.observerRTC,
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
    sessionService,
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
    role: 'trainer',
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
    restrictionAlertShownRef: state.restrictionAlertShownRef,
    floatingAnimations: state.floatingAnimations,
    sessionService,
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
    initializeWebRTC,
    cleanup,
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

  const wbBtnBase = WB_BUTTON_STYLES.base;
  const wbBtnActive = WB_BUTTON_STYLES.active;
  const wbSmallBtnBase = WB_BUTTON_STYLES.smallBase;
  const wbSmallBtnActive = WB_BUTTON_STYLES.smallActive;

  return (
    <InstructorSessionPage
      role="trainer"
      participantName="Learner"
      participantType="learner"
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
      onSaveReport={handleSaveReport}
      youtubePopups={state.youtubePopups}
      handleYoutubeDropped={handlers.handleYoutubeDropped}
      handleCloseYoutubePopup={handlers.handleCloseYoutubePopup}
      activeIcons={state.activeIcons}
      handleToolClick={handlers.handleToolClick}
      wbBtnBase={wbBtnBase}
      wbBtnActive={wbBtnActive}
      wbSmallBtnBase={wbSmallBtnBase}
      wbSmallBtnActive={wbSmallBtnActive}
      handleHeaderClick={handlers.handleHeaderClick}
      showObserverModal={state.showObserverModal}
      observerData={state.observerData}
      handleObserverModalOk={handleObserverModalOk}
      LeftSidebarComponent={
        <LearningProgramSidebar
          sessionInfo={state.sessionInfo}
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
          whiteboardService={state.whiteboardService}
          onSaveReport={handleSaveReport}
        />
      }
    />
  );
};

export default TrainerSession;
