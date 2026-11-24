"""Build a per-file implementation checklist from the frozen source manifest."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GUIDES = ROOT / "docs/guides"

FRONTEND_REPLACE = {
    "src/api/axios.js": "New backend base URL, demo bearer auth from sessionStorage, and real error handling; no LMS/device invalidation.",
    "src/api/services/authService.js": "Passwordless demo profile login API wrapper if retained callers need this path.",
    "src/context/AuthContext.jsx": "Provide demo user/login/logout/auth state from one sessionStorage-backed module; no LMS auth/device/session checks.",
}
FRONTEND_REFERENCE = {
    "src/pages/trainer/LearningProgramSidebar.jsx": "Remove program panel from the copied trainer/layout, including mobile instance; preserve adjacent remote video.",
    "src/styles/LearningProgram.css": "Only needed if a retained non-program element still uses a specific rule; do not copy the removed panel.",
    "src/api/services/coachService.js": "Remove inactive coach-specific lookup/dynamic import from retained instructor layout; no coach role in this project.",
    "src/api/services/learningGoalsService.js": "Remove goal/program/coach-only searches and their imports; the extracted room has no learning program.",
    "src/api/services/sessionReportService.js": "Remove program-specific report handler/calls with the panel; retain separate notes/feedback.",
    "src/hooks/useDeviceSession.js": "LMS device-auth policy is not the demo identity mechanism.",
    "src/components/SessionInvalidatedModal.jsx": "Not required after removing LMS device-auth invalidation.",
    "src/components/SessionInvalidatedModal.css": "Not required after removing LMS device-auth invalidation.",
    "src/main.jsx": "Reference providers/global styles; create a small independent entry, not the original whole-LMS bootstrap.",
    "src/App.jsx": "Reference session route/provider mounting only; create new role/profile and paired-room routes.",
    "package.json": "Create relevant exact-version dependencies using locked_frontend_versions; do not carry the entire LMS dependency list.",
    "package-lock.json": "Frozen version reference. Generate and commit the standalone lockfile from selected exact dependencies.",
}
FRONTEND_ADAPT = {
    "src/pages/trainer/TrainerSession.jsx": "Replace entry/auth/API/navigation and program panel/report wiring; preserve admission, media, notes, recording and tool callbacks.",
    "src/pages/learner/LearnerSession.jsx": "Replace auth/API/navigation and selected-room entry; preserve waiting, permission, media, whiteboard and exit callbacks.",
    "src/components/session/InstructorSessionLayout.jsx": "Adapt validateUserSession/initializeInstructorSession, video-only sidebar layout and endpoints. Preserve toolbar/canvas wiring.",
    "src/components/session/AttendeeSessionLayout.jsx": "Adapt new home navigation and removed program labels only; preserve learner UI and media/whiteboard layout.",
    "src/hooks/useInstructorEffects.js": "Keep notes, media, tool callbacks and synchronization; remove LMS goal/coach searches and replace room initialization/content lookup.",
    "src/hooks/useInstructorHandlers.js": "Replace room end/navigation/notes boundary; preserve all retained tool handlers.",
    "src/hooks/useInstructorSessionState.js": "Copy existing state first; remove only demonstrably dead program/observer state after integration.",
    "src/api/services/sessionService.js": "Keep used public method names but map to room, membership, feedback and recording endpoints; remove unused Head/admin operations.",
    "src/api/services/sessionNotesService.js": "Map every used notes method to actual room-note storage, including force-save and clear.",
    "src/api/services/learningContentService.js": "Trainer library/upload API and new backend URL resolution; retain drag/media metadata and supported formats.",
    "src/api/services/whiteboardService.js": "Authenticate join from demo auth; preserve event names/payloads, listener lifecycle, reconnect and restore buffering.",
    "src/api/services/videoConferenceService.js": "Authenticate RTC join and configure ICE servers; preserve offer/answer/ICE/admission and existing media controls.",
    "src/pages/trainer/LearningContentSidebar.jsx": "Use standalone material library/search; preserve desktop/touch drag payloads and return-to-sidebar behavior.",
    "src/utils/instructorSession.js": "Extract the actively used autoSaveSessionNotes helper into a small module at this path; do not carry unused legacy state-hook/LMS helpers.",
    "src/utils/attendeeSession.js": "Preserve active attendee tool/media/comment helpers; adapt identity/room/navigation references only.",
    "src/utils/sessionActivityTracker.js": "Room/profile/role-specific tab guards; trainer and learner tabs must coexist without shared auth collisions.",
    "src/utils/urlHelper.js": "New backend origin and file access URLs only; remove production fallback and preserve /api path/query handling.",
    "src/context/chat/ChatContext.jsx": "Demo auth + paired room conversation/socket; preserve widget state/events without global LMS user directory.",
    "src/api/services/chat/chatApi.js": "Implement used widget API contracts against actual paired-room chat storage, file upload and presence.",
    "src/components/chat/ChatIconWidget.jsx": "Keep widget appearance/interaction, adapt route/auth and selected room context.",
    "src/components/chat/MessagingWidget.jsx": "Keep direct-message UI/features, scoped to the room pair; remove unsupported group/directory actions.",
    "src/pages/chat/UnifiedChatPage.jsx": "Retain direct-room chat view if widget navigation uses it; remove global-directory/group flows.",
    "src/styles/session.css": "Preserve current appearance, remove empty program-column reservation while retaining remote video placement and canvas sizing.",
    "tailwind.config.js": "Keep Tailwind 3 theme/utilities and destination content paths; no framework upgrade.",
    "postcss.config.js": "Retain matching Tailwind/PostCSS configuration in the independent frontend.",
}
BACKEND_COPY = {
    "app/crud/whiteboard_crud.py": "Retain current JSONB board-state CRUD against the standalone DB/session module; regression-test learner persistence separately.",
    "app/models/whiteboard_state_model.py": "Retain JSONB and item/stroke schema; use new minimal Base and own migration, not LMS model initializer.",
    "app/services/recording_merge_service.py": "Retain real FFmpeg merge behavior; resolve storage paths into destination storage.",
    "app/services/recording_storage/local_storage.py": "Retain local recording storage contract in destination storage.",
    "app/services/recording_storage/base.py": "Retain recording storage interface used by local implementation.",
}
BACKEND_ADAPT = {
    "app/api/endpoints/websocket.py": "Port RTC/whiteboard channels, heartbeat, routing, media state and restore. Bind demo tokens, paired-room membership/admission and new local URL/db helpers; exclude coach/observer branches.",
}
BACKEND_REPLACE = {
    "app/services/recording_storage/factory.py": "Local-only factory using existing interface; do not import the absent S3 implementation.",
    "app/core/config.py": "New standalone settings/env and generated secret; require the independent DB and local storage configuration.",
    "app/core/deps.py": "New demo token/current-profile/room-ownership dependencies; no LMS roles/profiles/subscriptions.",
    "app/db/session.py": "New standalone async SQLAlchemy Base/engine/session with explicit independent DB URL.",
    "requirements.txt": "Select and lock real dependencies needed by retained backend; inspect source versions. Do not blindly copy all LMS tools/S3 integrations.",
}


def classify(path):
    if path.startswith("hurshbintech-frontend/"):
        rel = path.removeprefix("hurshbintech-frontend/")
        target = "frontend/" + rel
        for action, mapping in [("REPLACE", FRONTEND_REPLACE), ("REFERENCE_ONLY", FRONTEND_REFERENCE), ("ADAPT", FRONTEND_ADAPT)]:
            if rel in mapping:
                return action, target, mapping[rel]
        return "COPY_BASELINE", target, "Preserve baseline implementation/asset first; only documented necessary integration edits after copy."
    rel = path.removeprefix("hurshbintech-backend/")
    target = "backend/" + rel
    for action, mapping in [("COPY_BASELINE", BACKEND_COPY), ("ADAPT", BACKEND_ADAPT), ("REPLACE", BACKEND_REPLACE)]:
        if rel in mapping:
            return action, target, mapping[rel]
    return "REFERENCE_ONLY", None, "Port retained room/content/notes/feedback/recording/chat behavior selectively into new modules; do not bulk-copy LMS business models, routers or their imports. See execution plan."


def main():
    manifest = json.loads((GUIDES / "LIVE_SESSION_EXTRACTION_MANIFEST.json").read_text())
    records = {}
    for group in ("session_core", "global_messaging"):
        for row in manifest[group]["files"]:
            records[row["path"]] = row
    for group in ("runtime_music_and_reactions", "shell_and_global_style_reference", "backend_adaptation_sources"):
        for row in manifest[group]:
            records[row["path"]] = row
    result = []
    for path, row in sorted(records.items()):
        if hashlib.sha256((ROOT / path).read_bytes()).hexdigest() != row["sha256"]:
            raise RuntimeError(f"Source differs from frozen manifest: {path}. Inspect/reconcile; do not overwrite baseline automatically.")
        action, target, reason = classify(path)
        result.append({"source": path, "source_sha256": row["sha256"], "action": action,
                       "destination_relative_to_project": target, "instruction": reason})
    output = {
        "source_commit": manifest["source_commit"], "destination_default": "live-session-studio",
        "specification": "LIVE_SESSION_EXECUTION_PLAN.md",
        "notes": ["Destinations for REFERENCE_ONLY rows are reference locations, not instructions to copy/import them.", "New shell, room, demo auth, invitations, database migrations and feature adapters are created according to the execution plan.", "COPY_BASELINE and ADAPT sources must be copied before editing so the original is reviewable."],
        "files": result,
    }
    (GUIDES / "LIVE_SESSION_FILE_ACTIONS.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Verified frozen source hashes and wrote {len(result)} per-file actions.")


if __name__ == "__main__":
    main()
