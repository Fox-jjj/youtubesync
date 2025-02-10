// script.js

// Global Variables
let isHost = false;
let roomId = "";
let player;
let syncInterval; // For host continuous sync
const socket = io(); // Connect to the Socket.io server

// For a hotspot connection, we assume joiners load the page from the host's local IP.
// The host's IP is available via window.location.hostname.
const hostIP = window.location.hostname;

// Helper: Check if an IP address is in a private range (common for hotspots)
function isPrivateIP(ip) {
  return ip.startsWith("192.168.") ||
         ip.startsWith("10.") ||
         (ip.startsWith("172.") && (function(parts) {
             const secondOctet = parseInt(parts[1], 10);
             return secondOctet >= 16 && secondOctet <= 31;
         })(ip.split('.')));
}

// If this client is a joiner and the detected host IP is not private, alert the user.
if (!isHost && !isPrivateIP(hostIP)) {
  alert("It appears you are not connected to the host's hotspot. Please connect to the host's hotspot and reload the page.");
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

// YouTube IFrame API callback
function onYouTubeIframeAPIReady() {
  console.log("YouTube IFrame API loaded.");
}

// Create the YouTube Player
function createPlayer(videoId) {
  const playerDiv = document.getElementById("player");
  playerDiv.classList.remove("hidden");
  playerDiv.classList.add("animate");
  // Show the Sync Now button only for host (if manual control is desired)
  document.getElementById("syncNowBtn").classList.toggle("hidden", !isHost);

  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: videoId,
    playerVars: {
      autoplay: 0,
      controls: 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// When the player is ready
function onPlayerReady(event) {
  console.log("YouTube Player is ready.");
  if (isHost) {
    socket.emit("joinRoom", { roomId, isHost: true });
    // If the host is already playing, start sending sync updates every 200ms
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(sendSyncCommand, 200);
    }
  } else {
    socket.emit("joinRoom", { roomId, isHost: false });
  }
}

// Host Player State Change Handler
function onPlayerStateChange(event) {
  if (!isHost) return; // Only host sends sync updates
  // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
  if (event.data === YT.PlayerState.PLAYING) {
    console.log("Host playing");
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(sendSyncCommand, 200);
    socket.emit("sync", {
      roomId,
      time: player.getCurrentTime(),
      state: "play",
      forceSync: false
    });
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    console.log("Host paused or ended");
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
    socket.emit("sync", {
      roomId,
      time: player.getCurrentTime(),
      state: "pause",
      forceSync: false
    });
  }
}

// Host sends sync commands periodically; accepts an optional 'force' parameter
function sendSyncCommand(force = false) {
  if (player && isHost) {
    const currentTime = player.getCurrentTime();
    socket.emit("sync", {
      roomId,
      time: currentTime,
      state: "play",
      forceSync: force
    });
    console.log("Sync command sent:", currentTime, force ? "[Force Sync]" : "");
  }
}

// Joiner listens for sync events from the host
socket.on("sync", (data) => {
  if (!isHost && player && data.roomId === roomId) {
    console.log("Received sync data:", data);
    if (typeof data.time === "number") {
      const currentTime = player.getCurrentTime();
      // If forceSync is true or the difference is greater than 0.5 seconds, seek to the host's time
      if (data.forceSync || Math.abs(currentTime - data.time) > 0.5) {
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

// Listen for invalid room events (if joiner attempts to join a room with no host)
socket.on("invalidRoom", (data) => {
  alert(data.message);
});

// UI Event Handlers

// Mode Selection: Host
document.getElementById("hostBtn").addEventListener("click", () => {
  isHost = true;
  roomId = generateShortRoomID();
  document.getElementById("hostRoomID").textContent = roomId;
  document.getElementById("modeSelection").classList.add("hidden");
  document.getElementById("hostSection").classList.remove("hidden");
  // Immediately register the room on the server
  socket.emit("joinRoom", { roomId, isHost: true });
});

// Mode Selection: Join
document.getElementById("joinBtn").addEventListener("click", () => {
  isHost = false;
  document.getElementById("modeSelection").classList.add("hidden");
  document.getElementById("joinSection").classList.remove("hidden");
});

// Join Room
document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const inputRoom = document.getElementById("joinRoomInput").value.trim();
  if (inputRoom === "") {
    document.getElementById("joinError").textContent = "Please enter a Room ID.";
    return;
  }
  roomId = inputRoom;
  socket.emit("joinRoom", { roomId, isHost: false });
  document.getElementById("joinSection").classList.add("hidden");
  document.getElementById("syncRoomID").textContent = roomId;
  document.getElementById("syncSection").classList.remove("hidden");
});

// Host: Start Sync
document.getElementById("startSyncHost").addEventListener("click", () => {
  document.getElementById("hostSection").classList.add("hidden");
  document.getElementById("syncRoomID").textContent = roomId;
  document.getElementById("syncSection").classList.remove("hidden");
});

// Load Video
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

// Optional: Manual Sync Now Button for host (force sync)
document.getElementById("syncNowBtn").addEventListener("click", () => {
  sendSyncCommand(true); // Force a sync update
});

// Dynamic Bubble Spawning (for visual effect)
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
