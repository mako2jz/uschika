import { useEffect } from 'react';
import useChatStore from './store/chatStore';
import { getSocket } from './services/socket';
import SearchScreen from './components/SearchScreen';
import ChatWindow from './components/ChatWindow';

function App() {
  const { connected, setConnected, isMatched, setMatched, setSearching, addMessage, setPartnerConnected, resetChat } = useChatStore();

  useEffect(() => {
    const socket = getSocket();

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Matchmaking event handlers
    socket.on('searching', () => {
      console.log('Searching for partner...');
      setSearching(true);
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

    // Message event handlers
    socket.on('receiveMessage', ({ message, timestamp }) => {
      console.log('Message received:', message);
      addMessage({
        text: message,
        sender: 'partner',
        timestamp
      });
    });

    // Disconnect event handlers
    socket.on('partnerDisconnected', () => {
      console.log('Partner disconnected');
      setPartnerConnected(false);
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('searching');
      socket.off('matched');
      socket.off('searchStopped');
      socket.off('receiveMessage');
      socket.off('partnerDisconnected');
    };
  }, [setConnected, setMatched, setSearching, addMessage, setPartnerConnected, resetChat]);

  return (
    <div className="App">
      {!isMatched ? <SearchScreen /> : <ChatWindow />}
    </div>
  );
}

export default App;
