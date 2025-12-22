import { create } from 'zustand';

const useChatStore = create((set) => ({
  // User state
  user: null,
  setUser: (user) => set({ user }),

  // Connection state
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Matching state
  isSearching: false,
  isMatched: false,
  roomId: null,
  setSearching: (isSearching) => set({ isSearching }),
  setMatched: (isMatched, roomId = null) => set({ isMatched, roomId }),

  // Messages
  messages: [],
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  clearMessages: () => set({ messages: [] }),

  // Partner status
  partnerConnected: true,
  setPartnerConnected: (partnerConnected) => set({ partnerConnected }),

  // Reset chat-specific state
  resetChat: () => set({
    isSearching: false,
    isMatched: false,
    roomId: null,
    messages: [],
    partnerConnected: true
  }),

  // Add a full logout reset
  logout: () => set({
    user: null,
    connected: false,
    isSearching: false,
    isMatched: false,
    roomId: null,
    messages: [],
    partnerConnected: true
  })
}));

export default useChatStore;