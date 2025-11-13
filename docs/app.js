// app.js 

const socket = io();
const pubUsername = sessionStorage.getItem("user");
const pubPassword = sessionStorage.getItem("password");

let userData = null;
let songQueue = [];
let playlists = {};
let currentSong = null;
let songIndex = 0;

// ------------------
// FETCH USER DATA
// ------------------
fetch(`/api/getUser/${pubUsername}`)
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      userData = data.data;
      songQueue = userData.queue || [];
      songIndex = userData.queueIndex || 0;
      playlists = userData.playlists || {};
      console.log("User loaded:", userData);
    } else {
      console.warn("User load failed:", data.message);
    }
    populateQueueUI();
    populatePlaylistsUI();          // <-- will also bind the "Create New" button
  });

// ------------------
// DOM ELEMENTS
// ------------------
const audioPlayer = new Audio();
const songInfo = document.getElementById("songInfo");
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const showQueueBtn = document.getElementById("showQueueBtn");
const showPlaylistBtnRight = document.getElementById("showPlaylistBtnRight");
const playlistBtn = document.getElementById("playlistBtn");
const queueDiv = document.getElementById("queue");
const seekSlider = document.getElementById("seekSlider");
const timeLabel = document.getElementById("timeLabel");
const queueSidebar = document.getElementById("sidebar-left");
const playlistSidebar = document.getElementById("sidebar-right");
const playlistDropdown = document.querySelector("#top-bar .dropdown");
const playlistOpt = document.getElementById("playlistOpt");
const notification = document.getElementById("notification");

// ------------------
// HELPERS
// ------------------
function escapeHtml(unsafe) {
  return String(unsafe || "").replace(/[&<>"'`]/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;"
  }[m]));
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateTimeLabel() {
  timeLabel.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
}

function showTemporaryNotification(text, ms = 1400) {
  notification.textContent = text;
  notification.classList.add("show");
  clearTimeout(notification._t);
  notification._t = setTimeout(() => notification.classList.remove("show"), ms);
}

async function savePlaylists() {
  try {
    const res = await fetch(`/api/getUser/${pubUsername}`);
    const data = await res.json();
    if (!data.success) return;

    const serverPlaylists = data.data.playlists || {};
    const mergedPlaylists = { ...serverPlaylists };

    for (const [name, songs] of Object.entries(playlists)) {
      if (!mergedPlaylists[name]) mergedPlaylists[name] = [];
      songs.forEach(s => {
        if (!mergedPlaylists[name].find(x => x.url === s.url)) {
          mergedPlaylists[name].push(s);
        }
      });
    }

    await fetch("/api/updateUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: pubUsername, updates: { playlists: mergedPlaylists } })
    });

    playlists = mergedPlaylists; // update local playlists
  } catch (err) {
    console.error(err);
  }
}


async function saveQueue() {
  try {
    const res = await fetch(`/api/getUser/${pubUsername}`);
    const data = await res.json();
    if (!data.success) return;

    const serverQueue = data.data.queue || [];
    const mergedQueue = [...serverQueue];

    songQueue.forEach(s => {
      if (!mergedQueue.find(q => q.url === s.url)) mergedQueue.push(s);
    });

    await fetch("/api/updateUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: pubUsername, updates: { queue: mergedQueue } })
    });

    songQueue = mergedQueue; // update local queue
  } catch (err) {
    console.error(err);
  }
}


function updateQueueIndex() {
  fetch("/api/updateUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: pubUsername, updates: { queueIndex: songIndex } })
  }).catch(console.error);
}

// ------------------
// UI POPULATION
// ------------------
function populateQueueUI() {
  queueDiv.innerHTML = "";
  songQueue.forEach((song, i) => {
    const el = document.createElement("div");
    el.className = "queue-item";
    el.textContent = `${song.artist} — ${song.title}`;
    if (i === songIndex) el.style.fontWeight = "600";
    queueDiv.appendChild(el);
  });
}

/* -------------------------------------------------------------
   IMPORTANT: this function now **also binds** the
   "Create New" button every time it is (re)created.
   ------------------------------------------------------------- */
function bindCreatePlaylistBtn() {
  const btn = document.getElementById("createPlaylistBtn");
  if (!btn) return;
  btn.onclick = () => {
    if (!currentSong) return alert("Play a song first!");
    const name = prompt("Playlist name:");
    if (!name) return;
    playlists[name] = [currentSong];
    populatePlaylistsUI();          // rebuild UI + re‑bind button
    savePlaylists();
    showTemporaryNotification(`"${name}" created`);
  };
}

