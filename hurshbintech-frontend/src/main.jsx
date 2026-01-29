import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify'
import './index.css'
import './styles/session.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'
import { OrientationProvider } from './context/OrientationContext'

if (process.env.NODE_ENV === 'production') {
  console.log = () => { };
  console.error = () => { };
  console.debug = () => { };
}

// Handle Chrome extension messages to prevent async response errors
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
    try {
      // Respond immediately to prevent "message channel closed" errors
      sendResponse({ received: true });
    } catch (err) {
      // Silently ignore if channel already closed
      console.debug('Message channel error (expected):', err);
    }
    return false; // Don't keep the channel open
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OrientationProvider>
      <App />
    </OrientationProvider>
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
