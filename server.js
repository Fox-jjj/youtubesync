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

  // Listen for joinRoom events from both host and joiners
  socket.on('joinRoom', (data) => {
    const { roomId, isHost } = data;
    if (isHost) {
      // If the client is the host, register the room.
      rooms[roomId] = socket.id;
      socket.join(roomId);
      console.log(`Host ${socket.id} created and joined room ${roomId}`);
    } else {
      // If a joiner, check if the room exists (i.e. if a host is registered)
      if (!rooms[roomId]) {
        // Notify the joiner that the room is invalid
        socket.emit('invalidRoom', { message: 'Invalid room. No host found.' });
        console.log(`Joiner ${socket.id} attempted to join invalid room ${roomId}`);
      } else {
        socket.join(roomId);
        console.log(`Joiner ${socket.id} joined room ${roomId}`);
      }
    }
  });

  // When a sync event is received from the host, broadcast it to others in the room
  socket.on('sync', (data) => {
    const { roomId, time, state } = data;
    socket.to(roomId).emit('sync', data);
    console.log(`Broadcast sync in room ${roomId}: time=${time}, state=${state}`);
  });

  // When a client disconnects, remove its room if it was the host
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
