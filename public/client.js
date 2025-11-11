/* client.js
   Combines functionality from variant 2 with the red styling + icon buttons from variant 1.
   Expects /socket.io/socket.io.min.js and Leaflet to be loaded in the page.
*/

const socket = io();

// MAP SETUP
document.addEventListener("DOMContentLoaded", () => {
    const map = L.map("map").setView([41.8781, -87.6298], 12);
    L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            subdomains: "abcd",
            maxZoom: 19,
        }
    ).addTo(map);

    // optional red icon for markers (keeps consistency)
    const redIcon = L.icon({
        iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });

    // UI elements
    const audioPlayer = new Audio();
    const songInfo = document.getElementById("songInfo");
    const playBtn = document.getElementById("playBtn");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const showQueueBtn = document.getElementById("showQueueBtn");
    const showPlaylistBtn = document.getElementById("showPlaylistBtn");
    const playlistBtn = document.getElementById("playlistBtn");
    const createPlaylistBtn = document.getElementById("createPlaylistBtn");
    const queueDiv = document.getElementById("queue");
    const seekSlider = document.getElementById("seekSlider");
    const timeLabel = document.getElementById("timeLabel");
    const queueSidebar = document.getElementById("sidebar-left");
    const playlistSidebar = document.getElementById("sidebar-right");
    const playlistDropdown = document.getElementById("playlistDropdown");
    const playlistOpt = document.getElementById("playlistOpt");
    const notification = document.getElementById("notification");

    let currentSong = null;
    let songIndex = -1;
    let songQueue = [];
    let playlists = [];

    socket.on("connect", () => console.log("Socket connected:", socket.id));

    // Receive pins and add markers with popup buttons
    socket.on("pins", (pins) => {
        pins.forEach((pin) => {
            const marker = L.marker([pin.lat, pin.lng], { icon: redIcon }).addTo(map);
            marker.bindPopup(`
        <div class="popup-content">
          <b>${escapeHtml(pin.artist)}</b><br>
          <i>${escapeHtml(pin.song)}</i><br><br>
          <button class="popup-play-btn">Play</button>
          <button class="popup-queue-btn">Queue</button>
        </div>
      `);

            marker.on("popupopen", function (e) {
                const popupEl = e.popup.getElement();
                const playBtnEl = popupEl.querySelector(".popup-play-btn");
                const queueBtnEl = popupEl.querySelector(".popup-queue-btn");

                // remove old listeners then add
                playBtnEl.onclick = () => {
                    playSong(pin.audio_url, pin.song, pin.artist);
                    e.popup._close(); // close popup after pressing
                };
                queueBtnEl.onclick = () => {
                    queueSong(pin.audio_url, pin.song, pin.artist);
                    showTemporaryNotification(`"${pin.song}" added to queue`);
                    e.popup._close();
                };
            });
        });
    });

    // Hide sidebars at start (matches second variant behavior)
    queueSidebar.classList.add("hidden");
    playlistSidebar.classList.add("hidden");

    // Dropdown toggle (playlist)
    playlistBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        playlistDropdown.classList.toggle("active");
        playlistOpt.setAttribute(
            "aria-hidden",
            !playlistDropdown.classList.contains("active")
        );
    });

    // Close dropdown when clicking outside
    window.addEventListener("click", (e) => {
        if (!playlistDropdown.contains(e.target)) {
            playlistDropdown.classList.remove("active");
            playlistOpt.setAttribute("aria-hidden", "true");
        }
    });

 // Create new playlist
