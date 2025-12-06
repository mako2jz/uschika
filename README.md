# USChika 🎭

An anonymous real-time 1-on-1 chat platform for USC students to connect and socialize.

## Features

- 🔍 **Smart Matchmaking**: Automatic pairing with available users
- 💬 **Real-time Messaging**: Instant communication via Socket.io
- 🎭 **Anonymous**: No login required, completely anonymous chats
- 🔄 **Easy Reconnection**: Quick search for new chat partners
- 📱 **Responsive Design**: Beautiful UI that works on all devices

## Tech Stack

### Frontend
- **React** with Vite
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Socket.io-client** for real-time communication

### Backend
- **Node.js** with Express
- **Socket.io** for WebSocket connections
- **MongoDB** with Mongoose for data persistence
- **CORS** enabled for cross-origin requests

## Project Structure

```
uschika/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── SearchScreen.jsx
│   │   │   └── ChatWindow.jsx
│   │   ├── services/      # Socket.io client service
│   │   ├── store/         # Zustand store
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   └── package.json
│
└── server/                # Node.js backend
    ├── index.js           # Server entry point
    └── package.json
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mako2jz/uschika.git
   cd uschika
   ```

2. **Set up the server**
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your MongoDB URI
   ```

3. **Set up the client**
   ```bash
   cd ../client
   npm install
   cp .env.example .env
   # Edit .env if you need to change the socket URL
   ```

### Running the Application

1. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

2. **Start the server** (in the `server` directory)
   ```bash
   npm run dev
   ```
   The server will start on `http://localhost:5000`

3. **Start the client** (in the `client` directory, in a new terminal)
   ```bash
   npm run dev
   ```
   The client will start on `http://localhost:5173`

4. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Open another incognito/private window to test with two users

## Environment Variables

### Server (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/uschika
CLIENT_URL=http://localhost:5173
```

### Client (.env)
```env
VITE_SOCKET_URL=http://localhost:5000
```

## How It Works

1. **Search for Partner**: User clicks "Find a Chat Partner" button
2. **Matchmaking Queue**: Server adds user to waiting queue
3. **Pairing**: When another user searches, server pairs them together
4. **Real-time Chat**: Users can exchange messages in real-time
5. **Disconnect Handling**: If one user disconnects, the other is notified
6. **New Chat**: Users can end chat and search for a new partner

## API Endpoints

### HTTP
- `GET /health` - Health check endpoint

### Socket.io Events

#### Client → Server
- `search` - Start searching for a chat partner
- `stopSearch` - Stop searching for a partner
- `sendMessage` - Send a message to partner
- `endChat` - End the current chat

#### Server → Client
- `matched` - Successfully matched with a partner
- `searching` - Currently searching for a partner
- `searchStopped` - Search has been stopped
- `receiveMessage` - Received a message from partner
- `partnerDisconnected` - Partner has disconnected

## Development

### Server Development
```bash
cd server
npm run dev  # Uses nodemon for hot reload
```

### Client Development
```bash
cd client
npm run dev  # Vite HMR enabled
```

### Building for Production

**Client:**
```bash
cd client
npm run build
```

**Server:**
```bash
cd server
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with ❤️ for the USC community
- Inspired by the need for anonymous connections
- Powered by modern web technologies
