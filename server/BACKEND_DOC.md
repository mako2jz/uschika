# Server API Documentation

## Overview

This document provides details about the backend server implemented in `index.js`. It includes information on the API structure (REST and WebSocket), authentication (JWT & magic links), email-based workflows, and important events for integration with the frontend.

---

## Table of Contents

1. [General Information](#general-information)
2. [MongoDB Models & Schema](#mongodb-models--schema)
3. [REST Endpoints](#rest-endpoints)
4. [WebSocket Events](#websocket-events)
5. [Environment Variables](#environment-variables)
6. [Key Features](#key-features)
    - [Authentication (Magic Link)](#61-authentication-magic-link)
    - [Realtime Matchmaking & Messaging](#62-realtime-matchmaking--messaging)
    - [Chat Expiration and Auto-Cleanup](#63-chat-expiration-and-auto-cleanup)
7. [Example Workflow for Frontend](#example-workflow-for-frontend)
8. [Security Considerations](#security-considerations)

---

## 1. General Information

- **Backend framework**: **Express.js**
- **Realtime communication**: **Socket.IO**
- **Database**: **MongoDB** (connected via **Mongoose**)
- **Authentication**: 
  - Magic link-based login
  - JWT token verification for API and WebSocket connections
- **Email transport**: **Nodemailer** (SMTP-based email delivery for magic links)
- **Default Port**: `5000` (configurable via environment variables)

---

## 2. MongoDB Models & Schema

### **User Schema**
| Field        | Type     | Required | Unique | Default          | Description                     |
|--------------|----------|----------|--------|------------------|---------------------------------|
| `_id`        | ObjectId | Yes      | Yes    | Auto-generated   | MongoDB document ID             |
| `email`      | String   | Yes      | Yes    | -                | User's USC email address        |
| `displayName`| String   | No       | No     | -                | Display name (from email prefix)|
| `createdAt`  | Date     | No       | No     | `Date.now`       | Account creation timestamp      |

### **Message Schema**
| Field       | Type     | Required | Default     | Description                              |
|-------------|----------|----------|-------------|------------------------------------------|
| `_id`       | ObjectId | Yes      | Auto-generated | MongoDB document ID                    |
| `roomId`    | String   | Yes      | -           | Chat room identifier                     |
| `sender`    | ObjectId | Yes      | -           | Reference to User who sent the message   |
| `content`   | String   | Yes      | -           | Message text content                     |
| `timestamp` | Date     | No       | `Date.now`  | Message creation timestamp               |

> **Note**: Messages have a TTL index and will **auto-expire** after **24 hours**.

---

## 3. REST Endpoints

### **1. Health Check**
Returns the server's current health status and timestamp.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-24T12:00:00.000Z"
}
```

---

### **2. Request Magic Link**
Generates and sends a short-lived JWT-based magic link to the user's email.

```http
POST /auth/magic-link
```

**Request Body:**
```json
{
  "email": "username@usc.edu.ph"
}
```

**Validation Rules:**
- Email must end with `@usc.edu.ph` domain

**Responses:**

| Status | Condition               | Response Body                                                              |
|--------|-------------------------|----------------------------------------------------------------------------|
| 200    | Success                 | `{ "message": "Magic link sent successfully." }`                           |
| 400    | Invalid email domain    | `{ "error": "Invalid email domain. Only @usc.edu.ph emails are allowed." }`|
| 500    | Email delivery failure  | `{ "error": "Failed to send magic link." }`                                |

**Token Details:**
- Expiration: 15 minutes
- Payload: `{ email, displayName }`
- `displayName` is derived from email prefix (before `@`)

---

### **3. Verify Token**
Validates the JWT token from the magic link and retrieves user information.

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

| Status | Condition      | Response Body                                                    |
|--------|----------------|------------------------------------------------------------------|
| 200    | Valid token    | `{ "email": "user@usc.edu.ph", "displayName": "user" }`          |
| 401    | Expired token  | `{ "error": "Token has expired. Please request a new magic link." }` |
| 401    | Invalid token  | `{ "error": "Invalid token." }`                                  |

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

## 4. WebSocket Events

WebSocket communication is handled via **Socket.IO** with CORS configured for the client URL.

### **Connection Configuration**
```javascript
{
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
}
```

### **Client-to-Server Events**

| Event         | Payload               | Description                                      | Auth Required |
|---------------|-----------------------|--------------------------------------------------|---------------|
| `login`       | `{ token: String }`   | Authenticates the socket connection with JWT     | No            |
| `search`      | None                  | Requests to search for a chat partner            | Yes           |
| `stopSearch`  | None                  | Cancels the partner search and leaves queue      | Yes           |
| `sendMessage` | `{ content: String }` | Sends a message to the matched partner           | Yes           |
| `endChat`     | None                  | Ends the current chat session                    | Yes           |

### **Server-to-Client Events**

| Event                 | Payload                                                      | Description                                      |
|-----------------------|--------------------------------------------------------------|--------------------------------------------------|
| `unauthorized`        | None                                                         | JWT authentication failed                        |
| `loginSuccess`        | `{ user: { id, displayName, email } }`                       | Authentication successful                        |
| `searching`           | None                                                         | User added to matchmaking queue                  |
| `searchStopped`       | None                                                         | User removed from matchmaking queue              |
| `matched`             | `{ roomId: String }`                                         | Successfully matched with a partner              |
| `receiveMessage`      | `{ sender: ObjectId, content: String, timestamp: Number }`   | New message received from partner                |
| `partnerDisconnected` | None                                                         | Chat partner has disconnected or ended the chat  |

---

## 5. Environment Variables

All required environment variables must be set before starting the server.

| Variable       | Required | Default                              | Description                                      |
|----------------|----------|--------------------------------------|--------------------------------------------------|
| `JWT_SECRET`   | Yes      | -                                    | Secret key for signing/verifying JWT tokens      |
| `EMAIL_USER`   | Yes      | -                                    | Gmail address for sending magic links            |
| `EMAIL_PASS`   | Yes      | -                                    | Gmail app password for SMTP authentication       |
| `CLIENT_URL`   | Yes      | -                                    | Frontend URL for CORS and magic link generation  |
| `MONGODB_URI`  | Yes      | -                                    | MongoDB connection string                        |
| `PORT`         | No       | `5000`                               | Server listening port                            |

> **Note**: The server will exit with an error if any required environment variable is missing.

---

## 6. Key Features

### 6.1 Authentication: Magic Link

**Flow:**
1. User submits email via `/auth/magic-link`
2. Server validates `@usc.edu.ph` domain
3. Server generates 15-minute JWT with `{ email, displayName }`
4. Magic link is emailed to user via Gmail SMTP
5. User clicks link, frontend extracts token
6. Frontend verifies token via `/auth/verify-token`
7. Token stored client-side for WebSocket authentication

**Security Features:**
- Short-lived tokens (15 minutes)
- Domain-restricted emails (`@usc.edu.ph` only)
- No passwords stored

---

### 6.2 Realtime Matchmaking & Messaging

**Matchmaking Queue:**
- FIFO (First In, First Out) queue system
- Users cannot match with themselves (email-based check)
- Automatic queue cleanup on disconnect

**Chat Rooms:**
- Unique room ID format: `room-{socket1.id}-{socket2.id}`
- Private rooms using Socket.IO room feature
- Active chat tracking via `Map<socketId, { partnerId, roomId }>`

**Message Validation:**
- Content must be a non-empty string
- Messages persisted to MongoDB
- Real-time delivery to partner via WebSocket

---

### 6.3 Chat Expiration and Auto-Cleanup

**Message TTL:**
- MongoDB TTL index on `timestamp` field
- Messages automatically deleted after **24 hours**
- No manual cleanup required

**Session Cleanup:**
- Users removed from queue on disconnect
- Partners notified via `partnerDisconnected` event
- Active chat mappings cleaned up automatically

---

## 7. Example Workflow for Frontend

### Step 1: Request Magic Link
```javascript
const response = await fetch('http://localhost:5000/auth/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student@usc.edu.ph' })
});

const data = await response.json();
// { message: "Magic link sent successfully." }
```

### Step 2: Verify Token (After User Clicks Link)
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
}
```

### Step 3: Connect WebSocket and Authenticate
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { autoConnect: false });
socket.connect();

socket.on('connect', () => {
  const token = localStorage.getItem('authToken');
  socket.emit('login', { token });
});

socket.on('loginSuccess', ({ user }) => {
  console.log('Authenticated as:', user.displayName);
});

socket.on('unauthorized', () => {
  console.error('Authentication failed');
  localStorage.removeItem('authToken');
});
```

### Step 4: Search for a Partner
```javascript
socket.emit('search');

socket.on('searching', () => {
  console.log('Looking for a partner...');
});

socket.on('matched', ({ roomId }) => {
  console.log('Matched in room:', roomId);
});
```

### Step 5: Send and Receive Messages
```javascript
// Send a message
socket.emit('sendMessage', { content: 'Hello!' });

// Receive messages
socket.on('receiveMessage', ({ sender, content, timestamp }) => {
  console.log(`Message from ${sender}: ${content}`);
});
```

### Step 6: End Chat
```javascript
socket.emit('endChat');

socket.on('partnerDisconnected', () => {
  console.log('Partner has left the chat');
});
```

---

## 8. Security Considerations

### Current Implementations
- **JWT-based authentication** for all protected operations
- **Email domain restriction** (`@usc.edu.ph` only)
- **Short-lived tokens** (15-minute expiration for magic links)
- **Message validation** (non-empty string check)
- **Self-match prevention** (users cannot match with their own email)

### Recommendations for Production
- Use **httpOnly cookies** instead of localStorage for token storage
- Add **rate limiting** on `/auth/magic-link` endpoint
- Implement **CSRF protection** for REST endpoints
- Add **message content sanitization** on the server
- Configure **secure WebSocket connections** (WSS) in production
- Set up **MongoDB authentication** and use **TLS connections**
- Add **input length validation** for message content