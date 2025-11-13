// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "docs")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// const pins = [

//   {
//     id: 1,
//     artist: "Kanye West",
//     song: "Flashing Lights",
//     location: "Logan Square, Chicago",
//     lat: 41.928,
//     lng: -87.707,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr%20-%20Kanye%20West%20-%20Flashing%20Lights%20(320%20KBps).mp3"
//   },
//   {
//     id: 2,
//     artist: "Drake",
//     song: "9",
//     location: "Hyde Park, Chicago",
//     lat: 41.874,
//     lng: -87.657,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr - Drake - 9 (320 KBps).mp3"
//   },
//   {
//     id: 3,
//     artist: "Travis Scott",
//     song: "Maria Im Drunk",
//     location: "Hyde Park, Chicago",
//     lat: 41.908,
//     lng: -87.707,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr - Travis Scott - Maria I m Drunk (320 KBps).mp3"
//   },
//   {
//     id: 4,
//     artist: "Lil Uzi Vert",
//     song: "Erase Your Social",
//     location: "Logan Square, Chicago",
//     lat: 41.928,
//     lng: -87.757,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr - Lil Uzi Vert - Erase Your Social Produced By Don Cannon Lyle LeDuff (320 KBps).mp3"
//   },
//   {
//     id: 5,
//     artist: "Skepta",
//     song: "Interlude",
//     location: "Logan Square, Chicago",
//     lat: 41.908,
//     lng: -87.757,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr - Drake - Skepta Interlude (320 KBps).mp3"
//   },
//   {
//     id: 6,
//     artist: "Kanye West",
//     song: "Bittersweet Poetry",
//     location: "Logan Square, Chicago",
//     lat: 41.888,
//     lng: -87.757,
//     audio_url: "https://rayyanathar.github.io/music/www.cabinet-avocat-cadet.fr - KanYe WesT - Bittersweet Poetry (320 KBps).mp3"
//   }

// ];


// Using async/await

const raw = fs.readFileSync("database/pins.json", "utf-8");
const pins = JSON.parse(raw);

app.get("/api/pins", (req, res) => res.json(pins));

const USERS_FILE = path.join(__dirname, "database/users.json");

// helper to safely read users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

// helper to save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Register user
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (users[username]) {
    return res.json({ success: false, message: "Username already exists." });
  }

  users[username] = {
    password,
    playlists: {},
    queue: [],
    queueIndex: -1
  };

  saveUsers(users);
  res.json({ success: true, message: "Registration successful!" });
});

// Login user
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (!users[username]) {
    return res.json({ success: false, message: "User not found." });
  }
  if (users[username].password !== password) {
    return res.json({ success: false, message: "Incorrect password." });
  }

  res.json({ success: true, message: "Login successful!" });
});

// Update user data (like queue or playlists)
app.post("/api/updateUser", (req, res) => {
  const { username, updates } = req.body;
  if (!username || !updates) return res.status(400).json({ success: false, message: "Missing data" });

  const users = loadUsers();
  if (!users[username]) return res.status(404).json({ success: false, message: "User not found" });

  // Merge queue
  if (updates.queue) {
    users[username].queue = users[username].queue || [];
    updates.queue.forEach(song => {
      if (!users[username].queue.find(s => s.url === song.url)) {
        users[username].queue.push(song);
      }
    });
  }

  // Merge playlists
  if (updates.playlists) {
    users[username].playlists = users[username].playlists || {};
    for (const [name, songs] of Object.entries(updates.playlists)) {
      if (!users[username].playlists[name]) users[username].playlists[name] = [];
      songs.forEach(s => {
        if (!users[username].playlists[name].find(x => x.url === s.url)) {
          users[username].playlists[name].push(s);
        }
      });
    }
  }

  // Merge queueIndex
  if (updates.queueIndex !== undefined) {
    users[username].queueIndex = updates.queueIndex;
  }

  saveUsers(users);
  res.json({ success: true, message: "User data saved" });
});


app.get("/api/getUser/:username", (req, res) => {
  const username = req.params.username;
  const users = loadUsers();

  if (!users[username]) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ success: true, data: users[username] });
});



io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  socket.emit("pins", pins); 

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
