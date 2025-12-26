import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

let socket = null;

// Validate token format (basic JWT structure check)
const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3;
};

export const initSocket = () => {
  // If a socket instance exists, disconnect it to ensure a fresh connection
  if (socket) {
    socket.disconnect();
  }

  const token = localStorage.getItem('authToken');

  // Validate token exists and has proper format
  if (!token || !isValidTokenFormat(token)) {
    console.log("No valid auth token found, socket initialization skipped.");
    localStorage.removeItem('authToken'); // Clear invalid token
    return null;
  }

  // Create a new socket instance
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: {
      token
    },
    // Add reconnection settings
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // Handle authentication errors during connection
  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    
    if (err.message === 'Unauthorized' || err.message === 'Token expired') {
      console.log('Authentication failed, clearing token...');
      localStorage.removeItem('authToken');
      disconnectSocket();
      // Redirect to login page
      window.location.href = '/';
    }
  });

  socket.on('unauthorized', () => {
    console.log('Received unauthorized event, clearing token...');
    localStorage.removeItem('authToken');
    disconnectSocket();
    window.location.href = '/';
  });

  socket.on('connect', () => {
    console.log('Socket connected, emitting login event.');
    socket.emit('login', { token });
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

// Utility to check if socket is connected
export const isSocketConnected = () => {
  return socket?.connected ?? false;
};