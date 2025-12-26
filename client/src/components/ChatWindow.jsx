import { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import { getSocket } from '../services/socket';

// Sanitize text to prevent any potential XSS when displaying
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Maximum message length to prevent abuse
const MAX_MESSAGE_LENGTH = 1000;

const ChatWindow = () => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { messages, addMessage, partnerConnected, resetChat } = useChatStore();
  const socket = getSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    // Limit input length
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setInputMessage(value);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmedMessage = inputMessage.trim();
    
    if (!trimmedMessage || !partnerConnected || !socket?.connected) {
      return;
    }

    // Validate message before sending
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    // Add own message to the store
    addMessage({
      text: trimmedMessage,
      sender: 'me',
      timestamp: Date.now()
    });
    
    // Send message to partner via socket with proper payload
    socket.emit('sendMessage', { content: trimmedMessage });
    setInputMessage('');
  };

  const handleEndChat = () => {
    if (socket?.connected) {
      socket.emit('endChat');
    }
    resetChat();
  };

  // Safe render function for message text
  const renderMessageText = (text) => {
    // React automatically escapes text content, but we add an extra layer
    return <p className="break-words">{text}</p>;
  };

  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">USChika Chat</h2>
            <p className="text-sm opacity-90">
              {partnerConnected ? 'Connected to stranger' : 'Partner disconnected'}
            </p>
          </div>
          <button
            onClick={handleEndChat}
            className="hero-button"
          >
            End Chat
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-center">
                Say hello to your chat partner! 👋
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`${msg.timestamp}-${index}`}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.sender === 'me'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {renderMessageText(msg.text)}
                  <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-white/70' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Disconnected Warning */}
        {!partnerConnected && (
          <div className="bg-yellow-100 border-t border-yellow-200 px-4 py-2">
            <p className="text-yellow-800 text-sm text-center">
              Your partner has disconnected. You can continue typing, but they won't receive messages.
            </p>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
          <div className="flex space-x-2 flex justify-center">
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={partnerConnected ? "Type a message..." : "Partner disconnected"}
              disabled={!partnerConnected}
              maxLength={MAX_MESSAGE_LENGTH}
              className="hero-input flex-1"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || !partnerConnected}
              className="hero-button"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">
            {inputMessage.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;