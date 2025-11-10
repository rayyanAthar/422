const socket = io();

window.addEventListener("DOMContentLoaded", () => {
    const map = L.map("map").setView([41.8781, -87.6298], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    const audioPlayer = new Audio();
    const songInfo = document.getElementById("songInfo");
    const playBtn = document.getElementById("playBtn");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const showQueueBtn = document.getElementById("showQueueBtn");
    const queueDiv = document.getElementById("queue");
    const mainDiv = document.getElementById("main");
    const seekSlider = document.getElementById("seekSlider");
    const timeLabel = document.getElementById("timeLabel");
    const spacer = document.getElementById("spacer");

    let currentSong = null;
    let songIndex = -1;
    let songQueue = [];

    socket.on("connect", () => console.log("Connected:", socket.id));

    const redPinIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-red.png', 
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize:     [25, 41],  
        iconAnchor:   [12, 41],  
        popupAnchor:  [1, -34], 
        shadowSize:   [41, 41]
    });
    
    socket.on("pins", (pins) => {
        pins.forEach(pin => {
            const marker = L.marker([pin.lat, pin.lng], { icon: redPinIcon }).addTo(map);
    
            marker.bindPopup(`
                <b>${pin.artist}</b><br>
                <i>${pin.song}</i><br><br>
                <button onclick="playSong('${pin.audio_url}', '${pin.song}', '${pin.artist}')">Play</button>
                <button onclick="queueSong('${pin.audio_url}', '${pin.song}', '${pin.artist}')">Queue</button>
            `);
        });
    });
    spacer.style.display = "none";
    mainDiv.style.width = "100%";

    // Re-render map after layout loads
    setTimeout(() => map.invalidateSize(), 500);

    // Play song from pin
    window.playSong = (url, title, artist) => {
        currentSong = { url, title, artist };
        audioPlayer.src = url;
        audioPlayer.crossOrigin = "anonymous";
        audioPlayer.play()
            .then(() => console.log("Playing:", title))
            .catch(err => console.error("Playback failed:", err));
        songInfo.textContent = `${artist} — ${title}`;
        playBtn.classList.remove("play");
        playBtn.classList.add("pause");
    };

    // Queue song from pin
    window.queueSong = (url, title, artist) => {
        songQueue.push({ url, title, artist });
        console.log("Queued:", title);
        const newSong = document.createElement("div");
        newSong.textContent = `${artist} — ${title}`;
        const queue = document.getElementById("queue");
        queue.appendChild(newSong);
    };

    // Toggle play/pause
    playBtn.onclick = () => {
        if (!currentSong) return;
        if (audioPlayer.paused) {
            audioPlayer.play();
            playBtn.classList.remove("play");
            playBtn.classList.add("pause");
        } else {
            audioPlayer.pause();
            playBtn.classList.remove("pause");
            playBtn.classList.add("play");
        }
    };

    // Play previous song in queue
    prevBtn.onclick = () => {
        if (songIndex > 0) {
            songIndex--;
            const song = songQueue[songIndex];
            playSong(song.url, song.title, song.artist);
        }
    }

    // Play next song in queue
    nextBtn.onclick = () => {
        if (songIndex < songQueue.length - 1) {
            songIndex++;
            const song = songQueue[songIndex];
            playSong(song.url, song.title, song.artist);
            queueDiv.removeChild(queueDiv.firstChild); 
        }
    };

    // Show/hide queue
    showQueueBtn.onclick = () => { 
        if (spacer.style.display === "none") {
            spacer.style.display = "flex";
            showQueueBtn.textContent = "Hide Queue";
            showQueueBtn.classList.add("active"); // highlight when active
            mainDiv.style.width = "80%";
        } else {
            spacer.style.display = "none";
            showQueueBtn.textContent = "Show Queue";
            showQueueBtn.classList.remove("active");
            mainDiv.style.width = "100%";
        }
    };

    {
    // Update slider max when song metadata loads
    audioPlayer.addEventListener("loadedmetadata", () => {
        seekSlider.max = audioPlayer.duration;
        updateTimeLabel();
    });

    // Update slider as audio plays
    audioPlayer.addEventListener("timeupdate", () => {
        seekSlider.value = audioPlayer.currentTime;
        updateTimeLabel();
    });

    // Seek to a position when slider changes
    seekSlider.addEventListener("input", () => {
        audioPlayer.currentTime = seekSlider.value;
        updateTimeLabel();
    });

    // Auto-play next song when current ends
    audioPlayer.onended = () => {
        if (songIndex < songQueue.length - 1) {
            songIndex++;
            const song = songQueue[songIndex];
            playSong(song.url, song.title, song.artist);
            queueDiv.removeChild(queueDiv.firstChild);
        } else {
            currentSong = null;
            songInfo.textContent = "No song playing";
            playBtn.classList.remove("pause");
            playBtn.classList.add("play");
        }
    };

    // Function to update time label
    function updateTimeLabel() {
        const current = formatTime(audioPlayer.currentTime);
        const total = formatTime(audioPlayer.duration);
        timeLabel.textContent = `${current} / ${total}`;
    }

    // Format seconds to mm:ss
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }
    }
});
