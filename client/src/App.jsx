import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useChatStore from './store/chatStore';
import Hero from './components/Hero';
import AuthCallback from './pages/AuthCallback';
import SearchScreen from './components/SearchScreen';
import ChatWindow from './components/ChatWindow';
import { useEffect } from 'react';
import { initSocket } from './services/socket';

// This component protects routes that require a user to be logged in.
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  // If there's no token, redirect to the home page.
  return token ? children : <Navigate to="/" />;
};

function App() {
  const { isMatched, setConnected, setMatched, setSearching, addMessage, setPartnerConnected, setUser } = useChatStore();

  useEffect(() => {
    // Attempt to initialize the socket if a token exists on page load or after login.
    const token = localStorage.getItem('authToken');
    if (token) {
      const socket = initSocket();

      if (socket) {
        // This listener is now effectively the "login success" handler for the app
        socket.on('loginSuccess', (data) => {
          console.log('Login successful, user data received:', data.user);
          setUser(data.user); // Store user data in the store
        });

        // Global listeners that affect the whole app state
        socket.on('connect', () => {
          console.log('Connected to server');
          setConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnected(false);
        });

        // Matchmaking listeners
        socket.on('matched', ({ roomId }) => {
          console.log('Matched! Room:', roomId);
          setMatched(true, roomId);
          setSearching(false);
        });

        socket.on('searchStopped', () => {
          console.log('Search stopped');
          setSearching(false);
        });

        // Message listeners
        socket.on('receiveMessage', (message) => {
          console.log('Message received:', message.content);
          addMessage({
            text: message.content,
            sender: 'partner',
            timestamp: message.timestamp
          });
        });

        // Partner status listeners
        socket.on('partnerDisconnected', () => {
          console.log('Partner disconnected');
          setPartnerConnected(false);
        });
        
        // Connect the socket
        socket.connect();

        // Cleanup on unmount
        return () => {
          socket.off('loginSuccess');
          socket.off('connect');
          socket.off('disconnect');
          socket.off('matched');
          socket.off('searchStopped');
          socket.off('receiveMessage');
          socket.off('partnerDisconnected');
        };
      }
    }
  }, [setConnected, setMatched, setSearching, addMessage, setPartnerConnected, setUser]);

  return (
    <Router>
      <Routes>
        {/* Public route for the landing/login page */}
        <Route path="/" element={<Hero />} />

        {/* Route to handle the magic link callback */}
        <Route path="/auth" element={<AuthCallback />} />

        {/* Main application route, protected by authentication */}
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              {isMatched ? <ChatWindow /> : <SearchScreen />}
            </PrivateRoute>
          }
        />

        {/* Redirect any other path to the home page */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;