import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const panel    = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl    = document.getElementById("alert-pre");
  const infoEl   = document.getElementById("alert-info");
  const timeEl   = document.getElementById("alert-timestamp");

  /* Loading state */
  const loadingHtml = `
    <div class="loading-text">
      <div class="spinner-wrapper">
        <div class="spinner-ring"></div>
        <div class="spinner-dot"></div>
      </div>
      <span>Connecting to database...</span>
    </div>`;

  if (panel) {
    panel.style.display = "block";
    if (manualEl) manualEl.innerHTML = loadingHtml;
    if (preEl)    preEl.innerHTML    = loadingHtml;
    if (infoEl)   infoEl.innerHTML   = loadingHtml;
  }

  const firebaseConfig = {
    apiKey:            "AIzaSyALWX2l-9_6izgvt_JerJjTDbgNc5oT2VQ",
    authDomain:        "administration-protal.firebaseapp.com",
    databaseURL:       "https://administration-protal-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "administration-protal",
    storageBucket:     "administration-protal.firebasestorage.app",
    messagingSenderId: "141478371424",
    appId:             "1:141478371424:web:ab431e8c467084e4fee305"
  };

  const app = getApps().find(a => a.name === "alertsApp") || initializeApp(firebaseConfig, "alertsApp");
  const db  = getDatabase(app);

  onValue(ref(db, "/"), (snapshot) => {
  const data = snapshot.val();

  // Reset
  [manualEl, preEl, infoEl].forEach(el => {
    if (!el) return;
    el.innerHTML = "";
    el.classList.remove("blink");
    el.style.color = "";
  });

  if (timeEl) timeEl.textContent = "";

  let hasAny = false;

  // Manual update
  if (data?.manualUpdate?.text && manualEl) {
    manualEl.textContent = data.manualUpdate.text;
    manualEl.style.color = "red";
    if (data.manualUpdate.blink === true || data.manualUpdate.blink === "true")
      manualEl.classList.add("blink");
    hasAny = true;
  } else if (manualEl) {
    manualEl.textContent = "No updates available at this time";
  }

  // Pre-update
  if (data?.preUpdate?.text && preEl) {
    preEl.textContent = data.preUpdate.text;
    preEl.style.color = "#f1c40f";
    if (data.preUpdate.blink === true || data.preUpdate.blink === "true")
      preEl.classList.add("blink");
    hasAny = true;
  } else if (preEl) {
    preEl.textContent = "No updates scheduled";
  }

  // Info
  if (data?.info?.text && infoEl) {
    infoEl.textContent = data.info.text;
    hasAny = true;
  } else if (infoEl) {
    infoEl.textContent = "No general information";
  }

  // Timestamp
  if (timeEl && data?.lastUpdated) {
    timeEl.textContent = "Last updated: " + data.lastUpdated;
  }

  // Hide entire panel only if all three fields are empty
  if (panel) panel.style.display = hasAny ? "block" : "none";
});
});
