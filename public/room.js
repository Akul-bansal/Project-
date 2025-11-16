// room.js — FIXED VERSION (Timer stops on end session)
(function () {
  const socket = io();

  // UI refs
  const displayName = document.getElementById("displayName");
  const btnFind = document.getElementById("btnFind");
  const btnCancel = document.getElementById("btnCancel");
  const statusEl = document.getElementById("status");

  const roomArea = document.getElementById("roomArea");
  const roomIdEl = document.getElementById("roomId");
  const meNameEl = document.getElementById("meName");
  const peerNameEl = document.getElementById("peerName");
  const leaderList = document.getElementById("leaderList");

  const messagesEl = document.getElementById("messages");
  const chatForm = document.getElementById("chatForm");
  const msgInput = document.getElementById("msgInput");

  const btnStartSession = document.getElementById("btnStartSession");
  const btnEndSession = document.getElementById("btnEndSession");
  const btnLeave = document.getElementById("btnLeave");
  const roomTimer = document.getElementById("roomTimer");

  // local state
  let myName = null;
  let currentRoomId = null;
  let startTime = null;
  let timerInterval = null;

  function setStatus(txt) { statusEl.textContent = txt; }

  // -------------------------------------------------------
  // FIND PARTNER
  // -------------------------------------------------------
  btnFind.addEventListener("click", () => {
    const name = (displayName.value || "Anon").trim().slice(0, 30);
    if (!name) { alert("Please enter a display name."); return; }
    myName = name;

    btnFind.disabled = true;
    btnCancel.disabled = false;
    setStatus("Searching for partner...");

    socket.emit("find", { name });
  });

  btnCancel.addEventListener("click", () => {
    socket.emit("cancel");
    btnCancel.disabled = true;
    btnFind.disabled = false;
    setStatus("Cancelled searching.");
  });

  // -------------------------------------------------------
  // SOCKET EVENTS
  // -------------------------------------------------------
  socket.on("status", (d) => { if (d?.msg) setStatus(d.msg); });

  socket.on("matched", (d) => {
    currentRoomId = d.roomId;
    roomIdEl.textContent = currentRoomId;
    meNameEl.textContent = myName;
    peerNameEl.textContent = d.peer?.name || "Partner";

    setStatus("Matched! You're in a private focus room.");

    document.querySelector(".join-card").style.display = "none";
    roomArea.hidden = false;

    messagesEl.innerHTML = "";
    leaderList.innerHTML = "";

    stopTimerLocal();          // ensure no leftover timer
    roomTimer.textContent = "00:00:00";
  });

  socket.on("message", (m) => {
    renderMessage(m.name || "Anon", m.text, m.uid === socket.id ? "me" : "peer");
  });

  socket.on("sessionStarted", (d) => {
    startTime = d.startTime;
    startTimerLocal();
    setStatus("Session in progress.");
  });

  socket.on("leaderboard", (lb) => {
    renderLeaderboard(lb || {});
  });

  socket.on("partnerLeft", (info) => {
    setStatus("Partner left the room.");
    renderSystemMessage(`${info.name || "Partner"} disconnected.`);

    stopTimerLocal();
    startTime = null;
    roomTimer.textContent = "00:00:00";
  });

  socket.on("disconnect", () => {
    setStatus("Disconnected from server.");
    stopTimerLocal();
  });

  // -------------------------------------------------------
  // CHAT
  // -------------------------------------------------------
  chatForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const txt = (msgInput.value || "").trim();
    if (!txt) return;

    if (/(https?:\/\/|www\.)/i.test(txt)) {
      alert("Links are not allowed.");
      return;
    }

    if (txt.length > 600) {
      alert("Message too long");
      return;
    }

    socket.emit("message", { text: txt });
    msgInput.value = "";
  });

  // -------------------------------------------------------
  // START SESSION
  // -------------------------------------------------------
  btnStartSession.addEventListener("click", () => {
    socket.emit("startSession");
  });

  // -------------------------------------------------------
  // END SESSION (FIXED)
  // -------------------------------------------------------
  btnEndSession.addEventListener("click", () => {

    if (!startTime) {
      alert("Session hasn't started.");
      return;
    }

    // STOP TIMER immediately
    stopTimerLocal();
    const elapsed = Date.now() - startTime;
    const secs = Math.floor(elapsed / 1000);

    // Reset local startTime so timer stays STOPPED
    startTime = null;

    roomTimer.textContent = formatMs(elapsed);

    socket.emit("endSession", { secs });

    renderSystemMessage("You ended the session.");
    alert(`You submitted ${formatMs(elapsed)} focused time.`);
  });

  // -------------------------------------------------------
  // LEAVE ROOM
  // -------------------------------------------------------
  btnLeave.addEventListener("click", () => {
    socket.emit("leave");
    cleanupLocal();
  });

  // -------------------------------------------------------
  // TIMER HELPERS
  // -------------------------------------------------------
  function startTimerLocal() {
    stopTimerLocal();
    timerInterval = setInterval(() => {
      if (!startTime) return;
      const elapsed = Date.now() - startTime;
      roomTimer.textContent = formatMs(elapsed);
    }, 500);
  }

  function stopTimerLocal() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  // -------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------
  function cleanupLocal() {
    currentRoomId = null;
    startTime = null;

    stopTimerLocal();
    roomTimer.textContent = "00:00:00";

    document.querySelector(".join-card").style.display = "block";
    roomArea.hidden = true;

    btnFind.disabled = false;
    btnCancel.disabled = true;

    messagesEl.innerHTML = "";
    leaderList.innerHTML = "";

    setStatus("Not connected.");
  }

  // -------------------------------------------------------
  // UTIL RENDERING
  // -------------------------------------------------------
  function renderMessage(name, text, who) {
    const node = document.createElement("div");
    node.className = "msg " + (who === "me" ? "me" : "peer");
    node.innerHTML =
      `<div class="text">${escapeHtml(text)}</div>
       <span class="meta">${escapeHtml(name)} • ${new Date().toLocaleTimeString()}</span>`;
    messagesEl.appendChild(node);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderSystemMessage(text) {
    const node = document.createElement("div");
    node.className = "msg peer";
    node.style.opacity = "0.8";
    node.innerHTML = `<div class="text"><em>${escapeHtml(text)}</em></div>`;
    messagesEl.appendChild(node);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderLeaderboard(lb) {
    leaderList.innerHTML = "";
    const arr = Object.keys(lb || {}).map(k => ({
      id: k,
      name: lb[k].name || "Anon",
      secs: lb[k].secs || 0
    }));

    arr.sort((a, b) => b.secs - a.secs);

    arr.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.name} — ${formatMs(item.secs * 1000)}`;
      leaderList.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"'`]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;', '`': '&#96;'
    }[c]));
  }

  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // clean disconnect
  window.addEventListener("beforeunload", () => {
    socket.emit("leave");
  });

  setStatus("Connected. Enter a display name and find a partner.");
})();