createPlaylistBtn?.addEventListener("click", () => {
  const name = prompt("Enter playlist name:");
  if (!name) return;

  // Create dropdown for sidebar
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  const btn = document.createElement("button");
  btn.className = "dropdown-btn";
  btn.textContent = name;

  const content = document.createElement("div");
  content.id = name;
  content.className = "dropdown-content";

  const songBtn = document.createElement("button");
  songBtn.className = "control-btn";
  songBtn.textContent = currentSong.title;
    songBtn.dataset.url = currentSong.url;
    songBtn.dataset.artist = currentSong.artist;

  songBtn.addEventListener("click", () => {
    playSong(songBtn.dataset.url, songBtn.textContent, songBtn.dataset.artist);
    });
  content.appendChild(songBtn);

  dropdown.appendChild(btn);
  dropdown.appendChild(content);

  document.getElementById("playlist").appendChild(dropdown);

  // Add option to playlist dropdown menu
  const optBtn = document.createElement("button");
  optBtn.className = "control-btn small";
  optBtn.textContent = name;
  document.getElementById("playlistOpt").appendChild(optBtn);

  // Notification
  showTemporaryNotification(`"${name}" playlist created`);

  // Toggle dropdown visibility
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("active");
  });

  // Add song to playlist when option clicked
  optBtn.addEventListener("click", () => {
    const pl = document.getElementById(name);
    if (!pl) return;
    const newSong = document.createElement("button");
    newSong.className = "song-btn";
    newSong.textContent = currentSong.title;
    newSong.dataset.url = currentSong.url;
    newSong.dataset.artist = currentSong.artist;

    newSong.addEventListener("click", () => {
    // audioPlayer.pause();
        playSong(newSong.dataset.url, newSong.textContent, newSong.dataset.artist);
    });

    pl.appendChild(newSong);
    showTemporaryNotification(`Added "${currentSong.title}" to ${name}`);
  });

//   newSong.addEventListener("click", () => {
//     audioPlayer.pause();

