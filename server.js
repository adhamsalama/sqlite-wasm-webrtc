"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const promises_1 = __importDefault(require("node:fs/promises"));
const socket_io_1 = require("socket.io");
const PORT = 8080;
const app = node_http_1.default
    .createServer(async (req, res) => {
    const path = "." + req?.url;
    console.log({ path });
    try {
        const file = await promises_1.default.readFile(path);
        if (path.endsWith(".js")) {
            res.setHeader("Content-Type", "text/javascript");
        }
        else if (path.endsWith(".html")) {
            res.setHeader("Content-Type", "text/html");
        }
        else if (path.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css");
        }
        else if (path.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
        }
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        return res.end(file);
    }
    catch (err) {
        res.statusCode = 404;
        res.end();
    }
})
    .listen(PORT);
console.log("Listening on http://localhost:8080");
const io = new socket_io_1.Server(app);
io.sockets.on("connection", function (socket) {
    socket.on("message", function (message) {
        console.log("Client said: ", message);
        for (const room of socket.rooms) {
            if (room == message.room) {
                socket.to(room).emit("message", message);
                return;
            }
        }
        console.error(`Couldn't find room ${message.room}`);
    });
    socket.on("joinRoom", (room) => {
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
