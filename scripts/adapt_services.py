import shutil
import re

# 1. Adapt whiteboardService.js
src_wb = 'hurshbintech-frontend/src/api/services/whiteboardService.js'
dst_wb = 'live-session-studio/frontend/src/api/services/whiteboardService.js'
with open(src_wb, 'r', encoding='utf-8') as f:
    wb_code = f.read()

wb_code = wb_code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
wb_code = wb_code.replace("type: 'join',", "type: 'join', token: sessionStorage.getItem('lss_access_token'),")

with open(dst_wb, 'w', encoding='utf-8') as f:
    f.write(wb_code)
print('whiteboardService.js adapted')

# 2. Adapt videoConferenceService.js
src_vc = 'hurshbintech-frontend/src/api/services/videoConferenceService.js'
dst_vc = 'live-session-studio/frontend/src/api/services/videoConferenceService.js'
with open(src_vc, 'r', encoding='utf-8') as f:
    vc_code = f.read()

vc_code = vc_code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
vc_code = vc_code.replace("type: 'join',", "type: 'join', token: sessionStorage.getItem('lss_access_token'),")

with open(dst_vc, 'w', encoding='utf-8') as f:
    f.write(vc_code)
print('videoConferenceService.js adapted')

# 3. Adapt attendeeSession.js
src_att = 'hurshbintech-frontend/src/utils/attendeeSession.js'
dst_att = 'live-session-studio/frontend/src/utils/attendeeSession.js'
with open(src_att, 'r', encoding='utf-8') as f:
    att_code = f.read()

att_code = att_code.replace("'ws://localhost:8000'", "import.meta.env.VITE_WS_URL || 'ws://localhost:8002'")
with open(dst_att, 'w', encoding='utf-8') as f:
    f.write(att_code)
print('attendeeSession.js adapted')
