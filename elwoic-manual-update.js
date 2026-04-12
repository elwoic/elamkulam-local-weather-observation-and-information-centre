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

  // Get today's date at midnight for clean comparison
  const now = new Date();
  const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  function parseDateTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  let hasAny = false;
  let manualFilled = false;

  // ── MANUAL UPDATE ──
  // Show only if date is today or in the future. If past, treat as expired.
  if (data?.manualUpdate?.text) {
    const manualTs = parseDateTs(data.manualUpdate.date);
    const manualValid = isNaN(manualTs) || manualTs >= todayTs; // no date = always show

    if (manualValid && manualEl) {
      manualEl.textContent = data.manualUpdate.text;
      manualEl.style.color = "red";
      if (data.manualUpdate.blink === true || data.manualUpdate.blink === "true")
        manualEl.classList.add("blink");
      hasAny = true;
      manualFilled = true;
    }
  }

  // ── PRE-UPDATE ──
  // Future date  → show in pre section
  // Today's date → jump to manual/current section (if not already filled)
  // Past date    → expired, don't show
  if (data?.preUpdate?.text) {
    const preTs = parseDateTs(data.preUpdate.date);

    if (!isNaN(preTs) && preTs === todayTs && !manualFilled) {
      // Target date is today — promote to current update slot
      if (manualEl) {
        manualEl.textContent = data.preUpdate.text;
        manualEl.style.color = "red";
        if (data.preUpdate.blink === true || data.preUpdate.blink === "true")
          manualEl.classList.add("blink");
        hasAny = true;
        manualFilled = true;
      }
    } else if (!isNaN(preTs) && preTs > todayTs) {
      // Future — show in pre section normally
      if (preEl) {
        preEl.textContent = data.preUpdate.text;
        preEl.style.color = "#f1c40f";
        if (data.preUpdate.blink === true || data.preUpdate.blink === "true")
          preEl.classList.add("blink");
        hasAny = true;
      }
    }
    // If past → silently skip (expired)
  }

  // ── INFO ──
  if (data?.info?.text && infoEl) {
    infoEl.textContent = data.info.text;
    hasAny = true;
  }

  // ── DEFAULT TEXT for empty fields ──
  if (!manualFilled && manualEl) manualEl.textContent = "No updates available at this time";
  if (!hasAny && preEl) preEl.textContent = "No updates scheduled"; // only show default if nothing shown
  if (!data?.info?.text && infoEl) infoEl.textContent = "No general information";

  // Timestamp
  if (timeEl && data?.lastUpdated) {
    timeEl.textContent = "Last updated: " + data.lastUpdated;
  }

  // Hide panel if nothing real to show
  if (panel) panel.style.display = hasAny ? "block" : "none";
});
});
