// script.js

// =======================
// CONFIGURATION CONSTANTS
// =======================
const YOUTUBE_API_KEY = 'AIzaSyB1YQ_mzFg-kBwJXVy_JFji5_KHYbIt9FE';
const CHANNEL_ID = 'UCtZnpXyUowew9eg1rbkoL7A';
// =======================
// GLOBAL VARIABLES
// =======================
let isHost = false;
let roomId = "";
let player;
let syncInterval; // For host continuous sync
const socket = io(); // Connect to the Socket.io server

// For hotspot connections, we assume joiners load the page from the host's local IP.
// The host's IP is available via window.location.hostname.
const hostIP = window.location.hostname;

// =======================
// HELPER FUNCTIONS
// =======================

// Check if an IP address is in a private range (including localhost)
function isPrivateIP(ip) {
  return ip === "localhost" ||
         ip === "127.0.0.1" ||
         ip.startsWith("192.168.") ||
         ip.startsWith("10.") ||
         (ip.startsWith("172.") && (function(parts) {
             const secondOctet = parseInt(parts[1], 10);
             return secondOctet >= 16 && secondOctet <= 31;
         })(ip.split('.')));
}

// Utility: Generate a random 4-character Room ID
function generateShortRoomID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to fetch a new live video ID via the YouTube Data API
async function fetchNewLiveVideo() {
  const apiURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`;
  try {
    const response = await fetch(apiURL);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id.videoId; // Return first live video ID found
    } else {
      console.log("No live broadcast found.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching new live video:", error);
    return null;
  }
}

// =======================
// YOUTUBE IFRAME API
// =======================

function onYouTubeIframeAPIReady() {
  console.log("YouTube IFrame API loaded.");
}

function createPlayer(videoId) {
  const playerDiv = document.getElementById("player");
  playerDiv.classList.remove("hidden");
  playerDiv.classList.add("animate");
  document.getElementById("syncNowBtn").classList.toggle("hidden", !isHost);
  
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: { autoplay: 0, controls: 1 },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  console.log("YouTube Player is ready.");
  if (isHost) {
    socket.emit("joinRoom", { roomId, isHost: true });
    // Generate QR code for joiners
    const qrDiv = document.getElementById("qrCode");
    if (qrDiv) {
      qrDiv.innerHTML = "";
      new QRCode(qrDiv, { text: window.location.href, width: 150, height: 150 });
    }
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(sendSyncCommand, 200);
    }
  } else {
    socket.emit("joinRoom", { roomId, isHost: false });
  }
}

function onPlayerStateChange(event) {
  if (!isHost) return;
  if (event.data === YT.PlayerState.PLAYING) {
    console.log("Host playing");
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(sendSyncCommand, 200);
    socket.emit("sync", { roomId, time: player.getCurrentTime(), state: "play", forceSync: false });
  } else if (event.data === YT.PlayerState.PAUSED) {
    console.log("Host paused");
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    socket.emit("sync", { roomId, time: player.getCurrentTime(), state: "pause", forceSync: false });
  } else if (event.data === YT.PlayerState.ENDED) {
    console.log("Host video ended");
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
    socket.emit("sync", { roomId, time: player.getCurrentTime(), state: "pause", forceSync: false });
    fetchNewLiveVideo().then((newVideoId) => {
      if (newVideoId) {
        console.log("New live video found:", newVideoId);
        createPlayer(newVideoId);
        socket.emit("newLiveVideo", { roomId, videoId: newVideoId });
      } else {
        console.log("No new live video available at this time.");
      }
    });
  }
}

function sendSyncCommand(force = false) {
  if (player && isHost) {
    const currentTime = player.getCurrentTime();
    socket.emit("sync", { roomId, time: currentTime, state: "play", forceSync: force });
    console.log("Sync command sent:", currentTime, force ? "[Force Sync]" : "");
  }
}

// =======================
// SOCKET EVENT HANDLERS
// =======================

socket.on("sync", (data) => {
  if (!isHost && player && data.roomId === roomId) {
    console.log("Received sync data:", data);
    if (typeof data.time === "number") {
      const currentTime = player.getCurrentTime();
      if (Math.abs(currentTime - data.time) > 0.1) { // 0.1-second threshold
        player.seekTo(data.time, true);
      }
    }
    if (data.state === "play") {
      player.playVideo();
    } else if (data.state === "pause") {
      player.pauseVideo();
    }
  }
});

socket.on("newLiveVideo", (data) => {
  if (!isHost && data.roomId === roomId && data.videoId) {
    console.log("Received new live video event:", data.videoId);
    createPlayer(data.videoId);
  }
});

socket.on("invalidRoom", (data) => {
  alert(data.message);
});

// =======================
// UI EVENT HANDLERS
// =======================

// Host Mode Selection
document.getElementById("hostBtn").addEventListener("click", () => {
  isHost = true;
  roomId = generateShortRoomID();
  document.getElementById("hostRoomID").textContent = roomId;
  document.getElementById("modeSelection").classList.add("hidden");
  document.getElementById("hostSection").classList.remove("hidden");
  socket.emit("joinRoom", { roomId, isHost: true });
});

// Join Mode Selection
document.getElementById("joinBtn").addEventListener("click", () => {
  isHost = false;
  document.getElementById("modeSelection").classList.add("hidden");
  document.getElementById("joinSection").classList.remove("hidden");
});

// Join Room Button
document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const inputRoom = document.getElementById("joinRoomInput").value.trim();
  if (inputRoom === "") {
    document.getElementById("joinError").textContent = "Please enter a Room ID.";
    return;
  }
  roomId = inputRoom;
  if (!isPrivateIP(hostIP)) {
    alert("You are not connected to the host's hotspot. Please connect and try again.");
    return;
  } else {
    alert("WiFi connection established successfully. Loading video...");
  }
  socket.emit("joinRoom", { roomId, isHost: false });
  document.getElementById("joinSection").classList.add("hidden");
  document.getElementById("syncRoomID").textContent = roomId;
  document.getElementById("syncSection").classList.remove("hidden");
});

// Host: Start Sync Button
document.getElementById("startSyncHost").addEventListener("click", () => {
  document.getElementById("hostSection").classList.add("hidden");
  document.getElementById("syncRoomID").textContent = roomId;
  document.getElementById("syncSection").classList.remove("hidden");
});

// Load Video Button
document.getElementById("loadVideoBtn").addEventListener("click", () => {
  const videoId = document.getElementById("videoIdInput").value.trim();
  if (videoId) {
    createPlayer(videoId);
    document.getElementById("videoInputSection").classList.add("hidden");
    console.log("Loading YouTube Video ID:", videoId);
  } else {
    alert("Please enter a valid YouTube Video ID.");
  }
});

// Optional: Manual Sync Now Button for Host (force sync)
document.getElementById("syncNowBtn").addEventListener("click", () => {
  sendSyncCommand(true);
});

// =======================
// DYNAMIC BUBBLE SPAWNING (VISUAL EFFECT)
// =======================
function spawnBubble() {
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const left = Math.random() * 100;
  bubble.style.left = left + '%';
  const delay = Math.random() * 3;
  bubble.style.animationDelay = delay + 's';
  const duration = 3 + Math.random() * 2;
  bubble.style.animationDuration = duration + 's';
  document.getElementById('bubbles').appendChild(bubble);
  setTimeout(() => {
    if (bubble.parentNode) {
      bubble.remove();
    }
  }, (duration + delay) * 1000);
  bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!bubble.classList.contains('pop')) {
      bubble.classList.add('pop');
      setTimeout(() => {
        bubble.remove();
      }, 500);
    }
  });
}
setInterval(spawnBubble, 1000);
