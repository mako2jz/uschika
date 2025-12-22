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
app.use('/assets', express.static('assets'));

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
    const userData = verifyToken(token);
    if (!userData) {
      socket.emit('unauthorized');
      return socket.disconnect();
    }

    try {
      // Find or create user in the database
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        user = new User({ email: userData.email, displayName: userData.displayName });
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

    console.log('User searching:', socket.user.displayName);

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
      console.log(`Matched ${socket.user.displayName} with ${partnerSocket.user.displayName} in ${roomId}`);
    } else {
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
    const chatInfo = activeChats.get(socket.id);
    if (chatInfo && socket.user) {
      const { roomId } = chatInfo;

      // Save message in DB
      await Message.create({ roomId, sender: socket.user._id, content });

      // Emit to partner
      socket.to(roomId).emit('receiveMessage', {
        sender: socket.user._id,
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
      subject: 'USChika Magic Link',
      html: `<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <!-- White Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px; background-color:#ffffff; border-radius:8px; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img 
                src="http://localhost:5000/assets/logo.png" 
                alt="Logo" 
                width="96" 
                height="96" 
                style="display:block; border-radius:8px; object-fit:contain;"
              />
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td align="center" style="padding-bottom:20px; color:#333333; font-size:16px;">
              Click the button below to log in:
            </td>
          </tr>

          <!-- Magic Link Button -->
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

          <!-- Fallback Link -->
          <tr>
            <td align="center" style="padding-bottom:24px; font-size:13px; color:#666666;">
              Or copy and paste this link into your browser:<br />
              <a href="${magicLink}" style="color:#000000; word-break:break-all;">
                ${magicLink}
              </a>
            </td>
          </tr>

          <!-- Disclaimer -->
          <tr>
            <td align="center" style="font-size:12px; color:#999999; line-height:1.5;">
              If you did not request this login link, you can safely ignore this email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`
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