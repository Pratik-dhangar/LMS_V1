import os
import re

os.makedirs('live-session-studio/frontend/src/hooks', exist_ok=True)
os.makedirs('live-session-studio/frontend/src/pages/trainer', exist_ok=True)
os.makedirs('live-session-studio/frontend/src/pages/learner', exist_ok=True)
os.makedirs('live-session-studio/frontend/src/components/session', exist_ok=True)

# 1. useInstructorSessionState.js
with open('hurshbintech-frontend/src/hooks/useInstructorSessionState.js', 'r', encoding='utf-8') as f:
    code = f.read()
with open('live-session-studio/frontend/src/hooks/useInstructorSessionState.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('1. useInstructorSessionState.js copied')

# 2. useInstructorEffects.js
with open('hurshbintech-frontend/src/hooks/useInstructorEffects.js', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("import learningGoalsService from '../api/services/learningGoalsService';", "// learningGoalsService removed")
code = code.replace("localStorage.getItem('user_data')", "sessionStorage.getItem('lss_user')")
code = code.replace("searchLearningGoalsDatabase,\n", "")
code = code.replace("searchLearningGoalsDatabase,", "")
with open('live-session-studio/frontend/src/hooks/useInstructorEffects.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('2. useInstructorEffects.js adapted')

# 3. useInstructorHandlers.js
with open('hurshbintech-frontend/src/hooks/useInstructorHandlers.js', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("localStorage.getItem('user_data')", "sessionStorage.getItem('lss_user')")
with open('live-session-studio/frontend/src/hooks/useInstructorHandlers.js', 'w', encoding='utf-8') as f:
    f.write(code)
print('3. useInstructorHandlers.js adapted')

# 4. LearningContentSidebar.jsx
with open('hurshbintech-frontend/src/pages/trainer/LearningContentSidebar.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
with open('live-session-studio/frontend/src/pages/trainer/LearningContentSidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('4. LearningContentSidebar.jsx copied')

# 5. InstructorSessionLayout.jsx
with open('hurshbintech-frontend/src/components/session/InstructorSessionLayout.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
# Replace validateUserSession to read lss_user
code = code.replace(
    "const userData = localStorage.getItem('user_data');",
    "const userData = sessionStorage.getItem('lss_user') || localStorage.getItem('user_data');"
)
# In initializeInstructorSession, remove Coach branch
coach_check = '''        } else if (role === 'coach') {
            // For coach, fetch profile ID since session stores coach_id (profile ID), not user_id
            try {
                const { default: coachService } = await import('../../api/services/coachService');
                const profile = await coachService.getCurrentProfile();
                // console.log(`[${role}Session] Profile response:`, profile);

                if (!profile || !profile.id) {
                    // console.error(`[${role}Session] Invalid profile response:`, profile);
                    toast.error('Failed to verify coach profile');
                    navigate('/dashboard');
                    return null;
                }

                if (session.coach_id !== profile.id) {
                    // console.error(`[${role}Session] Unauthorized: coach_id mismatch`, {
                    //     session_coach_id: session.coach_id,
                    //     profile_id: profile.id
                    // });
                    toast.error('Unauthorized access');
                    navigate('/dashboard');
                    return null;
                }
            } catch (error) {
                // console.error(`[${role}Session] Error verifying coach profile:`, error);
                toast.error('Failed to verify coach profile');
                navigate('/dashboard');
                return null;
            }
        }'''
code = code.replace(coach_check, "        }")
code = code.replace("navigate('/dashboard');", "navigate('/trainer/dashboard');")
code = code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")

with open('live-session-studio/frontend/src/components/session/InstructorSessionLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('5. InstructorSessionLayout.jsx adapted')

# 6. AttendeeSessionLayout.jsx
with open('hurshbintech-frontend/src/components/session/AttendeeSessionLayout.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
code = code.replace("navigate('/dashboard')", "navigate('/learner/dashboard')")
code = code.replace("navigate('/')", "navigate('/learner/dashboard')")
with open('live-session-studio/frontend/src/components/session/AttendeeSessionLayout.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('6. AttendeeSessionLayout.jsx adapted')

# 7. TrainerSession.jsx
with open('hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("import LearningProgramSidebar from './LearningProgramSidebar';", "// LearningProgramSidebar removed")
code = code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
code = code.replace("navigate('/dashboard')", "navigate('/trainer/dashboard')")
code = code.replace("navigate('/trainer/dashboard')", "navigate('/trainer/dashboard')")
code = code.replace("localStorage.getItem('user_data')", "sessionStorage.getItem('lss_user')")

# Replace LeftSidebarComponent in TrainerSession
old_left_sidebar = '''        LeftSidebarComponent={
          <LearningProgramSidebar
            sessionInfo={state.sessionInfo}
            filteredLearningGoals={state.filteredLearningGoals}
            selectedPromptLevel={state.selectedPromptLevel}
            setSelectedPromptLevel={state.setSelectedPromptLevel}
            selectedReinforcementLevel={state.selectedReinforcementLevel}
            setSelectedReinforcementLevel={state.setSelectedReinforcementLevel}
            reinforcementValueVisible={isReinforcementValueVisible}
            onToggleReinforcementValueVisibility={handleToggleReinforcementValueVisibility}
            selectedProgramId={state.selectedProgramId}
            handleProgramCheck={handlers.handleProgramCheck}
            webRTC={state.videoService}
            toggleListening={toggleListening}
            listening={listening}
            transcript={transcript}
            whiteboardService={state.whiteboardService}
            onSaveReport={handleSaveReport}
          />
        }'''
new_left_sidebar = '''        LeftSidebarComponent={null}'''
code = code.replace(old_left_sidebar, new_left_sidebar)

with open('live-session-studio/frontend/src/pages/trainer/TrainerSession.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('7. TrainerSession.jsx adapted')

# 8. LearnerSession.jsx
with open('hurshbintech-frontend/src/pages/learner/LearnerSession.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
code = code.replace("navigate('/dashboard')", "navigate('/learner/dashboard')")
code = code.replace("navigate('/')", "navigate('/learner/dashboard')")
code = code.replace("localStorage.getItem('user_data')", "sessionStorage.getItem('lss_user')")

with open('live-session-studio/frontend/src/pages/learner/LearnerSession.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('8. LearnerSession.jsx adapted')
