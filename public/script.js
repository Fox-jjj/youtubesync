// script.js

// Global Variables
let isHost = false;
let roomId = "";
let player;
let syncInterval; // For continuous sync (host only)
const socket = io(); // Connect to Socket.io server

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
    // Notify the server that the host has joined the room
    socket.emit("joinRoom", { roomId, isHost: true });
    // If already playing, start sending sync updates every 200ms
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(sendSyncCommand, 200);
    }
  } else {
    // Notify the server that a joiner has joined the room
    socket.emit("joinRoom", { roomId, isHost: false });
  }
}

// Host Player State Change Handler
function onPlayerStateChange(event) {
  if (!isHost) return; // Only host sends updates
  // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
  if (event.data === YT.PlayerState.PLAYING) {
    console.log("Host playing");
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(sendSyncCommand, 200);
    socket.emit("sync", {
      roomId,
      time: player.getCurrentTime(),
      state: "play"
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
      state: "pause"
    });
  }
}

// Host sends sync commands periodically
function sendSyncCommand() {
  if (player && isHost) {
    const currentTime = player.getCurrentTime();
    socket.emit("sync", {
      roomId,
      time: currentTime,
      state: "play"
    });
    console.log("Sync command sent:", currentTime);
  }
}

// Joiner listens for sync events from the host
socket.on("sync", (data) => {
  if (!isHost && player && data.roomId === roomId) {
    console.log("Received sync data:", data);
    if (typeof data.time === "number") {
      const currentTime = player.getCurrentTime();
      if (Math.abs(currentTime - data.time) > 0.5) {
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

// Listen for invalid room events (if joiner tries to join a non-existent room)
socket.on("invalidRoom", (data) => {
  alert(data.message);
  // Optionally reset UI for joiner to try again
});

// UI Event Handlers

// Mode Selection: Host
document.getElementById("hostBtn").addEventListener("click", () => {
  isHost = true;
  roomId = generateShortRoomID();
  document.getElementById("hostRoomID").textContent = roomId;
  document.getElementById("modeSelection").classList.add("hidden");
  document.getElementById("hostSection").classList.remove("hidden");
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

// Optional: Manual Sync Now Button for host
document.getElementById("syncNowBtn").addEventListener("click", () => {
  sendSyncCommand();
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
