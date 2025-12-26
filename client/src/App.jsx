import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useChatStore from './store/chatStore';
import Hero from './components/Hero';
import AuthCallback from './pages/AuthCallback';
import SearchScreen from './components/SearchScreen';
import ChatWindow from './components/ChatWindow';
import { useEffect } from 'react';
import { getSocket } from './services/socket';

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
      // Get existing socket or create new one
      let socket = getSocket();

      // If no socket could be created, skip
      if (!socket) {
        return;
      }

      // Set up listeners (they'll be cleaned up on unmount)
      const handleLoginSuccess = (data) => {
        console.log('Login successful, user data received:', data.user);
        setUser(data.user);
        setConnected(true);
      };

      const handleConnect = () => {
        console.log('Connected to server');
      };

      const handleDisconnect = () => {
        console.log('Disconnected from server');
        setConnected(false);
      };

      const handleMatched = ({ roomId }) => {
        console.log('Matched! Room:', roomId);
        setMatched(true, roomId);
        setSearching(false);
      };

      const handleSearchStopped = () => {
        console.log('Search stopped');
        setSearching(false);
      };

      const handleReceiveMessage = (message) => {
        console.log('Message received:', message.content);
        addMessage({
          text: message.content,
          sender: 'partner',
          timestamp: message.timestamp
        });
      };

      const handlePartnerDisconnected = () => {
        console.log('Partner disconnected');
        setPartnerConnected(false);
      };

      // Only add listeners if not already added (socket might already have them from AuthCallback)
      socket.off('loginSuccess').on('loginSuccess', handleLoginSuccess);
      socket.off('connect').on('connect', handleConnect);
      socket.off('disconnect').on('disconnect', handleDisconnect);
      socket.off('matched').on('matched', handleMatched);
      socket.off('searchStopped').on('searchStopped', handleSearchStopped);
      socket.off('receiveMessage').on('receiveMessage', handleReceiveMessage);
      socket.off('partnerDisconnected').on('partnerDisconnected', handlePartnerDisconnected);
      
      // Only connect if not already connected
      if (!socket.connected) {
        socket.connect();
      }

      return () => {
        socket.off('loginSuccess', handleLoginSuccess);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('matched', handleMatched);
        socket.off('searchStopped', handleSearchStopped);
        socket.off('receiveMessage', handleReceiveMessage);
        socket.off('partnerDisconnected', handlePartnerDisconnected);
      };
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