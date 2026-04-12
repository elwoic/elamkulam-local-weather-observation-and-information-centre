import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const panel    = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl    = document.getElementById("alert-pre");
  const infoEl   = document.getElementById("alert-info");
  const timeEl   = document.getElementById("alert-timestamp");

  /* ── IMMEDIATE LOADING STATE ── */
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

  function parseDateTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  onValue(ref(db, "/"), (snapshot) => {
    const data = snapshot.val() || {};
    
    // Midnight today for clean comparison
    const now = new Date();
    const tTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Data containers for our slots
    let finalManualText = null; let finalManualBlink = false;
    let finalPreText    = null; let finalPreBlink    = false;
    let finalInfoText   = null;
    let activeUpdatesCount = 0;

    /* ── 1. CHECK PRE-UPDATE FOR JUMPING ── */
    if (data.preUpdate?.text?.trim()) {
      const preTs = parseDateTs(data.preUpdate.date);
      if (!isNaN(preTs)) {
        if (preTs === tTs) {
          // Target date is today - jump to manual slot
          finalManualText = data.preUpdate.text;
          finalManualBlink = (data.preUpdate.blink === true || data.preUpdate.blink === "true");
        } else if (preTs > tTs) {
          // Future date - stays in pre slot
          finalPreText = data.preUpdate.text;
          finalPreBlink = (data.preUpdate.blink === true || data.preUpdate.blink === "true");
        }
      }
    }

    /* ── 2. CHECK MANUAL UPDATE (Overrides Jump) ── */
    if (data.manualUpdate?.text?.trim()) {
      const manualTs = parseDateTs(data.manualUpdate.date);
      if (isNaN(manualTs) || manualTs >= tTs) {
        // Explicit manual update overrides any jumping pre-update
        finalManualText = data.manualUpdate.text;
        finalManualBlink = (data.manualUpdate.blink === true || data.manualUpdate.blink === "true");
      }
    }

    /* ── 3. CHECK INFO ── */
    if (data.info?.text?.trim()) {
      finalInfoText = data.info.text;
    }

    /* ── 4. RENDER TO DOM ── */
    if (manualEl) {
      manualEl.classList.remove("blink");
      if (finalManualText) {
        manualEl.textContent = finalManualText;
        manualEl.style.color = "red";
        if (finalManualBlink) manualEl.classList.add("blink");
        activeUpdatesCount++;
      } else {
        manualEl.textContent = "No updates available at this time";
        manualEl.style.color = "";
      }
    }

    if (preEl) {
      preEl.classList.remove("blink");
      if (finalPreText) {
        preEl.textContent = finalPreText;
        preEl.style.color = "#f1c40f";
        if (finalPreBlink) preEl.classList.add("blink");
        activeUpdatesCount++;
      } else {
        preEl.textContent = "No updates scheduled";
        preEl.style.color = "";
      }
    }

    if (infoEl) {
      if (finalInfoText) {
        infoEl.textContent = finalInfoText;
        activeUpdatesCount++;
      } else {
        infoEl.textContent = "No general information";
      }
    }

    if (timeEl && data.lastUpdated) {
      timeEl.textContent = "Last updated: " + data.lastUpdated;
    }

    // Hide panel completely ONLY if there are exactly 0 active updates
    if (panel) {
      panel.style.display = (activeUpdatesCount > 0) ? "block" : "none";
    }
  });
});
