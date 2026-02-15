import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* =========================================================
   FIREBASE CONFIG
========================================================= */
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

/* =========================================================
   INIT APP (SAFE – NO DUPLICATES)
========================================================= */
const appBadge =
  getApps().find(app => app.name === "badgeApp") ||
  initializeApp(firebaseConfig, "badgeApp");

const dbBadge = getDatabase(appBadge);

/* =========================================================
   WAIT FOR DOM
========================================================= */
document.addEventListener("DOMContentLoaded", () => {

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
    requestAnimationFrame(() => overlay.style.opacity = "1");
  }

  function closeSidePanel() {
    if (!overlay || !panel) return;
    overlay.style.opacity = "0";
    panel.style.transform = "translateX(100%)";
    setTimeout(() => overlay.style.display = "none", 300);
  }

  if (badge) badge.addEventListener("click", openSidePanel);
  if (closeBtn) closeBtn.addEventListener("click", closeSidePanel);
  if (overlay) overlay.addEventListener("click", closeSidePanel);

  /* ---------- INITIAL LOADING STATE ---------- */
  if (panelContent) {
    panelContent.innerHTML =
      `<p style="font-size:13px;color:#64748b;text-align:center;">
        Loading weather updates…
      </p>`;
  }

  /* =========================================================
     DATABASE LISTENER (LIMITED & OPTIMIZED)
  ========================================================= */
  const reportsQuery = query(
    ref(dbBadge, "weather_reports"),
    limitToLast(50) // future-proof
  );

  onValue(reportsQuery, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      if (badge) badge.style.display = "none";
      if (panelContent) {
        panelContent.innerHTML =
          `<p style="font-size:13px;color:#64748b;text-align:center;">
            No active updates.
          </p>`;
      }
      return;
    }

    const now = Date.now();
    const validReports = [];

    Object.values(data).forEach(item => {
     const expired =
  item.expiration_site1 &&
  item.expiration_site1 < now;


      if (!expired && item.granted_site1 === "yes") {
        validReports.push(item);
      }
    });

    /* ---------- BADGE VISIBILITY ---------- */
    if (validReports.length === 0) {
      if (badge) badge.style.display = "none";
      if (panelContent) {
        panelContent.innerHTML =
          `<p style="font-size:13px;color:#64748b;text-align:center;">
            No current alerts.
          </p>`;
      }
      return;
    }

    if (badge) badge.style.display = "block";
    if (badgeCount) badgeCount.textContent = validReports.length;

    /* ---------- SORT (NEWEST FIRST) ---------- */
    validReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    /* ---------- RENDER PANEL ---------- */
    if (!panelContent) return;

    panelContent.innerHTML = validReports.map(item => {
      const submittedOn = item.timestamp
        ? new Date(item.timestamp).toLocaleString("en-IN", {
            dateStyle: "short",
            timeStyle: "short"
          })
        : "N/A";

      return `
        <div style="
          background:#fff;
          padding:12px;
          border-radius:8px;
          margin-bottom:12px;
          border:1px solid #e2e8f0;
          border-left:4px solid #1e40af;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
            display:flex;
            justify-content:space-between;
            margin-bottom:4px;
          ">
            <span>🕒 Event: ${(item.admin_time || item.time) || "N/A"}</span>
            <span>📅 Submitted: ${submittedOn}</span>
          </div>

          <div style="font-weight:700;color:#1e40af;font-size:14px;margin-bottom:4px;">
            ${item.report_type || "Weather Update"}
          </div>

          <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">
            📍 ${item.location || "Unknown location"}
          </div>

          <div style="
            font-size:13px;
            color:#475569;
            line-height:1.5;
            background:#f1f5f9;
            padding:8px;
            border-radius:4px;
          ">
            ${(item.admin_observation || item.observation) || "No details provided."}
          </div>

          <div style="
            font-size:11px;
            margin-top:8px;
            color:#1e3a8a;
            font-weight:700;
          ">
            Reporter: ${
  item.show_name === "yes"
    ? (item.admin_name || item.name)
    : "Anonymous"
}

          </div>
        </div>
      `;
    }).join("");
  });
});
