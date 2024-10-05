import http from "node:http";
import fs from "node:fs/promises";
import { Server } from "socket.io";
const PORT = 8080;
const app = http
  .createServer(async (req, res) => {
    const path = "." + req?.url;
    console.log({ path });
    try {
      const file = await fs.readFile(path);
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "text/javascript");
      } else if (path.endsWith(".html")) {
        res.setHeader("Content-Type", "text/html");
      } else if (path.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      } else if (path.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      return res.end(file);
    } catch (err) {
      res.statusCode = 404;
      res.end();
    }
  })
  .listen(PORT);
console.log("Listening on http://localhost:8080");
type OutboundMessage =
  | RTCSessionDescriptionInit
  | RTCIceCandidateInit
  | CandidateMessage
  | "peerIsReady"
  | "bye";
type InboundMessage = {
  room: string;
  userId: string;
  message: OutboundMessage;
};

type CandidateMessage = {
  type: "candidate";
  label: number;
  id: string;
  candidate: string;
};
const io = new Server(app);
io.sockets.on("connection", function (socket) {
  socket.on("message", function (message: InboundMessage) {
    console.log("Client said: ", message);
    for (const room of socket.rooms) {
      if (room == message.room) {
        socket.to(room).emit("message", message);
        return;
      }
    }
    console.error(`Couldn't find room ${message.room}`);
  });

  socket.on("joinRoom", (room: string) => {
    console.log("Client ID " + socket.id + " joined room " + room);
    io.sockets.in(room).emit("join", room);
    socket.join(room);
    socket.emit("joined", room, socket.id);
    io.sockets.in(room).emit("ready");
  });

  socket.on("bye", function () {
    console.log("received bye");
  });
});
