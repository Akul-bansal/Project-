// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server);

/*
 Simple in-memory pairing server (Omegle-style)
 - waiting: one socket id waiting for partner
 - rooms: in-memory object; each room: { users:{ socketId:{id,name} }, startTime, leaderboard }
*/
let waiting = null;
const rooms = {};

function makeRoomId() {
  return Math.random().toString(36).slice(2, 9);
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.data.name = null;
  socket.data.roomId = null;

  // FIND: client requests a match
  socket.on("find", (payload) => {
    const name = String(payload?.name || "Anon").slice(0, 30);
    socket.data.name = name;

    if (socket.data.roomId) {
      socket.emit("status", { ok: false, msg: "Already in a room." });
      return;
    }

    if (waiting && waiting !== socket.id) {
      const partnerId = waiting;
      waiting = null;

      const roomId = makeRoomId();
      rooms[roomId] = { id: roomId, users: {}, startTime: null, leaderboard: {} };

      rooms[roomId].users[socket.id] = { id: socket.id, name };
      const partnerSocket = io.sockets.sockets.get(partnerId);
      rooms[roomId].users[partnerId] = { id: partnerId, name: partnerSocket?.data?.name || "Anon" };

      socket.data.roomId = roomId;
      if (partnerSocket) partnerSocket.data.roomId = roomId;

      socket.join(roomId);
      if (partnerSocket) partnerSocket.join(roomId);

      socket.emit("matched", { roomId, peer: rooms[roomId].users[partnerId] });
      if (partnerSocket) partnerSocket.emit("matched", { roomId, peer: rooms[roomId].users[socket.id] });

      console.log(`Room ${roomId} created: ${socket.id} <> ${partnerId}`);
    } else {
      waiting = socket.id;
      socket.emit("status", { ok: true, msg: "Waiting for a partner..." });
    }
  });

  // CANCEL waiting
  socket.on("cancel", () => {
    if (waiting === socket.id) waiting = null;
    socket.emit("status", { ok: true, msg: "Cancelled." });
  });

  // MESSAGE
  socket.on("message", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) {
      socket.emit("status", { ok: false, msg: "Not in a room." });
      return;
    }

    let text = String(data?.text || "").trim().replace(/\s+/g, " ");
    if (!text) return;
    if (/(https?:\/\/|www\.)/i.test(text)) {
      socket.emit("status", { ok: false, msg: "Links are not allowed." });
      return;
    }
    if (text.length > 600) {
      socket.emit("status", { ok: false, msg: "Message too long." });
      return;
    }

    const payload = { uid: socket.id, name: socket.data.name || "Anon", text, ts: Date.now() };
    io.to(roomId).emit("message", payload);
  });

  // START SESSION
  socket.on("startSession", () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    if (!rooms[roomId].startTime) {
      rooms[roomId].startTime = Date.now();
      io.to(roomId).emit("sessionStarted", { startTime: rooms[roomId].startTime });
      console.log("session started in", roomId);
    } else {
      socket.emit("status", { ok: false, msg: "Session already started." });
    }
  });

  // END SESSION submission
  socket.on("endSession", (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const secs = Number(payload?.secs || 0);
    rooms[roomId].leaderboard[socket.id] = { name: socket.data.name || "Anon", secs };
    io.to(roomId).emit("leaderboard", rooms[roomId].leaderboard);
  });

  // LEAVE
  socket.on("leave", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    leaveRoom(socket, roomId);
  });

  socket.on("disconnect", () => {
    console.log("disconnect:", socket.id);
    if (waiting === socket.id) waiting = null;
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) leaveRoom(socket, roomId);
  });

  function leaveRoom(s, roomId) {
    const room = rooms[roomId];
    if (!room) return;
    delete room.users[s.id];
    delete room.leaderboard[s.id];
    s.leave(roomId);
    s.data.roomId = null;
    io.to(roomId).emit("partnerLeft", { id: s.id, name: s.data.name || "Anon" });
    if (Object.keys(room.users).length === 0) {
      delete rooms[roomId];
      console.log("deleted room", roomId);
    } else {
      io.to(roomId).emit("leaderboard", room.leaderboard);
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
