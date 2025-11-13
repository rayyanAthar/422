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
const queueModalBody = document.getElementById("queueModalBody");
const playlistModalBody = document.getElementById("playlistModalBody");
const seekSlider = document.getElementById("seekSlider");
const timeLabel = document.getElementById("timeLabel");
const playlistDropdown = document.querySelector("#top-bar .dropdown");
const playlistOpt = document.getElementById("playlistOpt");
const notification = document.getElementById("notification");

// Modal elements
const queueModal = document.getElementById("queueModal");
const playlistModal = document.getElementById("playlistModal");
const modalOverlay = document.getElementById("modalOverlay");
const closeButtons = document.querySelectorAll('.modal-close');

// ------------------
// MODAL CONTROLS
// ------------------
function openModal(modal) {
  closeAllModals();
  modal.classList.add('active');
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('active');
  });
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Modal event listeners
showQueueBtn.addEventListener('click', () => openModal(queueModal));
showPlaylistBtnRight.addEventListener('click', () => openModal(playlistModal));
modalOverlay.addEventListener('click', closeAllModals);

closeButtons.forEach(button => {
  button.addEventListener('click', closeAllModals);
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
  }
});

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
  queueModalBody.innerHTML = "";
  
  if (songQueue.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "modal-empty";
    emptyState.textContent = "Queue is empty. Add songs from the map!";
    queueModalBody.appendChild(emptyState);
    return;
  }
  
  songQueue.forEach((song, i) => {
    const el = document.createElement("div");
    el.className = i === songIndex ? "queue-item current" : "queue-item";
    el.textContent = `${song.artist} — ${song.title}`;
    
    // Make queue items clickable to play
    el.addEventListener('click', () => {
      songIndex = i;
      playSong(song.url, song.title, song.artist);
      populateQueueUI(); // Refresh to update current song highlight
      updateQueueIndex();
    });
    
    queueModalBody.appendChild(el);
  });
}

function bindCreatePlaylistBtn() {
  const btn = document.getElementById("createPlaylistBtn");
  if (!btn) return;
  btn.onclick = () => {
    if (!currentSong) {
      showTemporaryNotification("Play a song first!");
      return;
    }
    const name = prompt("Playlist name:");
    if (!name) return;
    playlists[name] = [currentSong];
    populatePlaylistsUI();          // rebuild UI + re‑bind button
    savePlaylists();
    showTemporaryNotification(`"${name}" created`);
  };
}

function populatePlaylistsUI() {
  const container = playlistModalBody;
  const optContainer = document.getElementById("playlistOpt");
  container.innerHTML = "";
  optContainer.innerHTML = `<button id="createPlaylistBtn" class="menu-item">Create New Playlist</button>`;

  // ---- re‑bind the freshly created button ----
  bindCreatePlaylistBtn();

  // Show empty state if no playlists
  if (Object.keys(playlists).length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "modal-empty";
    emptyState.textContent = "No playlists yet. Create your first one!";
    container.appendChild(emptyState);
  }

  for (const [name, songs] of Object.entries(playlists)) {
    // playlist modal dropdown
    const dropdown = document.createElement("div");
    dropdown.className = "dropdown";

    const btn = document.createElement("button");
    btn.className = "dropdown-btn";
    
    const btnContent = document.createElement("span");
    btnContent.textContent = name;
    
    const countBadge = document.createElement("span");
    // countBadge.className = "playlist-count";
    countBadge.textContent = "";
    
    btn.appendChild(btnContent);
    btn.appendChild(countBadge);

    const content = document.createElement("div");
    content.className = "dropdown-content";

    // Show empty state for playlist if no songs
    if (songs.length === 0) {
      const emptySong = document.createElement("button");
      emptySong.className = "song-btn";
      emptySong.textContent = "No songs in this playlist";
      emptySong.style.color = "rgba(255,255,255,.4)";
      emptySong.style.cursor = "default";
      emptySong.onclick = (e) => e.preventDefault();
      content.appendChild(emptySong);
    } else {
      songs.forEach(s => {
        const sbtn = document.createElement("button");
        sbtn.className = "song-btn";
        sbtn.textContent = `${s.artist} — ${s.title}`;
        sbtn.onclick = () => {
          playSong(s.url, s.title, s.artist);
          closeAllModals();
        };
        content.appendChild(sbtn);
      });
    }

    dropdown.appendChild(btn);
    dropdown.appendChild(content);
    container.appendChild(dropdown);

    // top‑bar quick‑add button
    const optBtn = document.createElement("button");
    optBtn.className = "menu-item";
    
    const optText = document.createElement("span");
    optText.textContent = name;
    
    const optCount = document.createElement("span");
    optCount.textContent = songs.length;
    optCount.style.background = "rgba(255,255,255,.2)";
    optCount.style.padding = "2px 6px";
    optCount.style.borderRadius = "8px";
    optCount.style.fontSize = "0.7em";
    
    optBtn.appendChild(optText);
    optBtn.appendChild(optCount);
    
    optBtn.onclick = () => {
      if (!currentSong) {
        showTemporaryNotification("No song playing!");
        return;
      }
      // Check if song already exists in playlist
      if (playlists[name].find(s => s.url === currentSong.url)) {
        showTemporaryNotification("Song already in playlist!");
        return;
      }
      
      // Add to playlist
      playlists[name].push({ ...currentSong });
      
      // Update the UI
      if (content.querySelector('.song-btn[style*="rgba(255,255,255,.4)"]')) {
        content.innerHTML = ''; // Remove empty state
      }
      
      const newBtn = document.createElement("button");
      newBtn.className = "song-btn";
      newBtn.textContent = `${currentSong.artist} — ${currentSong.title}`;
      newBtn.onclick = () => {
        playSong(currentSong.url, currentSong.title, currentSong.artist);
        closeAllModals();
      };
      content.appendChild(newBtn);
      
      // Update counts
      countBadge.textContent = playlists[name].length;
      optCount.textContent = playlists[name].length;
      
      savePlaylists();
      showTemporaryNotification(`Added to "${name}"`);
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
  
  // Update queue highlighting
  populateQueueUI();
};

window.queueSong = (url, title, artist) => {
  songQueue.push({ url, title, artist });
  populateQueueUI(); // Refresh the queue modal
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
    if (s) playSong(s.url, s.title, s.artist);
    updateQueueIndex();
  } else if (songQueue.length > 0) {
    // If we're at the end, loop back to start
    songIndex = 0;
    const s = songQueue[songIndex];
    if (s) playSong(s.url, s.title, s.artist);
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
    populateQueueUI(); // Remove current song highlight
  }
};

// ------------------
// DROPDOWN CONTROLS
// ------------------
playlistBtn.onclick = e => {
  e.stopPropagation();
  playlistDropdown.classList.toggle("active");
};

window.onclick = () => {
  document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("active"));
};

// ------------------
// MAP & PINS
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
    // Clear existing pins (except user marker)
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer !== userMarker) {
        map.removeLayer(layer);
      }
    });

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