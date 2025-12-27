import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify'
import './index.css'
import './styles/session.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'

// Handle Chrome extension messages to prevent async response errors
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    // Respond immediately to prevent "message channel closed" errors
    sendResponse({ received: true });
    return false; // Don't keep the channel open
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <ToastContainer
      position="top-center"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      style={{
        top: '20px',
        width: 'auto',
        maxWidth: '500px'
      }}
    />
  </StrictMode>,
)
