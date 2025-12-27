import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* 1️⃣ FIREBASE CONFIGURATION */
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

/* 2️⃣ INITIALIZE UNIQUE APP AND DATABASE */
// We use a unique name 'badgeApp' and a unique variable name 'dbBadge' 
// This prevents the "Redeclaration of const db" error from your screenshot.
const appBadge = getApps().find(a => a.name === "badgeApp") || initializeApp(firebaseConfig, "badgeApp");
const dbBadge = getDatabase(appBadge);

/* ---------- UI ELEMENTS ---------- */
const badge = document.getElementById("weather-badge");
const badgeCount = document.getElementById("badge-count");
const panel = document.getElementById("weather-panel");
const overlay = document.getElementById("panel-overlay");
const panelContent = document.getElementById("panel-content");
const closeBtn = document.getElementById("close-panel");

/* ---------- PANEL CONTROLS ---------- */
function openSidePanel() {
  if (!overlay || !panel) return;
  overlay.style.display = "block";
  panel.style.transform = "translateX(0)";
  setTimeout(() => overlay.style.opacity = "1", 10);
}

function closeSidePanel() {
  if (!overlay || !panel) return;
  overlay.style.opacity = "0";
  panel.style.transform = "translateX(100%)";
  setTimeout(() => overlay.style.display = "none", 300);
}

// Attach events safely
if (badge) badge.onclick = openSidePanel;
if (closeBtn) closeBtn.onclick = closeSidePanel;
if (overlay) overlay.onclick = closeSidePanel;

/* ---------- DATABASE LISTENER ---------- */
onValue(ref(dbBadge, "weather_reports"), (snapshot) => {
  const data = snapshot.val();
  
  if (!data) {
    if (badge) badge.style.display = "none";
    return;
  }

  const now = Date.now();
  const validReports = [];

  Object.entries(data).forEach(([key, item]) => {
    // Check for expired reports
    if (item.expirationTimestamp && item.expirationTimestamp < now) {
      remove(ref(dbBadge, `weather_reports/${key}`));
      return;
    }
    // Only show reports granted for site1
    if (item.granted_site1 === "yes") {
      validReports.push(item);
    }
  });

  if (validReports.length === 0) {
    if (badge) badge.style.display = "none";
    return;
  }

  // Update Badge
  if (badge) badge.style.display = "block";
  if (badgeCount) badgeCount.textContent = validReports.length;

  // Sort: Newest First
  validReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Render Panel Content
  if (panelContent) {
    panelContent.innerHTML = validReports.map(item => {
      const submittedOn = item.timestamp
        ? new Date(item.timestamp).toLocaleString("en-IN", {
            dateStyle: "short",
            timeStyle: "short"
          })
        : "N/A";

      return `
        <div style="background:white;padding:12px;border-radius:8px;margin-bottom:12px;border-left:4px solid #1e40af;box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-left:4px solid #1e40af;">
          <div style="font-size:10px;color:#64748b;display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>🕒 Event: ${item.time || "N/A"}</span>
            <span>📅 Submitted: ${submittedOn}</span>
          </div>
          <div style="font-weight:bold;color:#1e40af;font-size:14px;margin-bottom:4px;">${item.report_type}</div>
          <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">📍 ${item.location}</div>
          <div style="font-size:13px;color:#475569;line-height:1.5;background:#f1f5f9;padding:8px;border-radius:4px;">${item.observation}</div>
          <div style="font-size:11px;margin-top:8px;color:#1e3a8a;font-weight:bold;">
            Reporter: ${item.show_name === "yes" ? item.name : "Anonymous"}
          </div>
        </div>`;
    }).join("");
  }
});
