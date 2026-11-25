import shutil
import os

os.makedirs('live-session-studio/frontend/src/components/chat', exist_ok=True)
os.makedirs('live-session-studio/frontend/src/pages/chat', exist_ok=True)

# 1. ChatIconWidget.jsx
src_icon = 'hurshbintech-frontend/src/components/chat/ChatIconWidget.jsx'
dst_icon = 'live-session-studio/frontend/src/components/chat/ChatIconWidget.jsx'
with open(src_icon, 'r', encoding='utf-8') as f:
    icon_code = f.read()

# Only hide on /login
icon_code = icon_code.replace("location.pathname.includes('/coach/session/') || \n    location.pathname.includes('/head/session/');", "false;")
with open(dst_icon, 'w', encoding='utf-8') as f:
    f.write(icon_code)
print('ChatIconWidget copied')

# 2. MessagingWidget.jsx
src_mw = 'hurshbintech-frontend/src/components/chat/MessagingWidget.jsx'
dst_mw = 'live-session-studio/frontend/src/components/chat/MessagingWidget.jsx'
shutil.copyfile(src_mw, dst_mw)
print('MessagingWidget copied')

# 3. UnifiedChatPage.jsx
src_ucp = 'hurshbintech-frontend/src/pages/chat/UnifiedChatPage.jsx'
dst_ucp = 'live-session-studio/frontend/src/pages/chat/UnifiedChatPage.jsx'
shutil.copyfile(src_ucp, dst_ucp)
print('UnifiedChatPage copied')
