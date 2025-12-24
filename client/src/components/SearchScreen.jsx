import { useState } from 'react';
import useChatStore from '../store/chatStore';
import { getSocket } from '../services/socket';
import logo from '../assets/logo.png';

const SearchScreen = () => {
  const { isSearching, setSearching } = useChatStore();
  const socket = getSocket();

  const handleSearch = () => {
    if (!socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    setSearching(true);
    socket.emit('search');
  };

  const handleStopSearch = () => {
    if (!socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    setSearching(false);
    socket.emit('stopSearch');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="search-logo">
            <img src={logo} alt="USChika Logo" />
          </div>
          <p className="text-gray-600 mb-8">Anonymous 1-on-1 Chat for USC Students</p>
          
          {!isSearching ? (
            <div>
              <button
                onClick={handleSearch}
                className="hero-button"
              >
                Find a Chat Partner
              </button>
              <p className="text-sm text-gray-500 mt-4">
                Connect with random USC students anonymously
              </p>
            </div>
          ) : (
            <div>
              <button
                onClick={handleStopSearch}
                className="hero-button"
              >
                Cancel Search
              </button>
              <div className="mb-6">
                <div className="flex justify-center items-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-gray-700 font-medium">Searching for a partner...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchScreen;