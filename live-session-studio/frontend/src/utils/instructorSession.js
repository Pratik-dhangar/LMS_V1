/**
 * Auto-save session notes utility for instructor session.
 * Extracted module as required by execution plan.
 */
export const autoSaveSessionNotes = (sessionId, notes, autoSaveTimerRef, sessionNotesService) => {
  if (!sessionId || !sessionNotesService) return;

  const notesText = typeof notes === 'string' ? notes : '';

  if (autoSaveTimerRef.current) {
    clearTimeout(autoSaveTimerRef.current);
  }

  autoSaveTimerRef.current = setTimeout(async () => {
    try {
      await sessionNotesService.saveNotes(sessionId, notesText);
      console.log('[Instructor] Session notes auto-saved');
    } catch (error) {
      console.error('[Instructor] Auto-save session notes failed:', error);
    }
  }, 2000);
};

export default {
  autoSaveSessionNotes,
};
