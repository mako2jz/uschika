import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const initSocket = () => {
  // If a socket instance exists, disconnect it to ensure a fresh connection
  if (socket) {
    socket.disconnect();
  }

  const token = localStorage.getItem('authToken'); // Retrieve the JWT token

  // Do not initialize if there is no token
  if (!token) {
    console.log("No auth token found, socket initialization skipped.");
    return null;
  }

  // Create a new socket instance
  socket = io(SOCKET_URL, {
    autoConnect: false, // We will connect manually after setting up listeners
    auth: {
      token // Pass the token for authentication middleware on the server
    }
  });

  // Handle authentication errors during connection
  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    // If the token is invalid, clear it and force a re-login
    if (err.message === 'Unauthorized') {
      alert('Authentication failed. Please log in again.');
      localStorage.removeItem('authToken'); // Clear invalid token
      disconnectSocket(); // Disconnect and nullify the socket
      // Optionally, redirect to the login page
      window.location.href = '/';
    }
  });

  // The server will verify the token from `auth` on connection.
  // We also emit a 'login' event to signal the user is ready and fetch data.
  socket.on('connect', () => {
    console.log('Socket connected, emitting login event.');
    socket.emit('login', { token });
  });

  return socket;
};

export const getSocket = () => {
  // If socket doesn't exist, try to initialize it.
  // This is useful for components that need the socket after the initial page load.
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