import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

dotenv.config();

const requiredEnvVars = ['JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'CLIENT_URL', 'MONGODB_URI'];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

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

// MongoDB schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  displayName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Auto-delete messages after 24h
MessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
const Message = mongoose.model('Message', MessageSchema);

// Matchmaking queue
const waitingUsers = []; // FIFO queue
const activeChats = new Map(); // socket.id -> { partnerId, roomId }

// Helper: verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate user
  socket.on('login', async ({ token }) => {
  const decoded = verifyToken(token);
  if (!decoded) {
    socket.emit('unauthorized');
    socket.disconnect();
    return;
  }

  try {
    // Check if user exists
    let user = await User.findOne({ email: decoded.email });
    if (!user) {
      user = await User.create({ email: decoded.email, displayName: decoded.displayName || '' });
    }

    socket.userId = user._id;
    socket.emit('loginSuccess', { userId: user._id, displayName: user.displayName });
    console.log(`User logged in: ${user.email}`);
  } catch (error) {
    console.error('Error during login:', error);
    socket.emit('error', { message: 'Internal server error during login.' });
    socket.disconnect();
  }
  });

  // Handle search for partner
  socket.on('search', () => {
    if (!socket.userId) {
      socket.emit('unauthorized');
      return;
    }

    console.log('User searching:', socket.userId);

    // Check for available partner
    if (waitingUsers.length > 0) {
      const partnerSocket = waitingUsers.shift();

      const roomId = `room-${socket.id}-${partnerSocket.id}`;
      socket.join(roomId);
      partnerSocket.join(roomId);

      activeChats.set(socket.id, { partnerId: partnerSocket.id, roomId });
      activeChats.set(partnerSocket.id, { partnerId: socket.id, roomId });

      // Notify both users
      socket.emit('matched', { roomId });
      partnerSocket.emit('matched', { roomId });
      console.log(`Matched ${socket.userId} with ${partnerSocket.userId} in ${roomId}`);
    } else {
      waitingUsers.push(socket);
      socket.emit('searching');
      console.log('User added to waiting queue:', socket.userId);
    }
  });

  // Stop searching
  socket.on('stopSearch', () => {
    const index = waitingUsers.findIndex(s => s.id === socket.id);
    if (index !== -1) waitingUsers.splice(index, 1);
    socket.emit('searchStopped');
    console.log('User stopped searching:', socket.userId);
  });

  // Send message
  socket.on('sendMessage', async ({ content }) => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;

      // Save message in DB (optional)
      await Message.create({ roomId, sender: socket.userId, content });

      // Emit to partner
      socket.to(roomId).emit('receiveMessage', {
        sender: socket.userId,
        content,
        timestamp: Date.now()
      });
      console.log(`Message sent in room ${roomId}`);
    }
  });

  // End chat
  socket.on('endChat', () => {
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;

      socket.to(roomId).emit('partnerDisconnected');
      socket.leave(roomId);
      io.sockets.sockets.get(partnerId)?.leave(roomId);

      activeChats.delete(socket.id);
      activeChats.delete(partnerId);
      console.log(`Chat ended in room ${roomId}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove from waiting queue
    const index = waitingUsers.findIndex(s => s.id === socket.id);
    if (index !== -1) waitingUsers.splice(index, 1);

    // Handle active chat
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo) {
      const { roomId, partnerId } = chatInfo;
      socket.to(roomId).emit('partnerDisconnected');
      activeChats.delete(socket.id);
      activeChats.delete(partnerId);
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Email verification and magic link generation
app.post('/auth/magic-link', async (req, res) => {
  const { email } = req.body;

  // Verify email ends with @usc.edu
  if (!email.endsWith('@usc.edu.ph')) {
    return res.status(400).json({ error: 'Invalid email domain. Only @usc.edu.ph emails are allowed.' });
  }

  // Generate a short-lived JWT (15 minutes)
  const token = jwt.sign(
    { email, displayName: email.split('@')[0] }, // Add displayName based on email prefix
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Create the magic link
  const magicLink = `${process.env.CLIENT_URL}/auth?token=${token}`;

  // Send the magic link via email
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email provider
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASS  // Your email password
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Magic Link for USChika',
      html: `<p>Click the link below to log in:</p><a href="${magicLink}">${magicLink}</a>`
    });

    res.status(200).json({ message: 'Magic link sent successfully.' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send magic link.' });
  }
});

// Verify the magic link token
app.post('/auth/verify-token', (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ email: decoded.email, displayName: decoded.displayName });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token has expired. Please request a new magic link.' });
    } else {
      res.status(401).json({ error: 'Invalid token.' });
    }
  }
});