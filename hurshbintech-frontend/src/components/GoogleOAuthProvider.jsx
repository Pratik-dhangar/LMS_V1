import React from 'react';
import { GoogleOAuthProvider as GoogleProvider } from '@react-oauth/google';

const GoogleOAuthProvider = ({ children }) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables');
    return children;
  }

  return (
    <GoogleProvider clientId={clientId}>
      {children}
    </GoogleProvider>
  );
};

export default GoogleOAuthProvider;
