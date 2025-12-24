import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

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
  },
  // Add connection rate limiting
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
  }
});

// Constants
const MAX_MESSAGE_LENGTH = 1000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@usc\.edu\.ph$/;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use('/assets', express.static('assets'));

// Rate limiting for magic link requests
const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: { error: 'Too many magic link requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth', apiLimiter);

// MongoDB connection with improved options
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uschika';
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

// MongoDB schemas
const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => EMAIL_REGEX.test(v),
      message: 'Invalid email format'
    }
  },
  displayName: { 
    type: String,
    trim: true,
    maxlength: 50
  },
  createdAt: { type: Date, default: Date.now }
});

// Index for faster lookups
UserSchema.index({ email: 1 });
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true,
    index: true
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    maxlength: MAX_MESSAGE_LENGTH
  },
  timestamp: { type: Date, default: Date.now }
});

// Auto-delete messages after 24h
MessageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
// Compound index for room queries
MessageSchema.index({ roomId: 1, timestamp: -1 });
const Message = mongoose.model('Message', MessageSchema);

// Matchmaking queue
const waitingUsers = []; // FIFO queue
const activeChats = new Map(); // socket.id -> { partnerId, roomId }

// Helper: verify JWT
function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Helper: sanitize string input
function sanitizeInput(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// Helper: validate email format
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.toLowerCase().trim());
}

// Socket rate limiting map
const socketRateLimits = new Map();

