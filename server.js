const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function roomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    let id = roomId();
    while (rooms.has(id)) id = roomId();
    rooms.set(id, { host: socket.id, controller: null, approved: false, agent: null });
    socket.join(id);
    socket.data.roomId = id;
    socket.data.role = 'host';
    socket.emit('room-created', { roomId: id });
  });

  socket.on('register-agent', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('agent-error', { message: 'Room not found' });
    room.agent = socket.id;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'agent';
    io.to(room.host).emit('agent-connected');
    socket.emit('agent-registered', { roomId });
  });

  socket.on('join-room', ({ roomId, deviceName }) => {
    roomId = String(roomId || '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return socket.emit('join-error', { message: 'Invalid Room ID' });
    room.controller = socket.id;
    room.approved = false;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = 'controller';
    io.to(room.host).emit('access-request', { deviceName: deviceName || 'Remote Controller' });
    socket.emit('waiting-approval');
  });

  socket.on('approve-access', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.host !== socket.id || !room.controller) return;
    room.approved = true;
    io.to(room.controller).emit('access-approved');
    io.to(room.host).emit('controller-approved');
  });

  socket.on('reject-access', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.host !== socket.id || !room.controller) return;
    io.to(room.controller).emit('access-rejected');
    room.controller = null;
    room.approved = false;
  });

  const relayEvents = ['mouse-move', 'left-click', 'right-click', 'double-click', 'scroll', 'keyboard-input'];
  relayEvents.forEach((event) => {
    socket.on(event, (payload = {}) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.approved || room.controller !== socket.id) return;
      if (room.agent) io.to(room.agent).emit(event, payload);
      io.to(room.host).emit('command-log', { event, payload });
    });
  });

  socket.on('disconnect-control', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    io.to(room.host).emit('controller-disconnected');
    if (room.controller) io.to(room.controller).emit('disconnected-by-user');
    room.controller = null;
    room.approved = false;
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (socket.data.role === 'host') {
      io.to(socket.data.roomId).emit('host-disconnected');
      rooms.delete(socket.data.roomId);
    } else if (socket.data.role === 'controller') {
      io.to(room.host).emit('controller-disconnected');
      room.controller = null;
      room.approved = false;
    } else if (socket.data.role === 'agent') {
      room.agent = null;
      io.to(room.host).emit('agent-disconnected');
    }
  });
});
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});