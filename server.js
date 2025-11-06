const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let pins = [
  {
    id: 1,
    location: "Pilsen, Chicago",
    artist: "Sofia Morales",
    song: "Tierra",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    lat: 41.856,
    lng: -87.675,
  },
  {
    id: 2,
    location: "Logan Square, Chicago",
    artist: "HoliznaCC",
    song: "City Lights",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    lat: 41.928,
    lng: -87.707,
  },
];

// HTTP fallback route
app.get("/api/pins", (req, res) => res.json(pins));

io.on("connection", (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // Send pins only to the connected client
  socket.emit("message", {
    type: "init",
    payload: pins,
  });

  // Handle when a client adds a new pin (broadcast to all)
  socket.on("message", (msg) => {
    switch (msg.type) {
      case "addPin":
        pins.push(msg.payload);
        // Broadcast the new pin to everyone *except the sender*
        socket.broadcast.emit("message", {
          type: "newPin",
          payload: msg.payload,
        });
        break;
      default:
        console.log(`Ignored message type: ${msg.type}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
