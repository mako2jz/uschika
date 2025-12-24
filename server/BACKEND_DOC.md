# Server API Documentation

## Overview

This document provides details about the backend server implemented in `index.js`. It includes information on the API structure (REST and WebSocket), authentication (JWT & magic links), email-based workflows, security implementations, and important events for integration with the frontend.

---

## Table of Contents

1. [General Information](#1-general-information)
2. [MongoDB Models & Schema](#2-mongodb-models--schema)
3. [REST Endpoints](#3-rest-endpoints)
4. [WebSocket Events](#4-websocket-events)
5. [Environment Variables](#5-environment-variables)
6. [Security Features](#6-security-features)
7. [Key Features](#7-key-features)
8. [Example Workflow for Frontend](#8-example-workflow-for-frontend)
9. [Production Recommendations](#9-production-recommendations)

---

## 1. General Information

| Property | Value |
|----------|-------|
| **Backend Framework** | Express.js |
| **Realtime Communication** | Socket.IO |
| **Database** | MongoDB (via Mongoose) |
| **Authentication** | JWT-based magic link |
| **Email Transport** | Nodemailer (Gmail SMTP) |
| **Default Port** | 5000 |

### Dependencies

```json
{
  "express": "^4.x",
  "socket.io": "^4.x",
  "mongoose": "^8.x",
  "jsonwebtoken": "^9.x",
  "nodemailer": "^6.x",
  "helmet": "^7.x",
  "express-rate-limit": "^7.x",
  "cors": "^2.x",
  "dotenv": "^16.x"
}
```

---

## 2. MongoDB Models & Schema

### **User Schema**

| Field | Type | Required | Unique | Constraints | Description |
|-------|------|----------|--------|-------------|-------------|
| `_id` | ObjectId | Yes | Yes | Auto-generated | MongoDB document ID |
| `email` | String | Yes | Yes | lowercase, trim, regex validated | User's USC email address |
| `displayName` | String | No | No | trim, maxlength: 50 | Display name (from email prefix) |
| `createdAt` | Date | No | No | Default: `Date.now` | Account creation timestamp |

**Indexes:**
- `{ email: 1 }` - For faster email lookups

**Validation:**
- Email must match: `/^[a-zA-Z0-9._%+-]+@usc\.edu\.ph$/`

---

### **Message Schema**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `_id` | ObjectId | Yes | Auto-generated | MongoDB document ID |
| `roomId` | String | Yes | indexed | Chat room identifier |
| `sender` | ObjectId | Yes | ref: 'User' | Reference to sender User |
| `content` | String | Yes | maxlength: 1000 | Message text content |
| `timestamp` | Date | No | Default: `Date.now` | Message creation timestamp |

**Indexes:**
- `{ timestamp: 1 }` - TTL index, expires after 24 hours
- `{ roomId: 1, timestamp: -1 }` - Compound index for room queries

> **Note**: Messages automatically expire and are deleted after **24 hours** via MongoDB TTL.

---

## 3. REST Endpoints

### **1. Health Check**

Returns server health status with detailed metrics.

```http
GET /health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-12-24T12:00:00.000Z",
  "mongodb": "connected",
  "activeConnections": 42,
  "waitingQueue": 5,
  "activeChats": 18
}
```

| Field | Description |
|-------|-------------|
| `status` | Server status ("ok") |
| `timestamp` | Current server time (ISO 8601) |
| `mongodb` | Database connection status |
| `activeConnections` | Number of connected WebSocket clients |
| `waitingQueue` | Users waiting for a match |
| `activeChats` | Number of active chat sessions |

---

### **2. Request Magic Link**

Generates and sends a JWT-based magic link to the user's email.

```http
POST /auth/magic-link
```

**Rate Limit:** 5 requests per 15 minutes per IP

**Request Body:**
```json
{
  "email": "username@usc.edu.ph"
}
```

**Validation Rules:**
- Email is required and must be a string
- Email must match `@usc.edu.ph` domain
- Email is normalized (lowercase, trimmed)

**Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 200 | Success | `{ "message": "Magic link sent successfully." }` |
| 400 | Missing email | `{ "error": "Email is required." }` |
| 400 | Invalid domain | `{ "error": "Invalid email domain. Only @usc.edu.ph emails are allowed." }` |
| 429 | Rate limited | `{ "error": "Too many magic link requests. Please try again later." }` |
| 500 | Email failure | `{ "error": "Failed to send magic link." }` |

**Token Details:**
- **Algorithm:** HS256
- **Expiration:** 15 minutes
- **Payload:** `{ email, displayName }`

---

### **3. Verify Token**

Validates a JWT token from the magic link.

```http
POST /auth/verify-token
```

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Responses:**

| Status | Condition | Response Body |
|--------|-----------|---------------|
| 200 | Valid token | `{ "email": "user@usc.edu.ph", "displayName": "user" }` |
| 400 | Missing token | `{ "error": "Token is required." }` |
| 401 | Expired token | `{ "error": "Token has expired. Please request a new magic link." }` |
| 401 | Invalid token | `{ "error": "Invalid token." }` |

---

### **4. Static Assets**

Serves static files from the `assets` directory.

```http
GET /assets/{filename}
```

**Example:**
```http
GET /assets/logo.png
```

---

### **5. 404 Handler**

All unmatched routes return a 404 error.

```http
GET /any-undefined-route
```

**Response (404):**
```json
{
  "error": "Not found"
}
```

---

## 4. WebSocket Events

### **Connection Configuration**

```javascript
{
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000 // 2 minutes
  }
}
```

---

### **Client-to-Server Events**

| Event | Payload | Description | Auth Required | Rate Limit |
|-------|---------|-------------|---------------|------------|
| `login` | `{ token: String }` | Authenticates socket with JWT | No | - |
| `search` | None | Request to find a chat partner | Yes | 10/min |
| `stopSearch` | None | Cancel partner search | Yes | - |
| `sendMessage` | `{ content: String }` | Send message to partner | Yes | 30/min |
| `endChat` | None | End current chat session | Yes | - |

---

### **Server-to-Client Events**

| Event | Payload | Description |
|-------|---------|-------------|
| `unauthorized` | None | JWT authentication failed |
| `loginSuccess` | `{ user: { id, displayName, email } }` | Authentication successful |
| `searching` | None | Added to matchmaking queue |
| `searchStopped` | None | Removed from matchmaking queue |
| `matched` | `{ roomId: String }` | Successfully matched with partner |
| `receiveMessage` | `{ sender, content, timestamp }` | New message from partner |
| `partnerDisconnected` | None | Partner disconnected or ended chat |

---

### **Event Flow Diagram**

```
Client                          Server
  |                               |
  |-- connect ------------------>|
  |                               |
  |-- login { token } ---------->|
  |                               |-- Verify JWT
  |                               |-- Find/Create User
  |<-- loginSuccess { user } ----|
  |                               |
  |-- search ------------------->|
  |<-- searching ----------------|  (if no partner)
  |<-- matched { roomId } -------|  (if partner found)
  |                               |
  |-- sendMessage { content } -->|
  |                               |-- Save to DB
  |                               |-- Emit to partner
  |                               |
  |<-- receiveMessage -----------|  (from partner)
  |                               |
  |-- endChat ------------------>|
  |                               |-- Notify partner
  |<-- partnerDisconnected ------|  (to partner)
  |                               |
```

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for signing JWT tokens |
| `EMAIL_USER` | Yes | - | Gmail address for sending magic links |
| `EMAIL_PASS` | Yes | - | Gmail app password for SMTP |
| `CLIENT_URL` | Yes | - | Frontend URL for CORS and magic links |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `PORT` | No | `5000` | Server listening port |

> **Important**: The server will exit with an error if any required variable is missing.

### **Example `.env` File**

```env
JWT_SECRET=your-super-secret-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/uschika
PORT=5000
```

---

## 6. Security Features

### **6.1 HTTP Security Headers (Helmet)**

```javascript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
})
```

### **6.2 Rate Limiting**

| Endpoint/Action | Limit | Window |
|-----------------|-------|--------|
| `/auth/magic-link` | 5 requests | 15 minutes |
| `/auth/*` (general) | 100 requests | 15 minutes |
| Socket: `search` | 10 requests | 1 minute |
| Socket: `sendMessage` | 30 requests | 1 minute |

### **6.3 Input Validation & Sanitization**

- **Email validation**: Regex pattern `/^[a-zA-Z0-9._%+-]+@usc\.edu\.ph$/`
- **Message sanitization**: Trimmed and limited to 1000 characters
- **Request body limit**: 10kb maximum
- **Display name limit**: 50 characters maximum

### **6.4 JWT Security**

- Short-lived tokens (15 minutes for magic links)
- Token verification on every protected operation
- Invalid tokens result in immediate disconnection

### **6.5 Self-Match Prevention**

Users cannot be matched with their own email address (prevents multi-tab abuse).

### **6.6 Graceful Shutdown**

Server handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new connections
2. Closes all WebSocket connections
3. Closes MongoDB connection
4. Exits cleanly

---

## 7. Key Features

### **7.1 Magic Link Authentication**

**Flow:**
```
1. User submits email → POST /auth/magic-link
2. Server validates @usc.edu.ph domain
3. Server generates 15-minute JWT
4. Magic link sent via Gmail SMTP
5. User clicks link → redirected to frontend
6. Frontend verifies token → POST /auth/verify-token
7. Token stored for WebSocket authentication
```

### **7.2 Matchmaking System**

**Queue Mechanism:**
- FIFO (First In, First Out) queue
- Prevents self-matching (email-based check)
- Prevents duplicate queue entries
- Automatic cleanup on disconnect

**Room Management:**
- Room ID format: `room-{socket1.id}-{socket2.id}`
- Socket.IO rooms for private messaging
- Active chat tracking via `Map<socketId, { partnerId, roomId }>`

### **7.3 Message Handling**

- Content validation (non-empty string, max 1000 chars)
- Sanitization before storage
- Persisted to MongoDB with sender reference
- Real-time delivery via WebSocket
- Auto-expiration after 24 hours

### **7.4 Connection State Recovery**

Socket.IO configured with connection state recovery:
- Max disconnection duration: 2 minutes
- Automatic reconnection handling

---

## 8. Example Workflow for Frontend

### **Step 1: Request Magic Link**

```javascript
const response = await fetch('http://localhost:5000/auth/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@usc.edu.ph' })
});

const data = await response.json();
// Success: { message: "Magic link sent successfully." }
// Error: { error: "Invalid email domain..." }
```

### **Step 2: Verify Token**

```javascript
const params = new URLSearchParams(window.location.search);
const token = params.get('token');

const response = await fetch('http://localhost:5000/auth/verify-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});

if (response.ok) {
  const { email, displayName } = await response.json();
  localStorage.setItem('authToken', token);
  // Clear token from URL
  window.history.replaceState({}, document.title, '/auth');
}
```

### **Step 3: Connect and Authenticate WebSocket**

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { 
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5
});

socket.connect();

socket.on('connect', () => {
  const token = localStorage.getItem('authToken');
  socket.emit('login', { token });
});

socket.on('loginSuccess', ({ user }) => {
  console.log('Authenticated as:', user.displayName);
});

socket.on('unauthorized', () => {
  localStorage.removeItem('authToken');
  window.location.href = '/';
});
```

### **Step 4: Search for Partner**

```javascript
socket.emit('search');

socket.on('searching', () => {
  console.log('Looking for a partner...');
});

socket.on('matched', ({ roomId }) => {
  console.log('Matched in room:', roomId);
});
```

### **Step 5: Send and Receive Messages**

```javascript
// Send message
const sendMessage = (content) => {
  if (content.trim().length > 0 && content.length <= 1000) {
    socket.emit('sendMessage', { content: content.trim() });
  }
};

// Receive messages
socket.on('receiveMessage', ({ sender, content, timestamp }) => {
  console.log(`[${new Date(timestamp).toLocaleTimeString()}] ${content}`);
});
```

### **Step 6: End Chat**

```javascript
socket.emit('endChat');

socket.on('partnerDisconnected', () => {
  console.log('Partner has left the chat');
});
```

---

## 9. Production Recommendations

### **Security Enhancements**

| Recommendation | Priority | Status |
|----------------|----------|--------|
| Use httpOnly cookies for tokens | High | Not implemented |
| Enable HTTPS/WSS | High | Not implemented |
| Add CSRF protection | Medium | Not implemented |
| MongoDB authentication & TLS | High | Not implemented |
| Content Security Policy tuning | Medium | Basic implementation |

### **Performance Optimizations**

| Recommendation | Priority | Status |
|----------------|----------|--------|
| Redis for session/rate limiting | Medium | Not implemented |
| Horizontal scaling with Redis adapter | Medium | Not implemented |
| Connection pooling optimization | Low | Implemented (maxPoolSize: 10) |
| Message queue for high traffic | Low | Not implemented |

### **Monitoring**

| Recommendation | Priority | Status |
|----------------|----------|--------|
| Structured logging (Winston/Pino) | Medium | Not implemented |
| APM integration (New Relic, Datadog) | Medium | Not implemented |
| Health check alerts | Medium | Basic endpoint implemented |

### **Infrastructure**

```
Production Architecture:
                                    
  [Load Balancer]                   
        |                           
  [Node.js Cluster]                 
    |         |                     
[Worker 1] [Worker 2] ...           
    |         |                     
  [Redis] ----+---- [MongoDB Atlas] 
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-24 | Initial documentation |
| 1.1.0 | 2025-12-24 | Added security features: rate limiting, helmet, input sanitization, graceful shutdown |