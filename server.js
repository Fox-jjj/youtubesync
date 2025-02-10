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

// Global object to track active rooms (roomId: hostSocketId)
const rooms = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle joinRoom events from both host and joiners
  socket.on('joinRoom', (data) => {
    const { roomId, isHost } = data;
    if (isHost) {
      // Host creates the room.
      rooms[roomId] = socket.id;
      socket.join(roomId);
      console.log(`Host ${socket.id} created and joined room ${roomId}`);
    } else {
      // For joiners, check if a host exists
      if (!rooms[roomId]) {
        socket.emit('invalidRoom', { message: 'Invalid room. No host found.' });
        console.log(`Joiner ${socket.id} attempted to join invalid room ${roomId}`);
      } else {
        socket.join(roomId);
        console.log(`Joiner ${socket.id} joined room ${roomId}`);
      }
    }
  });

  // When the host (or client) sends sync data, broadcast it to others in the room.
  socket.on('sync', (data) => {
    const { roomId, time, state, forceSync } = data;
    // Broadcast to all others in the room.
    socket.to(roomId).emit('sync', data);
    console.log(`Broadcast sync in room ${roomId}: time=${time}, state=${state}, forceSync=${forceSync}`);
  });

  // When the host sends a new live video event, broadcast it.
  socket.on('newLiveVideo', (data) => {
    const { roomId, videoId } = data;
    socket.to(roomId).emit('newLiveVideo', data);
    console.log(`Broadcast new live video in room ${roomId}: videoId=${videoId}`);
  });

  // On disconnect, if a host disconnects, remove the room.
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const room in rooms) {
      if (rooms[room] === socket.id) {
        delete rooms[room];
        console.log(`Room ${room} removed because host ${socket.id} disconnected`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
