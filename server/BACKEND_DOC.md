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

---

## 1. General Information

- **Backend framework**: **Express.js**
- **Realtime communication**: **Socket.IO**
- **Database**: **MongoDB** (connected via **Mongoose**)
- **Authentication**: 
  - Magic link-based login
  - JWT token verification for API and WebSocket connections
- **Email transport**: **Nodemailer** (SMTP-based email delivery for magic links)
- **Hosted URL**: `http://localhost:5000` (default port or custom via environment variables)

---

## 2. MongoDB Models & Schema

### **User Schema**
```json
{
  "_id": "ObjectId",
  "email": "String (required, unique)",
  "displayName": "String",
  "createdAt": "Date (default: current timestamp)"
}
```

### **Message Schema**
```json
{
  "_id": "ObjectId",
  "roomId": "String (required, unique per chat room)",
  "sender": "ObjectId (ref: User, required)",
  "content": "String (required)",
  "timestamp": "Date (default: current timestamp)"
}
```
- **Index**: Messages will **auto-expire** and be deleted after **24 hours**.

---

## 3. REST Endpoints

### **1. Health Check**
Returns the server's current health status and timestamp.
```http
GET /health
```
- **Response JSON**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-06T12:00:00.000Z"
}
```

---

### **2. Magic Link: Request Link**
Generates and sends a short-lived JWT-based magic link to the user's email.

```http
POST /auth/magic-link
```
#### Request
- **Body**:
```json
{
  "email": "String (required, must end with @usc.edu.ph)"
}
```

#### Validation:
- Email must belong to the `@usc.edu.ph` domain.

#### Response
| Code  | Description                       | Body                                  |
|-------|-----------------------------------|---------------------------------------|
| 200   | Magic link sent                   | `{ "message": "Magic link sent successfully." }` |
| 400   | Invalid email domain              | `{ "error": "Invalid email domain. Only @usc.edu.ph emails are allowed." }` |
| 500   | Email delivery failure            | `{ "error": "Failed to send magic link." }` |

---

### **3. Magic Link: Verify Token**
Validates the short-lived JWT token and retrieves user information.

```http
POST /auth/verify-token
```
#### Request
- **Body**:
```json
{
  "token": "String (required, JWT token received via magic link)"
}
```

#### Response
| Code  | Description                       | Body                                  |
|-------|-----------------------------------|---------------------------------------|
| 200   | Token verified                    | `{ "email": "user@usc.edu.ph", "displayName": "user" }` |
| 401   | Token expired or invalid          | `{ "error": "Token has expired." }` or `{ "error": "Invalid token." }` |

---

## 4. WebSocket Events

WebSocket communication is handled via **Socket.IO**.

### **Client-to-Server Events**
| Event          | Payload                                   | Description                             |
|----------------|-------------------------------------------|-----------------------------------------|
| `login`        | `{ token: String }`                      | Sends the JWT token for authentication.|
| `search`       | None                                     | Requests to search for a chat partner. |
| `stopSearch`   | None                                     | Stops searching for a chat partner.    |
| `sendMessage`  | `{ content: String }`                    | Sends a new message to the partner.    |
| `endChat`      | None                                     | Ends the current chat session.         |

---

### **Server-to-Client Events**
| Event                 | Payload                                   | Description                             |
|-----------------------|-------------------------------------------|-----------------------------------------|
| `unauthorized`        | None                                     | Sent when JWT authentication fails.    |
| `loginSuccess`        | `{ userId: String, displayName: String }` | Sent when login succeeds.              |
| `searching`           | None                                     | Notifies that the user is in the queue.|
| `matched`             | `{ roomId: String }`                     | Sent when a partner is found.          |
| `receiveMessage`      | `{ sender: String, content: String, timestamp: Date }` | Received when partner sends a message. |
| `partnerDisconnected` | None                                     | Notifies that the partner disconnected.|

---

## 5. Environment Variables

The server depends on the following environment variables:

| Variable        | Default Value                 | Description                                             |
|-----------------|-------------------------------|---------------------------------------------------------|
| `CLIENT_URL`    | `http://localhost:5173`       | URL where the frontend is hosted (CORS policy).         |
| `JWT_SECRET`    | **Required**                 | Secret key to sign/verify JWT tokens.                   |
| `EMAIL_USER`    | **Required**                 | Email address for sending magic links.                  |
| `EMAIL_PASS`    | **Required**                 | Password for the email account used for magic link emails. |
| `MONGODB_URI`   | `mongodb://localhost:27017/uschika` | MongoDB connection URI.                                  |
| `PORT`          | `5000`                       | Port for running the backend server.                    |

---

## 6. Key Features

### 6.1 Authentication: Magic Link
- **Magic Link Generation**:
  - Short-lived JWT tokens (15 minutes expiry).
  - Sent via **Gmail SMTP** integration to verified users.
  - Users must authenticate with `@usc.edu.ph` email domain.
- **Token Verification**:
  - Decodes token payload (`email`, `displayName`) and retrieves user information.

---

### 6.2 Realtime Matchmaking & Messaging
- **Matchmaking**:
  - Users enter a waiting queue for pairing (FIFO).
  - Once matched, a private room (`roomId`) is created for the pair.
- **Messaging**:
  - Messages are persisted in MongoDB and automatically expire after 24 hours.
  - Realtime notifications using WebSocket `receiveMessage` events.

---

### 6.3 Chat Expiration and Auto-Cleanup
- Messages live for **24 hours** in MongoDB and are automatically removed using `expireAfterSeconds`.

---

## Example Workflow for Frontend

### 1. Authenticate via Magic Link (REST API)
1. **Request Magic Link**:
    ```javascript
    await fetch('http://localhost:5000/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@usc.edu.ph' })
    });
    ```

2. **Verify Token**:
    ```javascript
    const { token } = extractFromMagicLink(); // Token from magic link
    const res = await fetch('http://localhost:5000/auth/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const { email, displayName } = await res.json();
    ```

### 2. Start Realtime Messaging
1. **Connect via WebSockets**:
    ```javascript
    const socket = io('http://localhost:5000');
    socket.emit('login', { token: 'user-jwt-token' });
    ```

2. **Search for a Partner**:
    ```javascript
    socket.emit('search');
    socket.on('searching', () => console.log('Searching for partner...'));
    socket.on('matched', ({ roomId }) => console.log('Matched!', roomId));
    ```

3. **Send Messages**:
    ```javascript
    socket.emit('sendMessage', { content: 'Hello, partner!' });
    socket.on('receiveMessage', (msg) => console.log('New message:', msg));
    ```

---