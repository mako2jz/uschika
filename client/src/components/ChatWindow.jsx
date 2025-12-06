import { useState, useEffect, useRef } from 'react';
import useChatStore from '../store/chatStore';
import { getSocket } from '../services/socket';

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && partnerConnected) {
      // Add own message to the store
      addMessage({
        text: inputMessage,
        sender: 'me',
        timestamp: Date.now()
      });
      // Send message to partner via socket
      socket.emit('sendMessage', inputMessage);
      setInputMessage('');
    }
  };

  const handleEndChat = () => {
    socket.emit('endChat');
    resetChat();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[600px] flex flex-col">
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
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-300 font-medium"
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
                key={index}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.sender === 'me'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>
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
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={partnerConnected ? "Type a message..." : "Partner disconnected"}
              disabled={!partnerConnected}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || !partnerConnected}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
