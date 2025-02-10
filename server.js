// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io event handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // When a client joins a room
  socket.on('joinRoom', (data) => {
    const { roomId, isHost } = data;
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId} as ${isHost ? 'host' : 'joiner'}`);
  });

  // When a client sends a sync update, broadcast it to others in the same room
  socket.on('sync', (data) => {
    const { roomId, time, state } = data;
    socket.to(roomId).emit('sync', data);
    console.log(`Broadcast sync in room ${roomId}: time=${time}, state=${state}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Listen on the port provided by the environment or 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