function populatePlaylistsUI() {
  const container = document.getElementById("playlist");
  const optContainer = document.getElementById("playlistOpt");
  container.innerHTML = "";
  optContainer.innerHTML = `<button id="createPlaylistBtn" class="menu-item">Create New</button>`;

  // ---- re‑bind the freshly created button ----
  bindCreatePlaylistBtn();

  for (const [name, songs] of Object.entries(playlists)) {
    // right‑sidebar dropdown
    const dropdown = document.createElement("div");
    dropdown.className = "dropdown";

    const btn = document.createElement("button");
    btn.className = "dropdown-btn";
    btn.textContent = name;

    const content = document.createElement("div");
    content.className = "dropdown-content";

    songs.forEach(s => {
      const sbtn = document.createElement("button");
      sbtn.className = "song-btn";
      sbtn.textContent = s.title;
      sbtn.onclick = () => playSong(s.url, s.title, s.artist);
      content.appendChild(sbtn);
    });

    dropdown.appendChild(btn);
    dropdown.appendChild(content);
    container.appendChild(dropdown);

    // top‑bar quick‑add button
    const optBtn = document.createElement("button");
    optBtn.className = "menu-item";
    optBtn.textContent = name;
    optBtn.onclick = () => {
      if (!currentSong) return;
      const newBtn = document.createElement("button");
      newBtn.className = "song-btn";
      newBtn.textContent = currentSong.title;
      newBtn.onclick = () => playSong(currentSong.url, currentSong.title, currentSong.artist);
      content.appendChild(newBtn);
      playlists[name].push({ ...currentSong });
      savePlaylists();
      showTemporaryNotification(`Added to ${name}`);
    };
    optContainer.appendChild(optBtn);

    btn.onclick = e => {
      e.stopPropagation();
      container.querySelectorAll(".dropdown").forEach(d => d.classList.remove("active"));
      dropdown.classList.toggle("active");
    };
  }
}

// ------------------
// AUDIO CONTROLS
// ------------------
window.playSong = (url, title, artist) => {
  currentSong = { url, title, artist };
  audioPlayer.src = url;
  audioPlayer.crossOrigin = "anonymous";
  audioPlayer.play().catch(() => {});
  songInfo.textContent = `${artist} — ${title}`;
  playBtn.classList.replace("play", "pause");
};

window.queueSong = (url, title, artist) => {
  songQueue.push({ url, title, artist });
  const el = document.createElement("div");
  el.className = "queue-item";
  el.textContent = `${artist} — ${title}`;
  queueDiv.appendChild(el);
  showTemporaryNotification(`"${title}" queued`);
  saveQueue();
};

playBtn.onclick = () => {
  if (audioPlayer.paused) {
    audioPlayer.play();
    playBtn.classList.replace("play", "pause");
  } else {
    audioPlayer.pause();
    playBtn.classList.replace("pause", "play");
  }
};

prevBtn.onclick = () => {
  if (songIndex > 0) {
    songIndex--;
    const s = songQueue[songIndex];
    if (s) playSong(s.url, s.title, s.artist);
    updateQueueIndex();
  }
};

nextBtn.onclick = () => {
  if (songIndex < songQueue.length - 1) {
    songIndex++;
    const s = songQueue[songIndex];
    if (s) {
      playSong(s.url, s.title, s.artist);
      queueDiv.removeChild(queueDiv.firstChild);
    }
    updateQueueIndex();
  }
};

audioPlayer.addEventListener("loadedmetadata", () => {
  seekSlider.max = audioPlayer.duration || 0;
  updateTimeLabel();
});

audioPlayer.addEventListener("timeupdate", () => {
  seekSlider.value = audioPlayer.currentTime;
  updateTimeLabel();
});

seekSlider.addEventListener("input", () => {
  audioPlayer.currentTime = seekSlider.value;
});

audioPlayer.onended = () => {
  if (songIndex < songQueue.length - 1) {
    nextBtn.onclick();
  } else {
    currentSong = null;
    songInfo.textContent = "No song playing";
    playBtn.classList.replace("pause", "play");
  }
};

// ------------------
// SIDEBARS
// ------------------
showQueueBtn.onclick = () => {
  queueSidebar.classList.toggle("open");
  showQueueBtn.textContent = queueSidebar.classList.contains("open") ? pubUsername : "Queue";
};

[showPlaylistBtnRight].forEach(btn => {
  btn.onclick = () => {
    playlistSidebar.classList.toggle("open");
    const open = playlistSidebar.classList.contains("open");
    [showPlaylistBtnRight].forEach(b => b.textContent = open ? pubPassword : "Playlists");
  };
});

playlistBtn.onclick = e => {
  e.stopPropagation();
  playlistDropdown.classList.toggle("active");
};

window.onclick = () => {
  document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("active"));
};

// ------------------
// MAP & PINS (unchanged, still works)
// ------------------
let map, userMarker;

document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map").setView([41.8781, -87.6298], 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude } = pos.coords;
      if (!userMarker) {
        userMarker = L.circleMarker([latitude, longitude], {
          radius: 8,
          fillColor: "#64c8ff",
          color: "#fff",
          weight: 2,
          fillOpacity: 1
        }).addTo(map);
      } else {
        userMarker.setLatLng([latitude, longitude]);
      }
      map.setView([latitude, longitude], 15);
    }, console.error, { enableHighAccuracy: true });
  }

  const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  socket.on("connect", () => console.log("Connected:", socket.id));

  socket.on("pins", pins => {
    pins.forEach(pin => {
      const marker = L.marker([pin.lat, pin.lng], { icon: redIcon }).addTo(map);
      marker.bindPopup(`
        <div class="popup-content">
          <b>${escapeHtml(pin.artist)}</b><br>
          <i>${escapeHtml(pin.song)}</i><br><br>
          <button class="popup-play-btn">Play</button>
          <button class="popup-queue-btn">Queue</button>
        </div>
      `);

      marker.on("popupopen", e => {
        const popup = e.popup.getElement();
        popup.querySelector(".popup-play-btn").onclick = () => {
          playSong(pin.audio_url, pin.song, pin.artist);
          e.popup.close();
        };
        popup.querySelector(".popup-queue-btn").onclick = () => {
          queueSong(pin.audio_url, pin.song, pin.artist);
          showTemporaryNotification(`"${pin.song}" queued`);
          e.popup.close();
        };
      });
    });
  });
});