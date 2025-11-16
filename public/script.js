/* script.js — Dashboard (timer, wallet, earnings, Gemini/Notion handling) */

/* DOM */
const timer = document.getElementById("timer");
const start = document.getElementById("start");
const pause = document.getElementById("pause");
const resume = document.getElementById("resume");
const end = document.getElementById("end");
const reset = document.getElementById("reset");

const connectBtn = document.getElementById("connectWallet");
const walletBox = document.getElementById("walletInfo");
const walletAddrEl = document.getElementById("walletAddress");
const tokenEl = document.getElementById("tokenEarnings");

const openGemBtn = document.getElementById("openGemini");
const openNotionBtn = document.getElementById("openNotion");
const joinRoomBtn = document.getElementById("joinRoom");

let intervalid = null;
let second = 0;
let breaksecond = 0;
let isrunning = false;
let ispaused = false;
let lastpaused = null;
let logs = [];
let totalEarnings = Number(localStorage.getItem("earnings_test")) || 0;

/* format time */
function formattime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

/* progress ring */
const ring = document.querySelector(".progress-value");
const RADIUS = 110;
const circleLength = 2 * Math.PI * RADIUS;
if (ring) { ring.style.strokeDasharray = circleLength; ring.style.strokeDashoffset = circleLength; }
function updateRing(){ if (!ring) return; const progress = (second % 3600) / 3600; ring.style.strokeDashoffset = circleLength - progress * circleLength; }

/* token UI */
function updateTokenUI() {
  const live = Math.floor(second / 60);
  tokenEl.textContent = (totalEarnings + live) + " TEST";
}
updateTokenUI();

/* Wallet (MetaMask) */
let provider = null, signer = null, userAddress = null;
connectBtn.addEventListener("click", async () => {
  if (!window.ethereum) { alert("MetaMask not installed."); return; }
  try {
    const ethers = window.ethers;
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    walletBox.style.display = "block";
    walletAddrEl.textContent = userAddress.slice(0,6) + "..." + userAddress.slice(-4);
    connectBtn.textContent = "Connected ✓";
    connectBtn.disabled = true;
    localStorage.setItem("sdcontroller_connectedAddress", userAddress);
  } catch(e){ console.error(e); alert("Failed to connect wallet."); }
});

/* ignore flag for intentional external links */
let ignoreNextVisibility = false;

/* controls */
start.addEventListener("click", () => {
  if (isrunning) return;
  isrunning = true; ispaused = false;
  start.style.display = "none";
  pause.style.display = "inline-block";
  end.style.display = "inline-block";
  intervalid = setInterval(() => {
    second++;
    timer.textContent = formattime(second);
    updateRing();
    updateTokenUI();
  }, 1000);
});

pause.addEventListener("click", () => {
  if (!isrunning || ispaused) return;
  clearInterval(intervalid);
  ispaused = true;
  pause.style.display = "none";
  resume.style.display = "inline-block";
  lastpaused = Date.now();
  logs.push({ type: "pause", time: formattime(second) });
});

resume.addEventListener("click", () => {
  if (!ispaused) return;
  ispaused = false;
  resume.style.display = "none";
  pause.style.display = "inline-block";
  intervalid = setInterval(() => {
    second++;
    timer.textContent = formattime(second);
    updateRing();
    updateTokenUI();
  }, 1000);
  if (lastpaused) { breaksecond += Math.floor((Date.now() - lastpaused) / 1000); lastpaused = null; }
});

end.addEventListener("click", () => {
  clearInterval(intervalid);
  isrunning = false; ispaused = false;
  pause.style.display = "none";
  resume.style.display = "none";
  start.style.display = "inline-block";
  end.style.display = "none";

  const reward = Math.floor(second / 60);
  if (reward > 0) { totalEarnings += reward; localStorage.setItem("earnings_test", totalEarnings); }
  updateTokenUI();

  document.getElementById("scoreStudy").textContent = formattime(second);
  document.getElementById("scoreBreak").textContent = formattime(breaksecond);
  document.getElementById("scoreSwitches").textContent = logs.filter(x=>x.type==="tab-switch").length;
  document.getElementById("scoreIdle").textContent = logs.filter(x=>x.type==="idle").length;
  document.getElementById("box5").style.display = "block";

  alert(`Session ended. You earned ${reward} TEST token(s).`);

  second = 0; breaksecond = 0; logs.length = 0;
  timer.textContent = "00:00:00"; updateRing();
});

/* reset */
reset.addEventListener("click", () => {
  clearInterval(intervalid);
  second = 0; breaksecond = 0; logs.length = 0;
  timer.textContent = "00:00:00"; updateRing();
  document.getElementById("switchCount").textContent = 0;
  document.getElementById("idleCount").textContent = 0;
  document.getElementById("box5").style.display = "none";
  start.style.display = "inline-block";
  pause.style.display = "none";
  resume.style.display = "none";
  end.style.display = "none";
  isrunning = false; ispaused = false;
  updateTokenUI();
});

/* visibilitychange (tab switch) */
document.addEventListener("visibilitychange", () => {
  if (ignoreNextVisibility) { ignoreNextVisibility = false; return; }
  if (document.hidden && isrunning && !ispaused) {
    clearInterval(intervalid); ispaused = true;
    pause.style.display = "none"; resume.style.display = "inline-block";
    logs.push({ type: "tab-switch", time: formattime(second) });
    document.getElementById("switchCount").textContent = logs.filter(x=>x.type==="tab-switch").length;
    alert("Timer paused due to tab switch");
  }
});

/* idle detection */
let idleTimeout;
function resetIdle() {
  clearTimeout(idleTimeout);
  idleTimeout = setTimeout(() => {
    if (isrunning && !ispaused) {
      clearInterval(intervalid);
      ispaused = true;
      pause.style.display = "none"; resume.style.display = "inline-block";
      logs.push({ type: "idle", time: formattime(second) });
      document.getElementById("idleCount").textContent = logs.filter(x=>x.type==="idle").length;
      alert("You were idle — time paused.");
    }
  }, 15000);
}
["mousemove","keydown","click","scroll"].forEach(evt => document.addEventListener(evt, resetIdle));

/* external links (Gemini / Notion) — do not count as tab switch */
openGemBtn.addEventListener("click", () => {
  ignoreNextVisibility = true;
  window.open("https://gemini.google.com/", "_blank", "noopener,noreferrer");
});
openNotionBtn.addEventListener("click", () => {
  ignoreNextVisibility = true;
  window.open("https://www.notion.so/", "_blank", "noopener,noreferrer");
});

/* join focus room (navigates to room.html) */
joinRoomBtn.addEventListener("click", () => {
  window.location.href = "/room.html";
});

/* keep token UI updated */
setInterval(updateTokenUI, 2000);
