import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uschika';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Matchmaking queue
const waitingUsers = new Set();
const activeChats = new Map(); // socketId -> { partnerId, roomId }

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle search for partner
  socket.on('search', () => {
    console.log('User searching:', socket.id);
    
    // Check if user is already in queue
    if (waitingUsers.has(socket.id)) {
      return;
    }

    // Check if there's someone waiting
    if (waitingUsers.size > 0) {
      // Get the first waiting user
      const partnerId = Array.from(waitingUsers)[0];
      waitingUsers.delete(partnerId);

      // Create a room for these two users
      const roomId = `room-${socket.id}-${partnerId}`;
      
      // Join both users to the room
      socket.join(roomId);
      io.sockets.sockets.get(partnerId)?.join(roomId);

      // Store active chat info
      activeChats.set(socket.id, { partnerId, roomId });
      activeChats.set(partnerId, { partnerId: socket.id, roomId });

      // Notify both users they're matched
      socket.emit('matched', { roomId });
      io.to(partnerId).emit('matched', { roomId });
      
      console.log(`Matched ${socket.id} with ${partnerId} in ${roomId}`);
    } else {
      // Add user to waiting queue
      waitingUsers.add(socket.id);
      socket.emit('searching');
      console.log('User added to queue:', socket.id);
    }
  });

  // Handle stop searching
  socket.on('stopSearch', () => {
    waitingUsers.delete(socket.id);
    socket.emit('searchStopped');
    console.log('User stopped searching:', socket.id);
  });

  // Handle sending messages
  socket.on('sendMessage', (message) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;
      // Send message to partner only
      socket.to(roomId).emit('receiveMessage', {
        message,
        timestamp: Date.now()
      });
      console.log(`Message sent in room ${roomId}`);
    }
  });

  // Handle ending chat
  socket.on('endChat', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;
      
      // Notify partner that chat ended
      socket.to(roomId).emit('partnerDisconnected');
      
      // Leave room
      socket.leave(roomId);
      io.sockets.sockets.get(partnerId)?.leave(roomId);
      
      // Clean up
      activeChats.delete(socket.id);
      activeChats.delete(partnerId);
      
      console.log(`Chat ended in room ${roomId}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from waiting queue
    waitingUsers.delete(socket.id);
    
    // Handle active chat
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;
      
      // Notify partner
      socket.to(roomId).emit('partnerDisconnected');
      
      // Clean up
      activeChats.delete(socket.id);
      activeChats.delete(partnerId);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
