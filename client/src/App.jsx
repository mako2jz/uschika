import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useChatStore from './store/chatStore';
import Hero from './components/Hero';
import AuthCallback from './pages/AuthCallback';
import SearchScreen from './components/SearchScreen';
import ChatWindow from './components/ChatWindow';
import { useEffect } from 'react';
import { getSocket, initSocket } from './services/socket';

// This component protects routes that require a user to be logged in.
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  // If there's no token, redirect to the home page.
  return token ? children : <Navigate to="/" />;
};

function App() {
  const { isMatched, setConnected, setMatched, setSearching, addMessage, setPartnerConnected, setUser } = useChatStore();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Check if socket already exists and is connected
      let socket = getSocket();
      
      // If socket exists and is already connected, just set up listeners
      if (socket?.connected) {
        console.log('Socket already connected, skipping initialization');
        return;
      }

      // Initialize socket if needed
      if (!socket) {
        socket = initSocket();
      }

      if (socket) {
        // ...existing code... (all the socket.on listeners)
        socket.on('loginSuccess', (data) => {
          console.log('Login successful, user data received:', data.user);
          setUser(data.user);
        });

        socket.on('connect', () => {
          console.log('Connected to server');
          setConnected(true);
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from server');
          setConnected(false);
        });

        socket.on('matched', ({ roomId }) => {
          console.log('Matched! Room:', roomId);
          setMatched(true, roomId);
          setSearching(false);
        });

        socket.on('searchStopped', () => {
          console.log('Search stopped');
          setSearching(false);
        });

        socket.on('receiveMessage', (message) => {
          console.log('Message received:', message.content);
          addMessage({
            text: message.content,
            sender: 'partner',
            timestamp: message.timestamp
          });
        });

        socket.on('partnerDisconnected', () => {
          console.log('Partner disconnected');
          setPartnerConnected(false);
        });
        
        // Only connect if not already connected
        if (!socket.connected) {
          socket.connect();
        }

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