function checkSocketRateLimit(socketId, action, maxPerMinute = 60) {
  const key = `${socketId}:${action}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  if (!socketRateLimits.has(key)) {
    socketRateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  const limit = socketRateLimits.get(key);
  
  if (now - limit.windowStart > windowMs) {
    // Reset window
    socketRateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (limit.count >= maxPerMinute) {
    return false;
  }

  limit.count++;
  return true;
}

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of socketRateLimits.entries()) {
    if (now - value.windowStart > 120000) { // 2 minutes
      socketRateLimits.delete(key);
    }
  }
}, 60000); // Every minute

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate user
  socket.on('login', async ({ token }) => {
    const userData = verifyToken(token);
    if (!userData) {
      socket.emit('unauthorized');
      return socket.disconnect();
    }

    try {
      const email = userData.email?.toLowerCase().trim();
      const displayName = sanitizeInput(userData.displayName, 50);

      if (!isValidEmail(email)) {
        socket.emit('unauthorized');
        return socket.disconnect();
      }

      // Find or create user in the database
      let user = await User.findOne({ email });
      if (!user) {
        user = new User({ email, displayName });
        await user.save();
      }

      // Store user info on the socket object for later use
      socket.user = user;
      console.log(`User ${user.displayName} authenticated with socket ${socket.id}`);

      // Confirm successful login to the client
      socket.emit('loginSuccess', {
        user: {
          id: user._id,
          displayName: user.displayName,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Error during login process:', error);
      socket.emit('unauthorized');
      socket.disconnect();
    }
  });

  // Handle search for partner
  socket.on('search', () => {
    if (!socket.user) {
      socket.emit('unauthorized');
      return;
    }

    // Rate limit search requests
    if (!checkSocketRateLimit(socket.id, 'search', 10)) {
      console.log('Search rate limit exceeded for:', socket.user.displayName);
      return;
    }

    console.log('User searching:', socket.user.displayName);

    // Prevent duplicate queue entries
    if (waitingUsers.some(s => s.id === socket.id)) {
      socket.emit('searching');
      return;
    }

    // Find a partner with a different email address
    const partnerIndex = waitingUsers.findIndex(
      (waitingSocket) => waitingSocket.user.email !== socket.user.email
    );

    if (partnerIndex !== -1) {
      // A suitable partner was found, remove them from the queue
      const [partnerSocket] = waitingUsers.splice(partnerIndex, 1);

      const roomId = `room-${socket.id}-${partnerSocket.id}`;
      socket.join(roomId);
      partnerSocket.join(roomId);

      activeChats.set(socket.id, { partnerId: partnerSocket.id, roomId });
      activeChats.set(partnerSocket.id, { partnerId: socket.id, roomId });

      // Notify both users
      socket.emit('matched', { roomId });
      partnerSocket.emit('matched', { roomId });
      console.log(`Matched ${socket.user.displayName} with ${partnerSocket.user.displayName} in ${roomId}`);
    } else {
      // No suitable partner found. Add the current user to the queue.
      waitingUsers.push(socket);
      socket.emit('searching');
      console.log('User added to waiting queue:', socket.user.displayName);
    }
  });

  // Stop searching
  socket.on('stopSearch', () => {
    const index = waitingUsers.findIndex(s => s.id === socket.id);
    if (index !== -1) waitingUsers.splice(index, 1);
    socket.emit('searchStopped');
    console.log('User stopped searching:', socket.user?.displayName);
  });

  // Send message
  socket.on('sendMessage', async ({ content }) => {
    // Rate limit messages
    if (!checkSocketRateLimit(socket.id, 'message', 30)) {
      console.log('Message rate limit exceeded for:', socket.user?.displayName);
      return;
    }

    const chatInfo = activeChats.get(socket.id);
    
    // Validate content
    if (!chatInfo || !socket.user) {
      return;
    }

    if (typeof content !== 'string') {
      console.error(`Invalid message type from socket ${socket.id}`);
      return;
    }

    const sanitizedContent = sanitizeInput(content, MAX_MESSAGE_LENGTH);
    
    if (sanitizedContent.length === 0) {
      console.error(`Empty message from socket ${socket.id}`);
      return;
    }

    const { roomId } = chatInfo;

    try {
      // Save message in DB
      await Message.create({ 
        roomId, 
        sender: socket.user._id, 
        content: sanitizedContent 
      });

      // Emit to partner
      socket.to(roomId).emit('receiveMessage', {
        sender: socket.user._id,
        content: sanitizedContent,
        timestamp: Date.now()
      });
      console.log(`Message sent in room ${roomId}`);
    } catch (error) {
      console.error('Error saving or sending message:', error);
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

    // Clean up rate limits for this socket
    for (const key of socketRateLimits.keys()) {
      if (key.startsWith(socket.id)) {
        socketRateLimits.delete(key);
      }
    }

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
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
    activeConnections: io.engine.clientsCount,
    waitingQueue: waitingUsers.length,
    activeChats: activeChats.size / 2
  });
});

// Email verification and magic link generation
app.post('/auth/magic-link', magicLinkLimiter, async (req, res) => {
  const { email } = req.body;

  // Validate email
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email domain. Only @usc.edu.ph emails are allowed.' });
  }

  // Generate a short-lived JWT (15 minutes)
  const displayName = normalizedEmail.split('@')[0];
  const token = jwt.sign(
    { email: normalizedEmail, displayName },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Create the magic link
  const magicLink = `${process.env.CLIENT_URL}/auth?token=${token}`;

  // Send the magic link via email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: 'USChika Magic Link',
      html: `<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px; background-color:#ffffff; border-radius:8px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img 
                src="${process.env.CLIENT_URL}/assets/logo.png" 
                alt="Logo" 
                width="96" 
                height="96" 
                style="display:block; border-radius:8px; object-fit:contain;"
              />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:20px; color:#333333; font-size:16px;">
              Click the button below to log in:
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a 
                href="${magicLink}" 
                style="
                  display:inline-block;
                  padding:12px 24px;
                  background-color:#7ed957;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:6px;
                  font-size:15px;
                  font-weight:600;
                "
              >
                Log In
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px; font-size:13px; color:#666666;">
              Or copy and paste this link into your browser:<br />
              <a href="${magicLink}" style="color:#000000; word-break:break-all;">
                ${magicLink}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="font-size:12px; color:#999999; line-height:1.5;">
              If you did not request this login link, you can safely ignore this email.<br />
              This link expires in 15 minutes.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>`
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

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ 
      email: decoded.email, 
      displayName: decoded.displayName 
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token has expired. Please request a new magic link.' });
    } else {
      res.status(401).json({ error: 'Invalid token.' });
    }
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const server = httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close all socket connections
  io.close(() => {
    console.log('Socket.IO server closed');
  });

  // Close MongoDB connection
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }

  // Exit process
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));