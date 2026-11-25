import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { MediaControlProvider } from './context/MediaControlContext';
import { ChatProvider } from './context/chat/ChatContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MediaControlProvider>
          <ChatProvider>
            <App />
            <ToastContainer position="top-right" autoClose={3000} theme="dark" />
          </ChatProvider>
        </MediaControlProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