//     playSong(newSong.dataset.url, newSong.textContent, newSong.dataset.artist);
//   });
});

    // // buttons.forEach(button => { 
    // // button.onclick = () => { 
    // // if (!currentSong) return; 
    // // if (audioPlayer.paused) { 
    // // audioPlayer.play(); 
    // // button.textContent = "⏸"; 
    // // } else { 
    // // audioPlayer.pause(); 
    // // button.textContent = "▶"; 
    // 
    // } 
    // }})

    document.addEventListener("click", () => {
        document
            .querySelectorAll(".dropdown.active")
            .forEach((d) => d.classList.remove("active"));
    });

    // Prevent clicks on notification from closing dropdowns
    notification.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Play song from pin / queue
    window.playSong = (url, title, artist) => {
        currentSong = { url, title, artist };
        audioPlayer.src = url;
        audioPlayer.crossOrigin = "anonymous";
        audioPlayer.play().catch((err) => console.warn("Play failed:", err));
        songInfo.textContent = `${artist} — ${title}`;
        playBtn.classList.remove("play");
        playBtn.classList.add("pause");
    };

    // Queue a song
    window.queueSong = (url, title, artist) => {
        songQueue.push({ url, title, artist });
        const newSongEl = document.createElement("div");
        newSongEl.className = "queue-item";
        newSongEl.textContent = `${artist} — ${title}`;
        queueDiv.appendChild(newSongEl);
        showTemporaryNotification(`"${title}" added to queue`);
    };

    // Play/pause toggle
    playBtn.onclick = () => {
        if (!currentSong) return;
        if (audioPlayer.paused) {
            audioPlayer.play().catch((err) => console.warn("Play failed:", err));
            playBtn.classList.remove("play");
            playBtn.classList.add("pause");
        } else {
            audioPlayer.pause();
            playBtn.classList.remove("pause");
            playBtn.classList.add("play");
        }
    };

    // Prev / Next behavior
    prevBtn.onclick = () => {
        if (songIndex > 0) {
            songIndex--;
            const s = songQueue[songIndex];
            if (s) playSong(s.url, s.title, s.artist);
        }
    };
    nextBtn.onclick = () => {
        if (songIndex < songQueue.length - 1) {
            songIndex++;
            const s = songQueue[songIndex];
            if (s) {
                playSong(s.url, s.title, s.artist);
                // remove first item from visual queue if present
                if (queueDiv.firstChild) queueDiv.removeChild(queueDiv.firstChild);
            }
        }
    };

    // Show/hide queue sidebar
    showQueueBtn.onclick = () => {
        if (queueSidebar.classList.contains("hidden")) {
            queueSidebar.classList.remove("hidden");
            showQueueBtn.textContent = "Hide Queue";
        } else {
            queueSidebar.classList.add("hidden");
            showQueueBtn.textContent = "Show Queue";
        }
        // trigger map resize if needed
        setTimeout(() => {
            try {
                resizeAfterTransition();
            } catch (err) { }
        }, 300);
    };

    // Show/hide playlist sidebar
    showPlaylistBtn.onclick = () => {
        if (playlistSidebar.classList.contains("hidden")) {
            playlistSidebar.classList.remove("hidden");
            showPlaylistBtn.textContent = "Hide Playlist";
        } else {
            playlistSidebar.classList.add("hidden");
            showPlaylistBtn.textContent = "Playlists";
        }
        setTimeout(() => {
            try {
                resizeAfterTransition();
            } catch (err) { }
        }, 300);
    };

    // Slider & time updates
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
        updateTimeLabel();
    });

    // Auto-next behavior
    audioPlayer.onended = () => {
        if (songIndex < songQueue.length - 1) {
            songIndex++;
            const next = songQueue[songIndex];
            if (next) playSong(next.url, next.title, next.artist);
            if (queueDiv.firstChild) queueDiv.removeChild(queueDiv.firstChild);
        } else {
            currentSong = null;
            songInfo.textContent = "No song playing";
            playBtn.classList.remove("pause");
            playBtn.classList.add("play");
        }
    };

    // small helper functions
    function updateTimeLabel() {
        const current = formatTime(audioPlayer.currentTime);
        const total = formatTime(audioPlayer.duration);
        timeLabel.textContent = `${current} / ${total}`;
    }
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    function showTemporaryNotification(text, ms = 1400) {
        notification.textContent = text;
        notification.style.opacity = 1;
        notification.style.pointerEvents = "auto";
        clearTimeout(notification._hideTimer);
        notification._hideTimer = setTimeout(() => {
            notification.style.opacity = 0;
            notification.style.pointerEvents = "none";
        }, ms);
    }

    // small escape for popup strings to avoid breaking popup HTML
    function escapeHtml(unsafe) {
        return String(unsafe || "").replace(
            /[&<>"'`]/g,
            (m) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
                "`": "&#96;",
            }[m])
        );
    }

    function resizeAfterTransition(element, callback, duration = 300) {
        element.addEventListener("transitionend", function handler(e) {
            if (e.propertyName === "width") {
                element.removeEventListener("transitionend", handler);
                callback();
            }
        });
        // Fallback in case no transitionend fires
        setTimeout(callback, duration + 50);
    }

    // Replace sidebar dropdown behavior
    const sidebarDropdownBtns = document.querySelectorAll(
        "#sidebar-right .dropdown-btn"
    );

    sidebarDropdownBtns.forEach((btn) => {
        // Create a floating container for this button
        const floating = document.createElement("div");
        floating.className = "sidebar-dropdown-floating";
        // Move the original dropdown content here
        const content = btn.nextElementSibling;
        floating.appendChild(content);
        document.body.appendChild(floating);

        // Position the floating dropdown under the button
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            // Toggle active
            floating.classList.toggle("active");

            if (floating.classList.contains("active")) {
                const rect = btn.getBoundingClientRect();
                floating.style.top = `${rect.bottom + window.scrollY}px`;
                floating.style.left = `${rect.left + window.scrollX}px`;
            }
        });
    });

    // Close all dropdowns if clicking outside
    window.addEventListener("click", () => {
        document
            .querySelectorAll(".sidebar-dropdown-floating.active")
            .forEach((d) => d.classList.remove("active"));
    });

    // make sure map size recalculates after layout changes
    setTimeout(() => {
        try {
            resizeAfterTransition();
        } catch (err) { }
    }, 600);
});
