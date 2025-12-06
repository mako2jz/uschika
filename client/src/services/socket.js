import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('authToken'); // Retrieve the JWT token from localStorage

    socket = io(SOCKET_URL, {
      autoConnect: true,
      auth: {
        token // Pass the token for authentication
      }
    });

    // Handle authentication errors
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      if (err.message === 'Unauthorized') {
        alert('Authentication failed. Please log in again.');
        localStorage.removeItem('authToken'); // Clear invalid token
        socket.disconnect();
        socket = null;
      }
    });
  }
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
    socket.disconnect();
    socket = null;
  }
};