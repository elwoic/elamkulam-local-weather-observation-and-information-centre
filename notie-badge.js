import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyASblrFKqSUK6heHly2Bh95EJ_Gqmx0XVQ",
  authDomain: "report-5d8c0.firebaseapp.com",
  databaseURL: "https://report-5d8c0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "report-5d8c0",
  storageBucket: "report-5d8c0.firebasestorage.app",
  messagingSenderId: "831456060916",
  appId: "1:831456060916:web:1e06b9d3897dd9637305a1",
  measurementId: "G-5MGMM1DYDM"
};

// Initialize with a unique name 'badgeApp'
const appBadge = getApps().find(a => a.name === "badgeApp") || initializeApp(firebaseConfig, "badgeApp");
const db = getDatabase(appBadge);

// ... rest of your notie badge logic stays exactly the same ...

/* 2️⃣ CREATE / REUSE NAMED APP */
const app =
  getApps().find(a => a.name === "reportApp")
  ?? initializeApp(firebaseConfig, "reportApp");

/* 3️⃣ DATABASE FROM THAT APP */
const db = getDatabase(app);

/* DEBUG (optional) */
console.log("Firebase apps:", getApps().map(a => a.name));

/* ---------- UI ELEMENTS ---------- */
const badge = document.getElementById("weather-badge");
const badgeCount = document.getElementById("badge-count");
const panel = document.getElementById("weather-panel");
const overlay = document.getElementById("panel-overlay");
const panelContent = document.getElementById("panel-content");
const closeBtn = document.getElementById("close-panel");

/* ---------- PANEL CONTROLS ---------- */
function openSidePanel() {
  overlay.style.display = "block";
  panel.style.transform = "translateX(0)";
  setTimeout(() => overlay.style.opacity = "1", 10);
}

function closeSidePanel() {
  overlay.style.opacity = "0";
  panel.style.transform = "translateX(100%)";
  setTimeout(() => overlay.style.display = "none", 300);
}

badge.onclick = openSidePanel;
closeBtn.onclick = closeSidePanel;
overlay.onclick = closeSidePanel;

/* ---------- DATABASE LISTENER ---------- */
onValue(ref(db, "weather_reports"), (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    badge.style.display = "none";
    return;
  }

  const now = Date.now();
  const validReports = [];

  Object.entries(data).forEach(([key, item]) => {
    if (item.expirationTimestamp && item.expirationTimestamp < now) {
      remove(ref(db, `weather_reports/${key}`));
      return;
    }
    if (item.granted_site1 === "yes") validReports.push(item);
  });

  if (!validReports.length) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "block";
  badgeCount.textContent = validReports.length;

  validReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  panelContent.innerHTML = validReports.map(item => {
    const submittedOn = item.timestamp
      ? new Date(item.timestamp).toLocaleString("en-IN", {
          dateStyle: "short",
          timeStyle: "short"
        })
      : "N/A";

    return `
      <div style="background:white;padding:12px;border-radius:8px;margin-bottom:12px;border-left:4px solid #1e40af">
        <div style="font-size:10px;color:#64748b;display:flex;justify-content:space-between">
          <span>🕒 ${item.time || "N/A"}</span>
          <span>📅 ${submittedOn}</span>
        </div>
        <div style="font-weight:bold;color:#1e40af">${item.report_type}</div>
        <div style="font-weight:700">📍 ${item.location}</div>
        <div>${item.observation}</div>
        <div style="font-size:11px;font-weight:bold">
          Reporter: ${item.show_name === "yes" ? item.name : "Anonymous"}
        </div>
      </div>`;
  }).join("");
});

